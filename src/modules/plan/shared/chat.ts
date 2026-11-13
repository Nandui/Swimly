import "server-only";
import { createSign, createVerify } from "node:crypto";
import { z } from "zod";

/** Plan (test)'s line to Google Chat (D31): post a card to a space as the Chat app, change it,
 *  list the spaces the app has been added to, and check that a request really comes from Google
 *  Chat. The app signs in as its service account (`PLAN_CHAT_CLIENT_EMAIL`,
 *  `PLAN_CHAT_PRIVATE_KEY`); Chat's requests are checked against the Cloud project number
 *  (`PLAN_CHAT_PROJECT_NUMBER`). Only how to talk to Chat lives here; what is said and when is
 *  the caller's. It moves to the platform when a second app needs it (AGENTS.md). */

export type ChatConfig = { clientEmail: string; privateKey: string; projectNumber: string };

/** The settings, or null while Google Chat is not set up (docs/operations.md). */
export function chatConfig(env: Record<string, string | undefined> = process.env): ChatConfig | null {
  const clientEmail = env.PLAN_CHAT_CLIENT_EMAIL?.trim() ?? "";
  // Vercel keeps a key's line breaks as the two characters "\n".
  const privateKey = (env.PLAN_CHAT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
  const projectNumber = env.PLAN_CHAT_PROJECT_NUMBER?.trim() ?? "";
  if (!clientEmail || !privateKey.includes("PRIVATE KEY") || !/^\d{6,20}$/.test(projectNumber)) return null;
  return { clientEmail, privateKey, projectNumber };
}

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const SCOPE = "https://www.googleapis.com/auth/chat.bot";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://chat.googleapis.com/v1";
/** A space or message as Chat names it; nothing else is ever put in a URL. */
const SPACE = /^spaces\/[A-Za-z0-9_-]{1,100}$/;
const MESSAGE = /^spaces\/[A-Za-z0-9_-]{1,100}\/messages\/[A-Za-z0-9_.-]{1,200}$/;

let cached: { for: string; token: string; until: number } | null = null;

/** An access token for the Chat app itself, kept until shortly before it runs out. */
async function accessToken(config: ChatConfig, now = Date.now()): Promise<string> {
  if (cached && cached.for === config.clientEmail && cached.until > now + 60_000) return cached.token;
  const at = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: config.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: at, exp: at + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(config.privateKey).toString("base64url");
  const response = await fetch(TOKEN_URL, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${signature}` }),
  });
  if (!response.ok) throw new Error("Google Chat sign-in failed.");
  const token = z.object({ access_token: z.string().min(1).max(8192).regex(/^\S+$/), expires_in: z.number().int().positive().default(3600) }).safeParse(await response.json());
  if (!token.success) throw new Error("Google Chat sign-in failed.");
  cached = { for: config.clientEmail, token: token.data.access_token, until: now + token.data.expires_in * 1000 };
  return cached.token;
}

async function call(config: ChatConfig, method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${API}/${path}`, {
    method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${await accessToken(config)}`, ...(body === undefined ? {} : { "Content-Type": "application/json; charset=UTF-8" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Google Chat refused the request (${response.status}).`);
  return response.json();
}

/** A message as Chat takes it: the cards, and a line of text for notifications. */
export type ChatMessage = { text?: string; cardsV2?: unknown[] };

/** Post to a space the app has been added to. Returns the message's name, to change it later. */
export async function postChatMessage(config: ChatConfig, space: string, message: ChatMessage): Promise<string> {
  if (!SPACE.test(space)) throw new Error("That is not a Google Chat space.");
  const posted = z.object({ name: z.string().regex(MESSAGE) }).safeParse(await call(config, "POST", `${space}/messages`, message));
  if (!posted.success) throw new Error("Google Chat did not confirm the message.");
  return posted.data.name;
}

/** Replace the cards (and text) of a message the app posted. */
export async function updateChatMessage(config: ChatConfig, name: string, message: ChatMessage): Promise<void> {
  if (!MESSAGE.test(name)) throw new Error("That is not a Google Chat message.");
  await call(config, "PATCH", `${name}?updateMask=${encodeURIComponent("text,cardsV2")}`, message);
}

/** The named spaces the app has been added to (never one-to-one chats), by name. */
export async function chatSpaces(config: ChatConfig): Promise<{ space: string; name: string }[]> {
  const page = z.object({
    spaces: z.array(z.object({ name: z.string(), displayName: z.string().optional(), spaceType: z.string().optional() })).default([]),
    nextPageToken: z.string().optional(),
  });
  const out: { space: string; name: string }[] = [];
  let pageToken = "";
  for (let i = 0; i < 5; i++) {
    const parsed = page.safeParse(await call(config, "GET", `spaces?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`));
    if (!parsed.success) throw new Error("Google Chat did not list its spaces.");
    for (const s of parsed.data.spaces) if (SPACE.test(s.name) && s.spaceType !== "DIRECT_MESSAGE" && s.displayName) out.push({ space: s.name, name: s.displayName });
    pageToken = parsed.data.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------- Requests from Google Chat ---------- */

const CHAT_ISSUER = "chat@system.gserviceaccount.com";
const CERTS_URL = `https://www.googleapis.com/service_accounts/v1/metadata/x509/${CHAT_ISSUER}`;
let certs: { keys: Record<string, string>; until: number } | null = null;

async function chatCerts(now: number, refresh = false): Promise<Record<string, string>> {
  if (certs && certs.until > now && !refresh) return certs.keys;
  const response = await fetch(CERTS_URL, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  const keys = response.ok ? z.record(z.string(), z.string()).safeParse(await response.json()) : null;
  if (!keys?.success) throw new Error("Google Chat's keys could not be read.");
  certs = { keys: keys.data, until: now + 3_600_000 };
  return certs.keys;
}

/** Is this the bearer token Google Chat sends its app? Chat signs each request as
 *  chat@system.gserviceaccount.com, for this project's number, for a short while. Anything else,
 *  including a token for another project's app, is refused. Google publishes its keys as
 *  certificates, which Node verifies against directly. `keys` is for tests. */
export async function fromGoogleChat(authorization: string | null, config: ChatConfig, now = Date.now(), keys?: Record<string, string>): Promise<boolean> {
  const token = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(authorization ?? "");
  if (!token) return false;
  const [, head, body, signature] = token;
  let header: unknown, claims: unknown;
  try { header = JSON.parse(Buffer.from(head, "base64url").toString("utf8")); claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return false; }
  const h = z.object({ alg: z.literal("RS256"), kid: z.string().min(1) }).safeParse(header);
  const c = z.object({ iss: z.literal(CHAT_ISSUER), aud: z.string(), exp: z.number(), iat: z.number().optional() }).safeParse(claims);
  if (!h.success || !c.success || c.data.aud !== config.projectNumber) return false;
  const seconds = now / 1000;
  // Five minutes' grace for clocks that disagree.
  if (c.data.exp < seconds - 300 || (c.data.iat !== undefined && c.data.iat > seconds + 300)) return false;
  let pem = (keys ?? await chatCerts(now))[h.data.kid];
  // Google changes its keys now and then: a key not seen before is looked up once more.
  if (!pem && !keys) pem = (await chatCerts(now, true))[h.data.kid];
  if (!pem) return false;
  try {
    return createVerify("RSA-SHA256").update(`${head}.${body}`).verify(pem, Buffer.from(signature, "base64url"));
  } catch { return false; }
}

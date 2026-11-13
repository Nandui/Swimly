import assert from "node:assert/strict";
import { createSign, generateKeyPairSync } from "node:crypto";
import { afterEach, test } from "node:test";
import { serverModule } from "@/test/server-module";
import { coverCard, coverStatus, type CoverCardInput } from "@/modules/plan/shared/cover-card";

/** Plan (test)'s line to Google Chat with Google faked: the settings, signing in as the app,
 *  posting and changing a message, listing spaces, and telling Chat's own requests from anyone
 *  else's. And the card a cover request is. No real key, space or person. */
const chat = serverModule<typeof import("./chat")>("src/modules/plan/shared/chat.ts", { "server-only": {} });
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
const config = { clientEmail: "app@example.invalid", privateKey, projectNumber: "1234567890" };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

type Call = { url: string; method: string; body: string; authorization: string | null };
/** Google, faked: one token, then whatever each Chat call should answer. */
function google(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? ""), authorization: new Headers(init?.headers).get("authorization") });
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "token-1", expires_in: 3600 });
    const key = Object.keys(answers).find((k) => url.includes(k));
    return key ? Response.json(answers[key]) : new Response("no", { status: 403 });
  }) as typeof fetch;
  return calls;
}

test("Google Chat counts as set up only with the app's email, its key and the project number", () => {
  const env = { PLAN_CHAT_CLIENT_EMAIL: " app@example.invalid ", PLAN_CHAT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----", PLAN_CHAT_PROJECT_NUMBER: "1234567890" };
  assert.deepEqual(chat.chatConfig(env), { clientEmail: "app@example.invalid", privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----", projectNumber: "1234567890" });
  assert.equal(chat.chatConfig({ ...env, PLAN_CHAT_PRIVATE_KEY: "" }), null);
  assert.equal(chat.chatConfig({ ...env, PLAN_CHAT_PROJECT_NUMBER: "my-project" }), null, "the number, not the project's name");
  assert.equal(chat.chatConfig({}), null);
});

test("the app signs in once, posts to a space, changes the message and lists its spaces", async () => {
  const calls = google({
    "spaces/AAA/messages": { name: "spaces/AAA/messages/m.1" },
    "spaces?pageSize": { spaces: [{ name: "spaces/BBB", displayName: "Reception team", spaceType: "SPACE" }, { name: "spaces/AAA", displayName: "Pool team", spaceType: "SPACE" }, { name: "spaces/DM", spaceType: "DIRECT_MESSAGE" }] },
  });
  assert.equal(await chat.postChatMessage(config, "spaces/AAA", { text: "Cover needed" }), "spaces/AAA/messages/m.1");
  await chat.updateChatMessage(config, "spaces/AAA/messages/m.1", { text: "Covered" });
  assert.deepEqual(await chat.chatSpaces(config), [{ space: "spaces/AAA", name: "Pool team" }, { space: "spaces/BBB", name: "Reception team" }]);
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url.replace("https://chat.googleapis.com/v1/", "")}`), [
    "POST https://oauth2.googleapis.com/token", "POST spaces/AAA/messages", "PATCH spaces/AAA/messages/m.1?updateMask=text%2CcardsV2", "GET spaces?pageSize=100",
  ], "one sign-in serves them all");
  assert.match(calls[0].body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=/);
  assert.equal(calls[1].authorization, "Bearer token-1");
  assert.equal(calls[1].body, JSON.stringify({ text: "Cover needed" }));
});

test("only a real space or message name ever reaches Google, and a refusal is an error", async () => {
  const calls = google({});
  await assert.rejects(chat.postChatMessage(config, "spaces/AAA/../../oops", {}), /not a Google Chat space/);
  await assert.rejects(chat.updateChatMessage(config, "spaces/AAA", {}), /not a Google Chat message/);
  assert.equal(calls.length, 0);
  await assert.rejects(chat.postChatMessage(config, "spaces/ZZZ", {}), /refused the request \(403\)/);
});

/** A bearer token as Google Chat signs one. */
function signed(claims: Record<string, unknown>, key = privateKey, kid = "k1") {
  const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const data = `${part({ alg: "RS256", kid, typ: "JWT" })}.${part(claims)}`;
  return `Bearer ${data}.${createSign("RSA-SHA256").update(data).sign(key).toString("base64url")}`;
}

test("a request is Google Chat's only when Chat signed it, for this project, just now", async () => {
  const now = Date.UTC(2026, 10, 12, 10);
  const at = now / 1000;
  const good = { iss: "chat@system.gserviceaccount.com", aud: "1234567890", iat: at - 10, exp: at + 3600 };
  const keys = { k1: publicKey };
  assert.equal(await chat.fromGoogleChat(signed(good), config, now, keys), true);
  assert.equal(await chat.fromGoogleChat(null, config, now, keys), false);
  assert.equal(await chat.fromGoogleChat("Bearer not-a-token", config, now, keys), false);
  assert.equal(await chat.fromGoogleChat(signed({ ...good, aud: "999999999" }), config, now, keys), false, "another project's app");
  assert.equal(await chat.fromGoogleChat(signed({ ...good, iss: "someone@example.invalid" }), config, now, keys), false);
  assert.equal(await chat.fromGoogleChat(signed({ ...good, exp: at - 3600 }), config, now, keys), false, "expired");
  assert.equal(await chat.fromGoogleChat(signed(good, privateKey, "k2"), config, now, keys), false, "a key Google does not publish");
  const other = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  assert.equal(await chat.fromGoogleChat(signed(good, other.privateKey), config, now, keys), false, "signed by someone else");
  const tampered = signed(good).replace(/\.[A-Za-z0-9_-]+\./, `.${Buffer.from(JSON.stringify({ ...good, aud: "1234567890", sub: "x" })).toString("base64url")}.`);
  assert.equal(await chat.fromGoogleChat(tampered, config, now, keys), false, "changed after signing");
});

const card: CoverCardInput = { id: "r1", title: "Public swim", dutyName: "Lifeguard", place: "Main pool", date: "2026-11-14", start: 540, end: 720,
  note: "Report to the duty manager", askedByName: "Sam Example", canCover: [], outcome: null, chosenName: null };
const widgetsOf = (c: CoverCardInput) => JSON.stringify(coverCard(c).cardsV2[0].card.sections[0].widgets);

test("an open card says what, where and when, with the two buttons carrying the request", () => {
  const made = coverCard(card);
  assert.equal(made.cardsV2[0].card.header.subtitle, "Lifeguard for Public swim");
  const text = widgetsOf(card);
  for (const expected of ["Main pool", "Report to the duty manager", "Sam Example", "I can cover", "Can't", "plan.cover.answer", '"key":"request","value":"r1"', '"key":"answer","value":"yes"']) assert.ok(text.includes(expected), expected);
  assert.match(made.text, /^Cover needed: Lifeguard for Public swim, /);
  assert.doesNotMatch(widgetsOf({ ...card, place: "", note: "" }), /Where|Note/);
});

test("the last line follows the request: who can cover by first name, then how it ended, without buttons", () => {
  assert.equal(coverStatus(card), "Nobody has answered yet.");
  assert.equal(coverStatus({ ...card, canCover: ["Conor Example", "Riley Example"] }), "Can cover: Conor, Riley");
  assert.equal(coverStatus({ ...card, outcome: "filled", chosenName: "Conor Example" }), "Covered by Conor Example. Thank you.");
  assert.equal(coverStatus({ ...card, outcome: "stopped" }), "No longer needed.");
  assert.doesNotMatch(widgetsOf({ ...card, outcome: "filled", chosenName: "Conor Example" }), /I can cover|plan\.cover\.answer/);
});

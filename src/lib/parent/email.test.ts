import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { serverModule } from "../../test/server-module";
import { readEmailParts } from "../../test/email";
import { readFile } from "node:fs/promises";

const { parentEmailConfig, sendParentSignInCode } = serverModule<typeof import("./email")>("src/lib/parent/email.ts", {});
const { sendGoogleEmail, sendGoogleTextEmail } = serverModule<typeof import("../email/google")>("src/lib/email/google.ts", {});
const originalEnv = { ...process.env }, originalFetch = globalThis.fetch;
const tokenUrl = "https://oauth2.googleapis.com/token";
const sendUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const scope = "https://www.googleapis.com/auth/gmail.send";
let calls: { url: unknown; init?: RequestInit }[];

beforeEach(() => {
  process.env = { ...originalEnv, PARENT_GOOGLE_CLIENT_ID: "synthetic-client", PARENT_GOOGLE_CLIENT_SECRET: "synthetic-secret",
    PARENT_GOOGLE_REFRESH_TOKEN: "synthetic-refresh", PARENT_EMAIL_FROM: "Bookly <info@example.test>" };
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === tokenUrl) return Response.json({ access_token: "synthetic-access", token_type: "Bearer", scope });
    assert.equal(url, sendUrl);
    return Response.json({ id: "synthetic-message" });
  };
});
afterEach(() => { process.env = originalEnv; globalThis.fetch = originalFetch; });

function isUnavailable(error: unknown) {
  return error instanceof Error && "status" in error && error.status === 503 && "code" in error && error.code === "UNAVAILABLE";
}

test("sends one private MIME email through the authorized Google mailbox", async () => {
  await sendParentSignInCode("parent@example.test", "012345");
  assert.deepEqual(calls.map(call => call.url), [tokenUrl, sendUrl]);
  const credentials = new URLSearchParams(String(calls[0].init?.body));
  assert.equal(credentials.get("grant_type"), "refresh_token");
  assert.equal(credentials.get("client_id"), "synthetic-client");
  assert.equal(credentials.get("client_secret"), "synthetic-secret");
  assert.equal(credentials.get("refresh_token"), "synthetic-refresh");
  assert.equal(new Headers(calls[1].init?.headers).get("authorization"), "Bearer synthetic-access");
  const payload = JSON.parse(String(calls[1].init?.body));
  assert.deepEqual(Object.keys(payload), ["raw"]);
  assert.match(payload.raw, /^[A-Za-z0-9_-]+$/);
  const mime = Buffer.from(payload.raw, "base64url").toString("utf8");
  const headers = mime.slice(0, mime.indexOf("\r\n\r\n"));
  const parts = readEmailParts(mime);
  const from = /^From: (.+) <info@example\.test>\r$/m.exec(headers);
  assert.ok(from);
  const displayName = from[1].split(" ").map(word => Buffer.from(word.slice(10, -2), "base64").toString("utf8")).join("");
  assert.equal(displayName, "LeisureWorld Aquatics");
  assert.match(headers, /^Subject: Your LeisureWorld Aquatics parent sign-in code\r$/m);
  assert.match(headers, /^To: parent@example\.test\r$/m);
  assert.equal(/^Bcc:|^Cc:/m.test(headers), false);
  assert.match(headers, /Content-Type: multipart\/related;/);
  assert.match(mime, /Content-Type: multipart\/alternative;/);
  assert.deepEqual(parts.map(part => part.type), ["text/plain", "text/html", "image/png"]);
  const [plain, html, logo] = parts;
  assert.match(plain.content.toString("utf8"), /Your LeisureWorld Aquatics sign-in code is 012345.*\r\n\r\nIt expires in 10 minutes/);
  const markup = html.content.toString("utf8");
  assert.match(markup, /<html lang="en">/);
  assert.match(markup, />012345<\/p>/);
  assert.match(markup, /10 minutes/);
  assert.match(markup, /Do not share it with anyone/);
  assert.match(markup, /src="cid:leisureworld-logo@turnfin"/);
  assert.match(markup, /alt="LeisureWorld"/);
  assert.match(markup, /#0B4F8A/);
  assert.doesNotMatch(markup, /<script|https?:\/\/|parent@example\.test/);
  assert.doesNotMatch(headers, /012345/);
  assert.match(logo.headers, /Content-ID: <leisureworld-logo@turnfin>/);
  assert.match(logo.headers, /Content-Disposition: inline;/);
  assert.deepEqual(logo.content, await readFile("assets/email/leisureworld-white-no-tagline.png"));
  assert.ok(mime.split("\r\n").every(line => line.length < 998));
  assert.equal(mime.includes("synthetic-secret"), false);
  assert.equal(mime.includes("synthetic-refresh"), false);
  for (const call of calls) {
    assert.equal(call.init?.cache, "no-store");
    assert.equal(call.init?.redirect, "error");
    assert.ok(call.init?.signal instanceof AbortSignal);
  }
  assert.equal(calls[0].init?.signal, calls[1].init?.signal);
});

test("the existing plain-text transport stays compatible with Refunds emails", async () => {
  await sendGoogleTextEmail("staff@example.test", "Refund update", "Synthetic request status.\r\nNo customer details.", parentEmailConfig());
  const payload = JSON.parse(String(calls[1].init?.body));
  const mime = Buffer.from(payload.raw, "base64url").toString("utf8");
  assert.doesNotMatch(mime, /multipart\//);
  const parts = readEmailParts(mime);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].type, "text/plain");
  assert.equal(parts[0].content.toString("utf8"), "Synthetic request status.\r\nNo customer details.");
});

test("unsafe inline image metadata is rejected before network work", async () => {
  await assert.rejects(sendGoogleEmail("parent@example.test", "Code", {
    text: "Synthetic", html: "<p>Synthetic</p>", inlineImages: [{
      cid: "logo\r\nBcc: attacker@example.test", filename: "logo.png", contentType: "image/png", content: Buffer.from("synthetic"),
    }],
  }, parentEmailConfig()));
  assert.equal(calls.length, 0);
});

test("requires Google credentials and a single safe sender before doing network work", async () => {
  for (const key of ["PARENT_GOOGLE_CLIENT_ID", "PARENT_GOOGLE_CLIENT_SECRET", "PARENT_GOOGLE_REFRESH_TOKEN", "PARENT_EMAIL_FROM"]) {
    const value = process.env[key];
    delete process.env[key];
    assert.throws(() => parentEmailConfig(), isUnavailable);
    process.env[key] = value;
  }
  for (const from of ["not an address", "one@example.test, two@example.test", "Bookly <info@example.test>\r\nBcc: attacker@example.test"]) {
    process.env.PARENT_EMAIL_FROM = from;
    await assert.rejects(sendParentSignInCode("parent@example.test", "123456"), isUnavailable);
  }
  assert.equal(calls.length, 0);
});

test("rejects header injection and invalid codes without sending", async () => {
  await assert.rejects(sendParentSignInCode("parent@example.test\r\nBcc: attacker@example.test", "123456"), isUnavailable);
  await assert.rejects(sendParentSignInCode("parent@example.test", "123456\r\n"), isUnavailable);
  assert.equal(calls.length, 0);
});

test("accepts a bare sender and encodes long Unicode names into valid MIME words", () => {
  process.env.PARENT_EMAIL_FROM = "info@example.test";
  assert.equal(parentEmailConfig().fromHeader, "info@example.test");
  const name = "École de natation 🏊 ".repeat(2).trim();
  process.env.PARENT_EMAIL_FROM = `${name} <info@example.test>`;
  const words = parentEmailConfig().fromHeader.split(" <")[0].split(" ");
  assert.ok(words.every(word => word.length <= 75));
  assert.equal(words.map(word => Buffer.from(word.slice(10, -2), "base64").toString("utf8")).join(""), name);
});

test("rejects revoked credentials, missing tokens and inappropriate OAuth scopes without a send", async () => {
  for (const response of [
    Response.json({ error: "invalid_grant" }, { status: 400 }), Response.json({}),
    Response.json({ access_token: "synthetic-access", token_type: "Bearer", scope: "https://mail.google.com/" }),
    Response.json({ access_token: "synthetic-access", token_type: "Bearer", scope: `${scope} extra-scope` }),
    new Response("not json"),
  ]) {
    globalThis.fetch = async (url) => { assert.equal(url, tokenUrl); return response; };
    await assert.rejects(sendParentSignInCode("parent@example.test", "123456"), isUnavailable);
  }
});

test("failed, quota-limited and uncertain sends return safe errors without retrying", async () => {
  for (const status of [401, 403, 429, 500, 200]) {
    let sends = 0;
    globalThis.fetch = async (url) => {
      if (url === tokenUrl) return Response.json({ access_token: "synthetic-access", token_type: "Bearer" });
      assert.equal(url, sendUrl); sends++;
      return Response.json({ error: "provider-private-details" }, { status });
    };
    await assert.rejects(sendParentSignInCode("parent@example.test", "123456"), isUnavailable);
    assert.equal(sends, 1);
  }
  globalThis.fetch = async () => { throw new Error("private network error"); };
  await assert.rejects(sendParentSignInCode("parent@example.test", "123456"), isUnavailable);
});

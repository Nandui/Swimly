import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { serverModule } from "../../test/server-module";

const { parentEmailConfig, sendParentSignInCode } = serverModule<typeof import("./email")>("src/lib/parent/email.ts", {});
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
  const [headers, body] = mime.split("\r\n\r\n");
  assert.match(headers, /^From: =\?UTF-8\?B\?Qm9va2x5\?= <info@example\.test>\r$/m);
  assert.match(headers, /^To: parent@example\.test\r$/m);
  assert.equal(/^Bcc:|^Cc:/m.test(headers), false);
  assert.match(Buffer.from(body, "base64").toString("utf8"), /code is 012345.*\r\n\r\nIt expires in 10 minutes/);
  assert.ok(body.trim().split("\r\n").every(line => line.length <= 76));
  assert.equal(mime.includes("synthetic-secret"), false);
  assert.equal(mime.includes("synthetic-refresh"), false);
  for (const call of calls) {
    assert.equal(call.init?.cache, "no-store");
    assert.equal(call.init?.redirect, "error");
    assert.ok(call.init?.signal instanceof AbortSignal);
  }
  assert.equal(calls[0].init?.signal, calls[1].init?.signal);
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

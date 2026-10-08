import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { PublicApiError, allowedOrigins, bearerToken, publicApi } from "./http";

const api = publicApi({
  name: "Test API",
  origins: () => ["https://app.example"],
  methods: "GET,POST,OPTIONS",
  messages: { originDenied: "Not allowed.", tooLarge: "Too large.", invalid: "Check it." },
});
const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://turnfin.example/api", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });

test("origins are bare https origins, or http on localhost outside production", () => {
  assert.deepEqual(allowedOrigins("https://a.example, https://b.example"), ["https://a.example", "https://b.example"]);
  assert.equal(allowedOrigins("https://a.example/path"), null);
  assert.equal(allowedOrigins("http://a.example"), null);
  assert.deepEqual(allowedOrigins("http://localhost:3000", { NODE_ENV: "development" }), ["http://localhost:3000"]);
  assert.equal(allowedOrigins("http://localhost:3000", { NODE_ENV: "production" }), null);
});

test("a bearer token is read only when it has the API's shape", () => {
  const withAuth = (value: string) => new Request("https://turnfin.example", { headers: { authorization: value } });
  assert.equal(bearerToken(withAuth(`Bearer ${"a".repeat(30)}`)), "a".repeat(30));
  assert.equal(bearerToken(withAuth("Bearer short")), null);
  assert.equal(bearerToken(withAuth(`Basic ${"a".repeat(30)}`)), null);
  assert.equal(bearerToken(withAuth(`Bearer ${"a".repeat(30)}`), /^[a-z]{43}$/), null);
});

test("bodies are JSON of 16 KiB or less, and refusals use the error envelope", async () => {
  assert.deepEqual(await api.readBody(post('{"a":1}'), z.object({ a: z.number() })), { a: 1 });
  await assert.rejects(api.readBody(post(JSON.stringify({ a: "x".repeat(17_000) })), z.any()), (e: PublicApiError) => e.status === 413 && e.message === "Too large.");
  await assert.rejects(api.readBody(post("{}", { "content-type": "text/plain" }), z.any()), (e: PublicApiError) => e.status === 415);
  const response = api.errorResponse(new PublicApiError(401, "UNAUTHENTICATED", "Sign in."));
  assert.equal(response.headers.get("WWW-Authenticate"), "Bearer");
  assert.deepEqual(await response.json(), { error: { code: "UNAUTHENTICATED", message: "Sign in." } });
});

test("responses are never cached, and CORS answers only an allowed origin", async () => {
  const ok = await api.respond(new Request("https://turnfin.example/api", { method: "OPTIONS", headers: { origin: "https://app.example" } }), async () => new Response());
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("Cache-Control"), "no-store");
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), "https://app.example");
  const denied = await api.respond(new Request("https://turnfin.example/api", { headers: { origin: "https://evil.example" } }), async () => new Response());
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(denied.headers.get("Cache-Control"), "no-store");
});

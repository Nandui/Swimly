import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { signedParentIp } from "./proxy-ip";
test("proxy rate-limit signatures are bound to client IP, request and time", () => {
  const secret = "synthetic-proxy-signature-secret-for-tests", now = 1790000000000, time = String(now), ip = "198.51.100.25";
  const path = "/api/parent/v1/sites?limit=20", method = "GET";
  const signature = createHmac("sha256", secret).update([time, method, path, ip].join("\n")).digest("hex");
  const headers = { "x-parent-client-ip": ip, "x-parent-client-time": time, "x-parent-client-signature": signature };
  const request = new Request(`https://staff.test${path}`, { headers });
  assert.equal(signedParentIp(request, secret, now), ip);
  assert.equal(signedParentIp(request, secret, now + 61_000), null);
  assert.equal(signedParentIp(request, "wrong-but-sufficiently-long-signing-key", now), null);
  for (const change of [{ "x-parent-client-ip": "198.51.100.26" }, { "x-parent-client-signature": "invalid" }]) assert.equal(signedParentIp(new Request(request.url, { headers: { ...headers, ...change } }), secret, now), null);
  assert.equal(signedParentIp(new Request("https://staff.test/api/parent/v1/me", { headers }), secret, now), null);
  assert.equal(signedParentIp(new Request(request.url, { method: "POST", headers }), secret, now), null);
  assert.equal(signedParentIp(new Request(request.url, { headers: { "x-real-ip": ip } }), secret, now), null);
});

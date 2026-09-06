import assert from "node:assert/strict";
import { test } from "node:test";
import { Auth } from "@auth/core";
import { encode } from "@auth/core/jwt";
import { authCookies } from "./auth-cookies";

const secret = "synthetic-current-secret-for-auth-regression-tests";
const devCookie = "swimly.dev.session-token";

async function session(environment: string, cookie: string, protocol = "https") {
  const errors: Error[] = [];
  const response = await Auth(new Request(`${protocol}://swimly.example.test/api/auth/session`, {
    headers: { cookie },
  }), {
    secret, trustHost: true, basePath: "/api/auth", providers: [],
    session: { strategy: "jwt" }, cookies: authCookies(environment),
    logger: { error: error => { errors.push(error); } },
  });
  return { response, body: await response.json(), errors };
}

async function token(name: string, encryptionSecret = secret) {
  return encode({ secret: encryptionSecret, salt: name, token: { sub: "synthetic-staff", name: "Test Staff" } });
}

test("development ignores another localhost app's encrypted session", async () => {
  const stale = await token("authjs.session-token", "synthetic-other-app-secret");
  const result = await session("development", `authjs.session-token=${stale}`, "http");
  assert.equal(result.response.status, 200);
  assert.equal(result.body, null);
  assert.deepEqual(result.errors, []);
});

for (const protocol of ["http", "https"]) {
  test(`a valid development session survives renewal over ${protocol}`, async () => {
    const valid = await token(devCookie);
    const result = await session("development", `${devCookie}=${valid}`, protocol);
    assert.equal(result.body.user.name, "Test Staff");
    assert.deepEqual(result.errors, []);
    const renewed = result.response.headers.getSetCookie().find(cookie => cookie.startsWith(`${devCookie}=`));
    assert.ok(renewed);
    assert.match(renewed, /; HttpOnly/i);
    assert.match(renewed, /; SameSite=Lax/i);
    assert.match(renewed, /; Path=\//i);
    assert.equal(/; Secure/i.test(renewed), protocol === "https");
  });
}

test("production continues accepting its existing secure Auth.js cookie", async () => {
  const name = "__Secure-authjs.session-token";
  const result = await session("production", `${name}=${await token(name)}`);
  assert.equal(result.body.user.name, "Test Staff");
  assert.deepEqual(result.errors, []);
  assert.ok(result.response.headers.getSetCookie().some(cookie => cookie.startsWith(`${name}=`)));
});

test("production does not accept the development cookie", async () => {
  const result = await session("production", `${devCookie}=${await token(devCookie)}`);
  assert.equal(result.body, null);
  assert.deepEqual(result.errors, []);
});

test("a token encrypted with the wrong secret is still rejected and logged", async () => {
  const result = await session("development", `${devCookie}=${await token(devCookie, "synthetic-wrong-secret")}`);
  assert.equal(result.body, null);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].name, "JWTSessionError");
  assert.ok(result.response.headers.getSetCookie().some(cookie => cookie.startsWith(`${devCookie}=;`) && cookie.includes("Max-Age=0")));
});

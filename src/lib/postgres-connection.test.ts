import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "pg-connection-string";
import { poolMax, postgresConnectionString } from "./postgres-connection";

const base = "postgresql://test:synthetic%40password@db.example.test:5432/swimly";

test("legacy SSL aliases retain full certificate and hostname verification", () => {
  for (const mode of ["prefer", "require", "verify-ca"]) {
    const result = postgresConnectionString(`${base}?sslmode=${mode}&application_name=Swimly%20test`);
    const url = new URL(result);
    assert.equal(url.searchParams.get("sslmode"), "verify-full");
    assert.equal(url.searchParams.get("application_name"), "Swimly test");
    assert.equal(url.password, "synthetic%40password");
    // Check the installed driver's effective TLS configuration as well as the URL.
    assert.deepEqual(parse(result).ssl, parse(`${base}?sslmode=verify-full`).ssl);
  }
});

test("explicit SSL policies and local connections remain unchanged", () => {
  for (const query of ["", "?sslmode=verify-full", "?sslmode=disable", "?sslmode=no-verify", "?ssl=true"]) {
    const input = base + query;
    assert.equal(postgresConnectionString(input), input);
  }
});

test("explicit libpq compatibility retains its chosen SSL semantics", () => {
  for (const mode of ["prefer", "require", "verify-ca"]) {
    const input = `${base}?sslmode=${mode}&uselibpqcompat=true`;
    assert.equal(postgresConnectionString(input), input);
  }
  assert.equal(new URL(postgresConnectionString(`${base}?sslmode=require&uselibpqcompat=false`)).searchParams.get("sslmode"), "verify-full");
});

test("non-URL connection strings are left for driver validation", () => {
  assert.equal(postgresConnectionString("/var/run/postgresql"), "/var/run/postgresql");
});

test("the pool size is the caller's own unless DATABASE_POOL_MAX sets a whole number", () => {
  const saved = process.env.DATABASE_POOL_MAX;
  try {
    delete process.env.DATABASE_POOL_MAX;
    assert.equal(poolMax(5), 5);
    assert.equal(poolMax(), undefined);
    process.env.DATABASE_POOL_MAX = "1";
    assert.equal(poolMax(5), 1);
    for (const bad of ["0", "-2", "1.5", "many"]) {
      process.env.DATABASE_POOL_MAX = bad;
      assert.equal(poolMax(5), 5);
    }
  } finally {
    if (saved === undefined) delete process.env.DATABASE_POOL_MAX;
    else process.env.DATABASE_POOL_MAX = saved;
  }
});

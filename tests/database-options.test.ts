import test from "node:test";
import assert from "node:assert/strict";
import { databaseOptions } from "../src/lib/database-options";

test("managed CA certificates preserve PostgreSQL TLS verification", () => {
  const options = databaseOptions({
    DATABASE_URL: "postgres://fixture",
    DATABASE_SSL: "true",
    DATABASE_CA_PEM: "fixture-certificate",
    DATABASE_CA_FILE: "must-not-be-read",
    DATABASE_TLS_SERVERNAME: "postgres.railway.internal",
  });
  assert.equal(typeof options.ssl, "object");
  if (typeof options.ssl !== "object") throw new Error("TLS options missing");
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.ca, "fixture-certificate");
  assert.equal(options.ssl.servername, "postgres.railway.internal");
  assert.equal(typeof options.ssl.checkServerIdentity, "function");
});

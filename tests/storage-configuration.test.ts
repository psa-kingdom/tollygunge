import test from "node:test";
import assert from "node:assert/strict";
import {
  storageMode,
  managedStorageCredentials,
} from "../src/domain/storage-configuration";

test("production never falls back to local credential files", () => {
  const env = {
    NODE_ENV: "production",
    R2_BUCKET_NAME: "tpa-private-documents",
    CLOUDFLARE_CREDENTIAL_FILE: "original",
  };
  assert.equal(storageMode(env), undefined);
  assert.equal(storageMode({ ...env, NODE_ENV: "development" }), "local-file");
  assert.equal(
    storageMode({
      ...env,
      R2_ACCOUNT_ID: "a".repeat(32),
      R2_ACCESS_KEY_ID: "fixture",
    }),
    undefined,
  );
});

test("complete managed storage credentials are required and preferred", () => {
  const env = {
    NODE_ENV: "production",
    R2_BUCKET_NAME: "tpa-private-documents",
    R2_ACCOUNT_ID: "a".repeat(32),
    R2_ACCESS_KEY_ID: "fixture",
    R2_SECRET_ACCESS_KEY: "fixture-secret",
  };
  assert.equal(storageMode(env), "managed");
  assert.equal(
    managedStorageCredentials({ ...env, R2_ACCOUNT_ID: "../invalid" }),
    undefined,
  );
  assert.equal(
    storageMode({ ...env, R2_SECRET_ACCESS_KEY: undefined }),
    undefined,
  );
});

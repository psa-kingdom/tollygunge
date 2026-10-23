import test from "node:test";
import assert from "node:assert/strict";
import { newCredentialError, existingPasswordMaximum } from "../src/domain/password-policy";
test("new credential boundaries apply to all setting paths, never current credentials", () => {
  for (const path of ["/sign-up/email", "/reset-password", "/change-password", "/set-password"]) {
    for (const length of [5, 6, 12, 13]) {
      const value = "a".repeat(length);
      const body = path === "/sign-up/email" ? { password: value } : { newPassword: value, currentPassword: "L".repeat(128) };
      assert.equal(Boolean(newCredentialError(path, body)), length < 6 || length > 12, `${path}: ${length}`);
    }
  }
  for (const length of [13, 64, 128]) assert.equal(newCredentialError("/sign-in/email", { password: "x".repeat(length) }), "");
  assert.equal(existingPasswordMaximum, 128);
  assert.equal(newCredentialError("/sign-up/email", { password: "Ab12!@" }), "");
});

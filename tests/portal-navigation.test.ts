import test from "node:test";
import assert from "node:assert/strict";
import {
  portalNavigation,
  deploymentEnvironment,
} from "../src/domain/portal-navigation";
import { roles } from "../src/domain/access";
import { staffNavigation } from "../src/domain/staff-navigation";

test("horizontal groups retain every permitted destination without granting new workspaces", () => {
  for (const role of roles) {
    const previous = new Set(
      staffNavigation([role]).flatMap((group) =>
        group.items.map((item) => item.href),
      ),
    );
    const groups = portalNavigation([role]);
    assert.ok(groups.every((group) => group.items.length > 0));
    assert.deepEqual(
      new Set(
        groups.flatMap((group) =>
          group.items.map((item) => item.href.split("?")[0]),
        ),
      ),
      previous,
      role,
    );
    assert.equal(
      groups.some((group) =>
        group.items.some((item) => item.href.includes("view=accounts")),
      ),
      false,
    );
  }
});
test("member groups include verification, payments and account security at their established URLs", () => {
  const groups = portalNavigation([]);
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Overview", "Membership", "Events", "Inquiries", "Account"],
  );
  assert.deepEqual(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    [
      "/member",
      "/member/application",
      "/member/payments",
      "/member/events",
      "/member/inquiries",
      "/account/profile",
      "/member/security",
    ],
  );
});
test("deployment badge accepts only explicit environments and never infers production", () => {
  for (const value of [undefined, "", "preview", "PRODUCTION", "false"])
    assert.equal(deploymentEnvironment(value), undefined);
  for (const value of ["local", "testing", "production"] as const)
    assert.equal(deploymentEnvironment(value), value);
});

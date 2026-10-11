import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { publicInquiry, inquiryTags } from "../src/domain/inquiries";
import { staffNavigation } from "../src/domain/staff-navigation";
test("public inquiry consent and optional contacts do not grant identity or campaign access", () => {
  const input = {
    submissionId: randomUUID(),
    name: "A Visitor",
    email: "Visitor@Example.invalid",
    subject: "A professional inquiry",
    message: "Please contact me about an event.",
    topic: "Events",
    preference: "email",
    source: "contact",
    consent: true,
  };
  const result = publicInquiry({
    ...input,
    roles: ["administrator"],
    subscribed: true,
    userId: "invented",
  });
  assert.equal(result.email, "visitor@example.invalid");
  assert.ok(!("roles" in result));
  assert.ok(!("subscribed" in result));
  assert.ok(!("userId" in result));
  assert.equal(result.phone, "");
  assert.throws(() => publicInquiry({ ...input, consent: false }));
  assert.throws(() => publicInquiry({ ...input, preference: "phone" }));
  assert.deepEqual(inquiryTags(["Priority", "priority", "Follow-up"]), [
    "priority",
    "follow-up",
  ]);
  assert.throws(() => inquiryTags(Array(9).fill("a")));
  assert.throws(() => inquiryTags(["<html>"]));
});
test("staff navigation exposes only assigned responsibilities", () => {
  const links = (roles: string[]) =>
    staffNavigation(roles).flatMap((group) =>
      group.items.map((item) => item.href),
    );
  assert.deepEqual(links([]), []);
  assert.ok(
    links(["communications_operator"]).includes("/admin/workspaces/crm"),
  );
  assert.ok(
    !links(["communications_operator"]).includes("/admin/workspaces/payments"),
  );
  assert.ok(!links(["finance_operator"]).includes("/admin/workspaces/crm"));
  assert.ok(links(["administrator"]).includes("/admin/workspaces/access"));
  assert.ok(!links(["content_editor"]).includes("/admin/workspaces/access"));
});

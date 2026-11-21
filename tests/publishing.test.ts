import test from "node:test";
import assert from "node:assert/strict";
import {
  articleSlug,
  publicProfilePatch,
  publicationState,
} from "../src/domain/publishing";
import { emptyPerson } from "../src/domain/people";

test("article addresses are derived from titles and stay within supported URL limits", () => {
  assert.equal(
    articleSlug("Tax changes: What's new in 2026?"),
    "tax-changes-what-s-new-in-2026",
  );
  assert.equal(articleSlug("  Café & community  "), "cafe-community");
  const slug = articleSlug("Long article title ".repeat(20));
  assert.ok(slug.length <= 100);
  assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("public profile edits omit private and membership fields instead of clearing them", () => {
  const patch = publicProfilePatch({
    ...emptyPerson,
    name: "Sample Member",
    phone: "9999999999",
    email: "private@example.invalid",
    mobile: "9999999999",
    firstName: "Private",
    biography: "Public biography",
  });
  assert.equal(patch.name, "Sample Member");
  assert.equal(patch.biography, "Public biography");
  for (const key of [
    "phone",
    "email",
    "mobile",
    "firstName",
    "lastName",
    "addresses",
    "userId",
    "membershipNumber",
  ]) {
    assert.equal(Object.hasOwn(patch, key), false, key);
  }
  assert.deepEqual(patch.assignments, []);
});

test("archived entries are identified separately from drafts and published content", () => {
  assert.equal(publicationState({ published: null }), "Draft");
  assert.equal(publicationState({ published: {} }), "Published");
  assert.equal(
    publicationState({ published: {}, archived_at: "2026-11-21" }),
    "Archived",
  );
});

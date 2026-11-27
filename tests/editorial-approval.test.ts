import test from "node:test";
import assert from "node:assert/strict";
import { editorialProfile } from "../src/domain/editorial-approval";
import { personBody } from "../src/domain/people";
import { publicProfilePatch } from "../src/domain/publishing";
const accepted = personBody({
  name: "Existing member",
  email: "member@example.invalid",
  phone: "+919999999999",
  firstName: "Existing",
  lastName: "Member",
  addresses: {},
});
test("editorial review accepts supplied biography and assignments while retaining private member values", () => {
  const body = editorialProfile(
    {
      ...accepted,
      biography: "Supplied biography",
      assignments: [
        {
          groupId: "11111111-1111-4111-8111-111111111111",
          role: "Secretary",
          term: "",
          order: 0,
        },
      ],
    },
    accepted,
  );
  assert.equal(body.email, accepted.email);
  assert.equal(body.phone, accepted.phone);
  assert.equal(body.biography, "Supplied biography");
});
test("editorial review rejects identity, contact, address and professional-field changes", () => {
  for (const change of [
    { name: "Different person" },
    { email: "different@example.invalid" },
    { phone: "+918888888888" },
    { firstName: "Different" },
    { organization: "Different employer" },
    { profession: "Unsupported profession" },
    {
      links: [
        {
          platform: "Website",
          label: "Website",
          url: "https://example.invalid",
          public: true,
        },
      ],
    },
  ])
    assert.throws(
      () => editorialProfile({ ...accepted, ...change }, accepted),
      /Editorial approval cannot/,
    );
});

test("publishing edits preserve member contact data and replace About formatting only when edited", () => {
  const rich = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Existing About" }] }],
  };
  const previous = personBody({ ...accepted, biographyRich: rich, organization: "Existing firm" });
  const contactEdits = publicProfilePatch({
    ...previous,
    publicEmail: "website@example.invalid",
    publicMobile: "9876543210",
    publicDesignation: "Treasurer",
  });
  assert.equal(Object.hasOwn(contactEdits, "email"), false);
  const approved = editorialProfile({ ...previous, ...contactEdits }, previous);
  assert.equal(approved.email, accepted.email);
  assert.equal(approved.organization, "Existing firm");
  assert.equal(approved.publicEmail, "website@example.invalid");
  assert.equal(approved.publicMobile, "+919876543210");
  assert.equal(approved.publicDesignation, "Treasurer");
  assert.deepEqual(approved.biographyRich, previous.biographyRich);

  const newAbout = publicProfilePatch({ ...approved, biography: "New About", biographyRich: undefined });
  const updated = editorialProfile({ ...approved, ...newAbout }, approved);
  assert.equal(updated.biography, "New About");
  assert.equal(updated.biographyRich, undefined);
});

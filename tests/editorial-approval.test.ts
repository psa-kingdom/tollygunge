import test from "node:test";
import assert from "node:assert/strict";
import { editorialProfile } from "../src/domain/editorial-approval";
import { personBody } from "../src/domain/people";
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

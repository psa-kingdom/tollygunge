import test from "node:test";
import assert from "node:assert/strict";
import { validateProfile } from "../src/domain/profile";
import { boundedBody } from "../src/domain/request-body";
test("profile fields exclude identities and privileges; consent requires explicit boolean", () => {
  const profile = validateProfile({
    phone: " +91 1234567890 ",
    organization: " TPA ",
    newsletter: false,
    contactPreference: "email",
    userId: "other",
    role: "administrator",
    profession: " Chartered accountant ",
    jobTitle: " Partner ",
    city: " Kolkata ",
  });
  assert.equal(profile.organization, "TPA");
  assert.equal(profile.newsletter, false);
  assert.equal("role" in profile, false);
  assert.equal("userId" in profile, false);
  assert.equal(profile.profession, "Chartered accountant");
  assert.equal(profile.jobTitle, "Partner");
  assert.equal(profile.city, "Kolkata");
  assert.throws(() =>
    validateProfile({
      phone: "",
      organization: "",
      newsletter: false,
      contactPreference: "email",
      profession: "x".repeat(121),
    }),
  );
  for (const value of [
    { phone: "", organization: "", contactPreference: "email" },
    {
      phone: "bad phone",
      organization: "",
      newsletter: true,
      contactPreference: "email",
    },
    {
      phone: "",
      organization: "x".repeat(201),
      newsletter: false,
      contactPreference: "email",
    },
  ])
    assert.throws(() => validateProfile(value));
});
test("bounded bodies reject oversized declared and streamed data", async () => {
  await assert.rejects(
    boundedBody(
      new Request("http://test.invalid", {
        method: "POST",
        body: "12345",
        headers: { "content-length": "5" },
      }),
      4,
    ),
  );
  await assert.rejects(
    boundedBody(
      new Request("http://test.invalid", { method: "POST", body: "12345" }),
      4,
    ),
  );
  assert.equal(
    new TextDecoder().decode(
      await boundedBody(
        new Request("http://test.invalid", { method: "POST", body: "1234" }),
        4,
      ),
    ),
    "1234",
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  sharedDefaults,
  settingsBody,
  biographyHeading,
  websiteLink,
  resourceBody,
} from "../src/domain/website-settings";
import { homeDefaults } from "../src/domain/website-home";
import { personBody, publicPerson } from "../src/domain/people";
test("biography headings preserve full names and explicit person overrides", () => {
  assert.equal(biographyHeading("CA R. N. Singh"), "About CA R. N. Singh");
  assert.equal(
    biographyHeading(
      "CA R. N. Singh",
      "Professional journey",
      "Biography of {name}",
    ),
    "Professional journey",
  );
  assert.equal(
    biographyHeading("CA R. N. Singh", "", "Biography of {name}"),
    "Biography of CA R. N. Singh",
  );
  const p = personBody({ name: "CA Example", biographyTitle: "Experience" });
  assert.equal(publicPerson(p).biographyTitle, "Experience");
});
test("settings reject unsafe destinations without restricting text content", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.org",
    "https://user:secret@example.org",
    "/\\example.org",
  ])
    assert.throws(() => websiteLink(url));
  assert.equal(websiteLink("/about#section-1"), "/about#section-1");
  assert.equal(websiteLink("https://example.org/"), "https://example.org/");
  assert.deepEqual(settingsBody("shared", sharedDefaults), sharedDefaults);
  assert.deepEqual(settingsBody("home", homeDefaults), homeDefaults);
  const invalid = structuredClone(sharedDefaults);
  invalid.biographyHeading = "About {email}";
  assert.throws(() => settingsBody("shared", invalid));
});
test("layout slots remain stable while website copy and headings are editable", () => {
  const edited = structuredClone(homeDefaults);
  edited.copy.heroCopy02 = "A new community heading";
  assert.equal(
    (settingsBody("home", edited) as typeof homeDefaults).copy.heroCopy02,
    edited.copy.heroCopy02,
  );
  edited.cards.pop();
  assert.throws(() => settingsBody("home", edited));
  assert.throws(() =>
    resourceBody(
      {
        title: "Download",
        url: "https://example.org/",
        fileId: "11111111-1111-4111-8111-111111111111",
      },
      "document",
    ),
  );
  assert.throws(() =>
    resourceBody({ title: "Link", url: "javascript:test" }, "link"),
  );
});

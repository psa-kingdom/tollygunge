import test from "node:test";
import assert from "node:assert/strict";
import {
  personBody,
  emptyPerson,
  publicPerson,
  groupBody,
} from "../src/domain/people";
import { plainDocument } from "../src/domain/rich-content";
test("personal profiles bound rich biographies, social URLs and association assignments", () => {
  const p = personBody({
    ...emptyPerson,
    name: "Test Person",
    biography: "ignored",
    biographyRich: plainDocument("x".repeat(20000)),
    links: [
      {
        platform: "GitHub",
        label: "Code",
        url: "https://github.com/example",
        public: true,
      },
    ],
  });
  assert.equal(p.biography.length, 20000);
  assert.throws(() =>
    personBody({ ...p, biographyRich: plainDocument("x".repeat(20001)) }),
  );
  assert.throws(() =>
    personBody({
      ...p,
      links: [{ ...p.links[0], url: "javascript:alert(1)" }],
    }),
  );
  assert.throws(() =>
    personBody({
      ...p,
      links: [{ ...p.links[0], url: "https://user:secret@example.com" }],
    }),
  );
  assert.throws(() => personBody({ ...p, links: [p.links[0], p.links[0]] }));
  assert.throws(() => personBody({ ...p, links: Array(13).fill(p.links[0]) }));
  assert.throws(() =>
    groupBody({ name: "Test group", page: "member", section: 0, order: 0 }),
  );
});
test("public profile projection removes private contacts and unselected links", () => {
  const p = personBody({
    ...emptyPerson,
    name: "Test Person",
    phone: "+91 1234567890",
    links: [
      {
        platform: "Website",
        label: "Private",
        url: "https://example.com/private",
        public: false,
      },
      {
        platform: "Portfolio",
        label: "Portfolio",
        url: "https://example.com",
        public: true,
      },
    ],
  });
  const pub = publicPerson(p);
  assert.equal(pub.phone, "");
  assert.equal(pub.links.length, 1);
  assert.equal(pub.links[0].label, "Portfolio");
});

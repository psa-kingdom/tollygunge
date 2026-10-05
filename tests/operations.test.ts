import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationInput,
  contentInput,
  eventInput,
  pageSections,
  webLink,
} from "../src/domain/operations";
test("CMS preserves sitemap anchors and rejects unsafe sources and unattributed long news", () => {
  const body = {
    title: "Association update",
    intro: "Introduction",
    sections: pageSections.about.map((title) => ({
      title,
      text: "Approved association copy.",
    })),
    sourceUrl: "",
    attribution: "",
  };
  assert.equal(
    contentInput({ kind: "page", slug: "about", version: 0, body }).body
      .sections.length,
    3,
  );
  assert.throws(() =>
    contentInput({
      kind: "page",
      slug: "about",
      version: 0,
      body: { ...body, sections: body.sections.slice(1) },
    }),
  );
  assert.throws(() =>
    contentInput({ kind: "news", slug: "update", version: 0, body }),
  );
  assert.throws(() => webLink("javascript:alert(1)"));
  assert.throws(() => webLink("https://user:password@example.org/"));
  assert.throws(() =>
    contentInput({
      kind: "news",
      slug: "update",
      version: 0,
      body: {
        ...body,
        sourceUrl: "https://example.org",
        attribution: "Original publisher",
        sections: [
          { title: "Update", text: "a".repeat(1500) },
          { title: "Context", text: "b".repeat(1500) },
        ],
      },
    }),
  );
});
test("application drafts strip identity/status/payment fields and events cannot enable unapproved fees or hours", () => {
  const input = applicationInput({
    plan: "Annual",
    category: "Student",
    version: 0,
    documentIds: [],
    details: {
      fullName: "Student",
      institution: "College",
      userId: "forged",
      approved: true,
    },
    userId: "forged",
    status: "approved",
  });
  assert.equal(input.details.fullName, "Student");
  assert.equal("approved" in input.details, false);
  assert.equal("userId" in input, false);
  const event = {
    version: 0,
    title: "Learning event",
    location: "Kolkata",
    description: "Discussion",
    startsAt: "2027-01-01T10:00:00+05:30",
    endsAt: "2027-01-01T11:00:00+05:30",
    capacity: 1,
  };
  assert.equal(eventInput(event).capacity, 1);
  assert.throws(() => eventInput({ ...event, price: 100 }));
  assert.throws(() => eventInput({ ...event, learningHours: 1 }));
  assert.throws(() => eventInput({ ...event, endsAt: event.startsAt }));
});

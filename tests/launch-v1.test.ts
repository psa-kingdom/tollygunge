import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticRoute, issueDiagnostics, issueMessage } from "../src/domain/issue-report";
import { publicMetadata, safeJsonLd } from "../src/domain/public-metadata";
import { publicInquiry } from "../src/domain/inquiries";

test("issue diagnostics exclude tokens, search terms, identities and full user agents", () => {
  assert.equal(diagnosticRoute("/events/04b53e70-31fd-4e4b-b738-b606ff1560aa?token=secret#private"), "/events/[id]");
  assert.equal(diagnosticRoute("/resources/private-slug?email=private@example.invalid"), "/resources/[slug]");
  assert.equal(diagnosticRoute("https://external.example/private"), "/other");
  const context = issueDiagnostics("/member/application?token=secret", "Mozilla/5.0 Secret device Chrome/150.0", 390, 844);
  assert.ok(context.includes("Page: /member/application")); assert.ok(context.includes("Browser: Chrome"));
  assert.ok(!/secret|Mozilla|150\.0|token=/.test(context));
  assert.equal(issueMessage("My report", context, false), "My report");
  assert.ok(issueMessage("My report", context, true).includes(context));
});
test("website issue topic uses the existing General category plus existing CRM tags without altering normal payloads", () => {
  const input = { submissionId: "04b53e70-31fd-4e4b-b738-b606ff1560aa", name: "Synthetic reporter", email: "reporter@example.invalid", topic: "General", subject: "Question", message: "A normal inquiry for the association.", preference: "email", source: "contact", consent: true };
  const normal = publicInquiry(input);
  assert.equal(normal.topic, "General"); assert.ok(!("websiteIssue" in normal));
  const issue = publicInquiry({ ...input, topic: "Website issue" });
  assert.equal(issue.topic, "General"); assert.equal(issue.websiteIssue, true);
  assert.equal(issue.message, input.message);
});
test("public metadata has page-specific canonical URLs and JSON-LD cannot close a script", () => {
  const result = publicMetadata("/about", "About TPA", "<b>About</b>   our association.");
  assert.equal(result.alternates?.canonical, "https://tpassociation.org/about");
  assert.equal(result.description, "About our association.");
  assert.ok(!safeJsonLd({ name: "</script><script>bad()</script>" }).includes("<"));
});

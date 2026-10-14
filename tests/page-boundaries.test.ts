import test from "node:test";
import assert from "node:assert/strict";
import { assertPageRedirect } from "./helpers/page-boundaries";
function page(body: string, status = 200, location?: string) {
  const response = new Response(body, { status, headers: location ? { location } : {} });
  Object.defineProperty(response, "url", { value: "https://tpa.example/member" });
  return response;
}
test("protected page accepts Next HTTP redirect to login", async () => {
  await assertPageRedirect(page("", 307, "/login"), "/login");
});
test("protected page accepts exact same-origin Next streamed login redirect", async () => {
  await assertPageRedirect(page('<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/login"/>'), "/login");
});
test("protected page rejects an ordinary successful page", async () => {
  await assert.rejects(assertPageRedirect(page("Member account content"), "/login"));
});
test("protected page rejects a streamed redirect to a different destination", async () => {
  await assert.rejects(assertPageRedirect(page('<meta id="__next-page-redirect" content="1;url=/member"/>'), "/login"));
});
test("protected page rejects a cross-origin streamed login redirect", async () => {
  await assert.rejects(assertPageRedirect(page('<meta id="__next-page-redirect" content="1;url=https://external.example/login"/>'), "/login"));
});
test("protected page rejects a redirect status without a destination", async () => {
  await assert.rejects(assertPageRedirect(page("", 307), "/login"));
});

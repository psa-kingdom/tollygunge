import assert from "node:assert/strict";

/** Loading boundaries can send headers before Next resolves a page decision.
 * API tests must continue asserting their exact authorization status codes. */
export async function assertPageNotFound(response: Response, privateText?: string) {
  assert.ok([200, 404].includes(response.status), `Unexpected unavailable-page status: ${response.status}`);
  const html = await response.text();
  assert.ok(html.includes("A little off the beaten path."), "Must render the unavailable page");
  assert.match(html, /name="robots" content="noindex[^"]*"/);
  if (privateText) assert.ok(!html.includes(privateText), "Private content must not appear in unavailable HTML");
}

export async function assertPageRedirect(response: Response, destination: string) {
  const location = response.headers.get("location");
  if (location) {
    assert.ok([303, 307, 308].includes(response.status));
    assert.equal(new URL(location, response.url).pathname, destination);
    return;
  }
  assert.equal(response.status, 200, "Only a streamed page may redirect without a Location header");
  const html = await response.text();
  const meta = html.match(/<meta\b[^>]*id="__next-page-redirect"[^>]*>/)?.[0];
  assert.ok(meta, "Streamed page must emit Next's redirect metadata");
  const target = meta.match(/content="[01];url=([^"]+)"/)?.[1];
  assert.ok(target);
  const url = new URL(target.replaceAll("&amp;", "&"), response.url);
  assert.equal(url.origin, new URL(response.url).origin);
  assert.equal(url.pathname, destination);
}

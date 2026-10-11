import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { appearanceBootstrap } from "../src/domain/appearance";
import {
  permittedSearchSources,
  searchPattern,
} from "../src/domain/workspace-search";
test("appearance separates preference from resolved mode and follows cross-tab/OS changes", () => {
  let value: string | null = null,
    dark = true;
  const handlers: Record<string, () => void> = {};
  const root = {
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  };
  const media = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, fn: () => void) => (handlers.os = fn),
  };
  runInNewContext(appearanceBootstrap, {
    document: { documentElement: root },
    localStorage: { getItem: () => value },
    matchMedia: () => media,
    addEventListener: (key: string, fn: () => void) => (handlers[key] = fn),
  });
  assert.equal(root.dataset.mode, "system");
  assert.equal(root.dataset.colorMode, "dark");
  value = JSON.stringify({ theme: "future", mode: "light" });
  handlers.storage();
  assert.equal(root.dataset.theme, "tpa");
  assert.equal(root.dataset.mode, "light");
  dark = false;
  handlers.os();
  dark = true;
  handlers.os();
  assert.equal(root.dataset.colorMode, "light");
  value = '{"mode":"system"}';
  handlers.storage();
  assert.equal(root.dataset.colorMode, "dark");
  dark = false;
  handlers.os();
  assert.equal(root.dataset.colorMode, "light");
  value = "broken";
  handlers.storage();
  assert.equal(root.dataset.mode, "system");
});
test("search permissions exclude unrelated record sources for every staff role", () => {
  const expected: Record<string, string[]> = {
    membership_reviewer: ["Members", "Verification", "Documents", "Governance"],
    content_editor: ["Content", "Media", "Governance", "News sources"],
    event_operator: ["Events", "Flyers"],
    communications_operator: [
      "Inquiries",
      "Inbox",
      "Campaigns",
      "Email templates",
    ],
    finance_operator: [],
  };
  for (const [role, groups] of Object.entries(expected))
    assert.deepEqual(
      permittedSearchSources([role]).map((s) => s.group),
      groups,
    );
  assert.deepEqual(permittedSearchSources([]), []);
  assert.equal(permittedSearchSources(["administrator"]).length, 14);
  for (const source of permittedSearchSources(["administrator"])) {
    assert.match(source.sql, /LIMIT 4/);
    assert.doesNotMatch(
      source.sql,
      /token|password|payload|object_key|secret/i,
    );
  }
  assert.equal(searchPattern("a%_\\b"), "%a\\%\\_\\\\b%");
});
test("semantic foregrounds meet readable contrast in both modes", () => {
  function luminance(hex: string) {
    const channels = hex
      .match(/[a-f\d]{2}/gi)!
      .map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  for (const [foreground, background] of [
    ["#192e3e", "#ffffff"],
    ["#626d74", "#f0eee7"],
    ["#e6edf3", "#192936"],
    ["#b2bec9", "#223441"],
    ["#91d8b7", "#183d31"],
    ["#f1ce86", "#42391e"],
    ["#a3cde9", "#1d374c"],
    ["#c5dce9", "#192936"],
  ]) {
    const a = luminance(foreground),
      b = luminance(background);
    assert.ok(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5,
      `${foreground} on ${background}`,
    );
  }
});

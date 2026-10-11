import test from "node:test";
import assert from "node:assert/strict";
import { csvRows, historyPreview } from "../src/domain/history-import";
test("history CSV handles quoted commas/newlines and rejects malformed quoting and headers", () => {
  assert.deepEqual(csvRows('a,b\r\n"one,two","line\none"\r\n'), [
    ["a", "b"],
    ["one,two", "line\none"],
  ]);
  assert.deepEqual(csvRows('a\n"a""b"'), [["a"], ['a"b']]);
  assert.throws(() => csvRows('a\n"unfinished'));
  assert.throws(() => csvRows('a\n"done"extra'));
  assert.throws(() => historyPreview("name,event,date\na,b,c"));
});
test("history duplicates flag every occurrence and timestamps require a timezone", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  const rows = historyPreview(
    `email,event_id,attended_at\nA@example.org,${id},2025-01-01T10:00:00Z\na@example.org,${id},2025-01-01T10:00:00Z`,
  );
  assert.ok(
    rows.every((row) =>
      row.errors.some((error) => error.startsWith("Duplicate")),
    ),
  );
  assert.ok(
    historyPreview(
      `email,event_id,attended_at\na@example.org,${id},2025-01-01T10:00:00`,
    )[0].errors.length,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { portraitObjectKey } from "../src/domain/portrait-storage";

test("portrait keys stay within their own validated namespace", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(portraitObjectKey(id), `tpa/portraits/${id}.webp`);
  for (const invalid of ["../private/object", "", id + "/../object"])
    assert.throws(() => portraitObjectKey(invalid));
});

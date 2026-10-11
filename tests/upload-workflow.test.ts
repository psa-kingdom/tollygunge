import test from "node:test";
import assert from "node:assert/strict";
import {
  uploadWithCleanup,
  UploadFailure,
} from "../src/domain/upload-workflow";
test("failed storage and failed metadata persistence both compensate with object cleanup", async () => {
  for (const failure of ["store", "persist"]) {
    const calls: string[] = [];
    await assert.rejects(
      uploadWithCleanup({
        store: async () => {
          calls.push("store");
          if (failure === "store") throw new Error();
        },
        persist: async () => {
          calls.push("persist");
          throw new Error();
        },
        remove: async () => {
          calls.push("remove");
        },
      }),
      (error) => error instanceof UploadFailure && !error.cleanupFailed,
    );
    assert.deepEqual(
      calls,
      failure === "store"
        ? ["store", "remove"]
        : ["store", "persist", "remove"],
    );
  }
});
test("cleanup failures are signalled for reconciliation and successful uploads retain objects", async () => {
  await assert.rejects(
    uploadWithCleanup({
      store: async () => {
        throw new Error();
      },
      persist: async () => {},
      remove: async () => {
        throw new Error();
      },
    }),
    (error) => error instanceof UploadFailure && error.cleanupFailed,
  );
  let removed = false;
  await uploadWithCleanup({
    store: async () => {},
    persist: async () => {},
    remove: async () => {
      removed = true;
    },
  });
  assert.equal(removed, false);
});

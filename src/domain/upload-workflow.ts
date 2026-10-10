export class UploadFailure extends Error {
  constructor(public readonly cleanupFailed: boolean) {
    super("Private upload did not complete.");
  }
}
// R2 and PostgreSQL cannot share a transaction. Compensate failed persistence with deletion.
export async function uploadWithCleanup(operations: {
  store: () => Promise<void>;
  persist: () => Promise<void>;
  remove: () => Promise<void>;
}) {
  try {
    await operations.store();
    await operations.persist();
  } catch {
    let cleanupFailed = false;
    try {
      await operations.remove();
    } catch {
      cleanupFailed = true;
    }
    throw new UploadFailure(cleanupFailed);
  }
}

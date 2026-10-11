const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("tpa-draft-recovery", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("drafts");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function recovery(
  key: string,
  value?: unknown,
  expected?: unknown,
) {
  const db = await database();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite"),
        store = tx.objectStore("drafts");
      const request =
        value === undefined
          ? store.get(key)
          : value === null
            ? expected === undefined
              ? store.delete(key)
              : store.get(key)
            : store.put({ value, at: Date.now() }, key);
      let result: unknown;
      request.onsuccess = () => {
        const r = request.result;
        if (value === null && expected !== undefined) {
          if (r && JSON.stringify(r.value) === JSON.stringify(expected))
            store.delete(key);
          result = null;
          return;
        }
        result =
          r && Date.now() - r.at < 86400000
            ? { ...r.value, recoveryAt: r.at }
            : null;
        if (value === undefined && r && Date.now() - r.at >= 86400000)
          store.delete(key);
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function clearRecovery() {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite");
      tx.objectStore("drafts").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

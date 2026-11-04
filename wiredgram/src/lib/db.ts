/** Minimal IndexedDB wrapper: two stores — `kv` for JSON state, `blobs` for
 *  user media (avatars, wallpapers, attachments). No dependencies, no ORM. */

const DB_NAME = "wiredgram";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(store: "kv" | "blobs", mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return await tx<T>("kv", "readonly", (s) => s.get(key) as IDBRequest<T>);
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await tx("kv", "readwrite", (s) => s.put(value, key) as IDBRequest<IDBValidKey>);
  } catch {
    /* storage may be unavailable in private mode — the app still works */
  }
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  await tx("blobs", "readwrite", (s) => s.put(blob, id) as IDBRequest<IDBValidKey>);
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  try {
    return await tx<Blob | undefined>("blobs", "readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
  } catch {
    return undefined;
  }
}

export async function deleteBlob(id: string): Promise<void> {
  try {
    await tx("blobs", "readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}

export async function listBlobKeys(): Promise<string[]> {
  try {
    const keys = await tx<IDBValidKey[]>("blobs", "readonly", (s) => s.getAllKeys());
    return keys.map(String);
  } catch {
    return [];
  }
}

export async function blobKeysSize(): Promise<number> {
  try {
    const blobs = await tx<Blob[]>("blobs", "readonly", (s) => s.getAll());
    return blobs.reduce((sum, b) => sum + (b?.size ?? 0), 0);
  } catch {
    return 0;
  }
}

export async function clearBlobs(): Promise<void> {
  try {
    await tx("blobs", "readwrite", (s) => s.clear() as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}

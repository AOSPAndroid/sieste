import type { AthleteData } from "./analytics";

export const SNAPSHOT_TTL = 14 * 86400000;
const MAX_BYTES = 15 * 1024 * 1024;
const DATABASE = "sieste-device-cache";
const STORE = "dashboards";
type Snapshot = {
  version: 1;
  scope: string;
  savedAt: number;
  expiresAt: number;
  data: AthleteData;
};
let activeScope: string | null = null,
  generation = 0,
  database: Promise<IDBDatabase | null> | null = null;

export function validDashboard(value: unknown): value is AthleteData {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<AthleteData>;
  return (
    Array.isArray(d.activities) &&
    !!d.sleep &&
    typeof d.sleep === "object" &&
    !Array.isArray(d.sleep) &&
    !!d.hrv &&
    typeof d.hrv === "object" &&
    !Array.isArray(d.hrv)
  );
}
function openDatabase() {
  if (database) return database;
  database = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (db: IDBDatabase | null) => {
      if (done) {
        db?.close();
        return;
      }
      done = true;
      clearTimeout(timer);
      resolve(db);
    };
    const timer = setTimeout(() => finish(null), 1000);
    try {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE, { keyPath: "scope" });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = null;
        };
        finish(db);
      };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });
  return database;
}
function transaction(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => void,
) {
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      work(tx.objectStore(STORE));
    } catch {
      resolve(false);
    }
  });
}

// Only the verified account/connection scope may read or write a snapshot.
export function activateSnapshotScope(scope: string | null) {
  if (scope === activeScope) return;
  activeScope = scope;
  generation++;
  if (scope)
    void (async () => {
      const epoch = generation,
        db = await openDatabase();
      if (!db || epoch !== generation || activeScope !== scope) return;
      await transaction(db, "readwrite", (store) => {
        const keys = store.getAllKeys();
        keys.onsuccess = () => {
          if (epoch !== generation || activeScope !== scope) return;
          for (const key of keys.result) if (key !== scope) store.delete(key);
        };
      });
    })();
}
export async function readDeviceSnapshot(
  scope: string,
  now = Date.now(),
): Promise<Snapshot | null> {
  if (!scope || scope !== activeScope) return null;
  const epoch = generation,
    db = await openDatabase();
  if (!db || epoch !== generation || scope !== activeScope) return null;
  let entry: Snapshot | undefined;
  const ok = await transaction(db, "readonly", (store) => {
    const request = store.get(scope);
    request.onsuccess = () => {
      entry = request.result;
    };
  });
  if (!ok || epoch !== generation || scope !== activeScope || !entry)
    return null;
  if (
    entry.version !== 1 ||
    entry.scope !== scope ||
    !Number.isFinite(entry.savedAt) ||
    entry.savedAt > now ||
    entry.expiresAt !== entry.savedAt + SNAPSHOT_TTL ||
    entry.expiresAt <= now ||
    !validDashboard(entry.data)
  ) {
    await transaction(db, "readwrite", (store) => store.delete(scope));
    return null;
  }
  return entry;
}
export async function writeDeviceSnapshot(
  scope: string,
  data: AthleteData,
  now = Date.now(),
) {
  if (!scope || scope !== activeScope || !validDashboard(data)) return false;
  const epoch = generation,
    db = await openDatabase();
  if (!db || epoch !== generation || scope !== activeScope) return false;
  try {
    // Account responses and credentials are never saved. Strip credential-shaped
    // fields defensively if a provider adds them to future snapshot metadata.
    const serialized = JSON.stringify(data, (key, value) =>
      key === "seriesSampled" ||
      /token|secret|password|authorization|credential|api.?key/i.test(key)
        ? undefined
        : value,
    );
    if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES)
      return false;
    const clean = JSON.parse(serialized) as AthleteData;
    if (epoch !== generation || scope !== activeScope) return false;
    return await transaction(db, "readwrite", (store) => {
      store.clear();
      store.put({
        version: 1,
        scope,
        savedAt: now,
        expiresAt: now + SNAPSHOT_TTL,
        data: clean,
      } satisfies Snapshot);
    });
  } catch {
    return false;
  }
}
export async function clearDeviceSnapshot() {
  activeScope = null;
  const epoch = ++generation;
  const db = await openDatabase();
  if (db && epoch === generation)
    await transaction(db, "readwrite", (store) => store.clear());
}

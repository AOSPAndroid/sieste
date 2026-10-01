import { readFileSync } from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
import { indexedDB, IDBDatabase } from "fake-indexeddb";
const urls = new Map();
function moduleUrl(name) {
  if (urls.has(name)) return urls.get(name);
  let source = ts.transpileModule(
    readFileSync(new URL("../app/" + name + ".ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText;
  source = source.replace(
    /from ['"]\.\/([^'"]+)['"]/g,
    (_, dep) => `from "${moduleUrl(dep)}"`,
  );
  const url =
    "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  urls.set(name, url);
  return url;
}
globalThis.indexedDB = indexedDB;
const {
  activateSnapshotScope,
  clearDeviceSnapshot,
  readDeviceSnapshot,
  writeDeviceSnapshot,
  SNAPSHOT_TTL,
} = await import(moduleUrl("device-snapshot-cache"));
const now = Date.now(),
  data = {
    activities: [
      { id: "old-run", date: "2025-01-01", sportType: "running" },
      { id: "recent", date: "2026-10-01", sportType: "running" },
    ],
    sleep: { 20260930: [28800] },
    hrv: { 20260930: [90] },
    syncedAt: new Date(now).toISOString(),
    extra: {
      token: "private",
      accessToken: "private",
      credentials: { private: true },
      coros: { daily: { 20260930: { steps: 10000 } } },
    },
  };
activateSnapshotScope("owner-a-connection-1");
assert.equal(
  await writeDeviceSnapshot("owner-a-connection-1", data, now),
  true,
);
let hit = await readDeviceSnapshot("owner-a-connection-1", now + 1);
assert.equal(hit.expiresAt - now, 14 * 86400000);
assert.equal(hit.savedAt, now);
assert.equal(
  hit.data.activities.length,
  2,
  "Full training history is retained",
);
assert.deepEqual(hit.data.sleep, data.sleep);
assert.equal(hit.data.extra.coros.daily["20260930"].steps, 10000);
assert.ok(
  !JSON.stringify(hit).includes("private"),
  "Credentials are never saved",
);
assert.ok(
  await readDeviceSnapshot("owner-a-connection-1", now + SNAPSHOT_TTL - 1),
);
assert.equal(
  await readDeviceSnapshot("owner-a-connection-1", now + SNAPSHOT_TTL),
  null,
  "Fourteen days expires the cache",
);
assert.equal(
  await readDeviceSnapshot("owner-a-connection-1", now + 1),
  null,
  "Expired entries are deleted",
);
await writeDeviceSnapshot("owner-a-connection-1", data, now);
activateSnapshotScope("owner-b");
assert.equal(await readDeviceSnapshot("owner-a-connection-1", now), null);
assert.equal(
  await writeDeviceSnapshot("owner-a-connection-1", data, now),
  false,
);
assert.equal(await writeDeviceSnapshot("owner-b", data, now), true);
assert.ok(await readDeviceSnapshot("owner-b", now));
activateSnapshotScope("owner-a-connection-1");
assert.equal(
  await readDeviceSnapshot("owner-a-connection-1", now),
  null,
  "Switching accounts removes prior snapshots",
);
const pending = writeDeviceSnapshot("owner-a-connection-1", data, now);
activateSnapshotScope("owner-a-connection-2");
assert.equal(
  await pending,
  false,
  "A previous connection cannot finish a pending write",
);
await writeDeviceSnapshot("owner-a-connection-2", data, now);
await clearDeviceSnapshot();
assert.equal(await readDeviceSnapshot("owner-a-connection-2", now), null);
assert.equal(
  await writeDeviceSnapshot("owner-a-connection-2", data, now),
  false,
  "Sign-out deactivates subsequent writes",
);
activateSnapshotScope("owner-a-connection-2");
const circular = { ...data };
circular.extra = circular;
assert.equal(
  await writeDeviceSnapshot("owner-a-connection-2", circular, now),
  false,
);
assert.equal(
  await writeDeviceSnapshot(
    "owner-a-connection-2",
    { ...data, extra: { notes: "x".repeat(16 * 1024 * 1024) } },
    now,
  ),
  false,
  "Device storage is bounded",
);
await writeDeviceSnapshot("owner-a-connection-2", data, now);
const original = IDBDatabase.prototype.transaction;
IDBDatabase.prototype.transaction = function () {
  throw new DOMException("Quota exceeded", "QuotaExceededError");
};
try {
  assert.equal(
    await writeDeviceSnapshot("owner-a-connection-2", data, now),
    false,
  );
  assert.equal(await readDeviceSnapshot("owner-a-connection-2", now), null);
} finally {
  IDBDatabase.prototype.transaction = original;
}
globalThis.indexedDB = undefined;
const unavailable = await import(
  moduleUrl("device-snapshot-cache") + "#no-storage"
);
unavailable.activateSnapshotScope("owner");
assert.equal(await unavailable.readDeviceSnapshot("owner"), null);
assert.equal(await unavailable.writeDeviceSnapshot("owner", data), false);
globalThis.indexedDB = indexedDB;
function isolated(file, names, bindings = {}) {
  const source = ts
    .transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(/^import .*;\s*$/gm, "")
    .replaceAll("export ", "");
  return new Function(
    ...Object.keys(bindings),
    source + ";return {" + names + "}",
  )(...Object.values(bindings));
}
const { seal, unseal } = isolated("db/token-crypto.ts", "seal,unseal"),
  { analysisIdentity } = isolated(
    "db/activity-analysis.ts",
    "analysisIdentity",
  ),
  { deviceCacheScope } = isolated(
    "db/device-cache-scope.ts",
    "deviceCacheScope",
    { analysisIdentity, unseal },
  );
const key = Buffer.alloc(32, 9).toString("base64"),
  first = {
    revision: "snapshot-1",
    token_ciphertext: await seal("training-token", key, "owner"),
  },
  second = {
    revision: "snapshot-2",
    token_ciphertext: await seal("training-token", key, "owner"),
  };
const scope = await deviceCacheScope(
  "owner",
  first,
  { revision: "coros-1" },
  key,
);
assert.equal(
  scope,
  await deviceCacheScope("owner", second, { revision: "coros-1" }, key),
);
assert.notEqual(
  scope,
  await deviceCacheScope("owner", first, { revision: "coros-2" }, key),
);
assert.notEqual(
  scope,
  await deviceCacheScope(
    "owner",
    { ...first, token_ciphertext: await seal("other-token", key, "owner") },
    { revision: "coros-1" },
    key,
  ),
);
assert.notEqual(
  await deviceCacheScope("owner-a", null, { revision: "coros-1" }, key),
  await deviceCacheScope("owner-b", null, { revision: "coros-1" }, key),
);
assert.ok(!scope.includes("training-token"));
activateSnapshotScope("owner-a-connection-2");
const streamed = {
  ...data,
  activities: data.activities.map((a) => ({
    ...a,
    seriesSampled: { sampleSize: 1, data: { cadence: [170, 171] } },
  })),
};
assert.equal(
  await writeDeviceSnapshot("owner-a-connection-2", streamed, now),
  true,
);
const compact = await readDeviceSnapshot("owner-a-connection-2", now);
assert.ok(
  compact.data.activities.every((a) => a.seriesSampled === undefined),
  "Raw sensor streams stay out of dashboard snapshots",
);
console.log(
  "Passed device cache: IndexedDB transactions, 14-day expiry, complete history, credential stripping, account/reconnect/sign-out isolation, stale writes, size/quota limits, unavailable storage and stable scopes.",
);

import { readFileSync } from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
function moduleUrl(name) {
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
  return (
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
}
const { restoreDashboard } = await import(moduleUrl("restore-dashboard"));
const account = {
    signedIn: true,
    userId: "A",
    name: "Athlete A",
    connected: true,
    corosConnected: true,
    cacheScope: "scope-a",
  },
  data = (id) => ({
    provider: "coros",
    activities: [{ id }],
    sleep: {},
    hrv: {},
    syncedAt: new Date().toISOString(),
  }),
  cached = data("cached"),
  saved = data("server"),
  fresh = data("fresh");
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function harness({
  metadata = account,
  metadataStatus = 200,
  state = { ...account, data: saved },
  serverStatus = 200,
  cachedData = cached,
  serverGate = null,
  cacheGate = null,
  failServer = false,
  failRefresh = false,
  cacheFailure = false,
  current = () => true,
} = {}) {
  const events = [],
    calls = [];
  const cache = {
    activate: (scope) => events.push(["activate", scope]),
    clear: async () => events.push(["clear"]),
    read: async () => {
      events.push(["read"]);
      if (cacheGate) await cacheGate.promise;
      if (cacheFailure) throw Error("Storage blocked");
      return cachedData ? { data: cachedData, savedAt: 100 } : null;
    },
  };
  const request = async (url, options) => {
    calls.push([url, options]);
    if (url === "/api/account")
      return Response.json(metadata, { status: metadataStatus });
    if (options.method !== "POST") {
      if (serverGate) await serverGate.promise;
      if (failServer) throw Error("Offline");
      return Response.json(state, { status: serverStatus });
    }
    if (failRefresh)
      return Response.json({ error: "Provider unavailable" }, { status: 503 });
    return Response.json(fresh);
  };
  const options = {
    cache,
    request,
    current,
    ...Object.fromEntries(
      [
        "onAccount",
        "onScope",
        "onData",
        "onReady",
        "onBusy",
        "onError",
        "onPhase",
      ].map((key) => [key, (...values) => events.push([key, ...values])]),
    ),
  };
  return { events, calls, task: restoreDashboard(options) };
}
const settle = () => new Promise((r) => setImmediate(r));
let gate = deferred(),
  s = harness({ serverGate: gate });
await settle();
assert.ok(
  s.events.some(
    ([key, value, at]) => key === "onData" && value === cached && at === 100,
  ),
  "Cached data renders before the server responds",
);
assert.ok(s.events.some(([key]) => key === "onReady"));
assert.deepEqual(
  s.calls.map((c) => c[0]),
  ["/api/account", "/api/sync"],
);
gate.resolve();
await s.task;
assert.equal(s.calls.length, 2, "Recent snapshots skip provider sync");
assert.ok(
  s.events.some(
    ([key, value, at]) =>
      key === "onData" && value.activities[0].id === "server" && at === null,
  ),
);
s = harness({
  state: {
    ...account,
    data: { ...saved, syncedAt: new Date(Date.now() - 600000).toISOString() },
  },
});
await s.task;
assert.equal(s.calls.length, 3, "Stale snapshots refresh");
assert.equal(JSON.parse(s.calls[2][1].body).token, "__saved__");
assert.ok(
  s.events.some(
    ([key, value]) => key === "onData" && value?.activities[0].id === "fresh",
  ),
);
s = harness({ failServer: true });
await s.task;
assert.equal(
  s.events.filter(([key, value]) => key === "onData" && value).at(-1)[1],
  cached,
);
assert.ok(
  s.events.some(
    ([key, value]) => key === "onError" && value.includes("saved dashboard"),
  ),
);
s = harness({
  state: {
    ...account,
    data: { ...saved, syncedAt: new Date(Date.now() - 600000).toISOString() },
  },
  failRefresh: true,
});
await s.task;
assert.equal(
  s.events.filter(([key, value]) => key === "onData" && value).at(-1)[1]
    .activities[0].id,
  "server",
);
gate = deferred();
s = harness({ cacheGate: gate });
await s.task;
assert.ok(
  s.events.some(
    ([key, value]) => key === "onData" && value.activities[0].id === "server",
  ),
  "Slow storage does not block the server",
);
gate.resolve();
await settle();
assert.ok(
  !s.events.some(([key, , at]) => key === "onData" && at === 100),
  "Late cache cannot overwrite fresh data",
);
s = harness({ cacheFailure: true });
await s.task;
assert.ok(
  s.events.some(
    ([key, value]) => key === "onData" && value.activities[0].id === "server",
  ),
);
s = harness({ metadata: { signedIn: false, connected: false } });
await s.task;
assert.equal(s.calls.length, 1);
assert.ok(s.events.some(([key]) => key === "clear"));
assert.ok(!s.events.some(([key]) => key === "read"));
s = harness({ state: { signedIn: false, connected: false } });
await s.task;
assert.ok(s.events.some(([key]) => key === "clear"));
assert.equal(s.events.filter(([key]) => key === "onData").at(-1)[1], null);
s = harness({ state: { ...account, userId: "B", data: data("private-b") } });
await s.task;
assert.ok(
  !s.events.some(
    ([key, value]) =>
      key === "onData" && value?.activities[0]?.id === "private-b",
  ),
);
assert.ok(s.events.some(([key]) => key === "clear"));
s = harness({ state: { ...account, connected: false, data: null } });
await s.task;
assert.ok(s.events.some(([key]) => key === "clear"));
assert.equal(s.events.filter(([key]) => key === "onData").at(-1)[1], null);
s = harness({
  metadataStatus: 503,
  metadata: { error: "Account unavailable" },
});
await s.task;
assert.ok(!s.events.some(([key]) => key === "read"));
s = harness({ cachedData: null, state: { ...account, data: null } });
await s.task;
assert.equal(s.calls.length, 3);
assert.ok(
  s.events.some(
    ([key, value]) => key === "onData" && value?.activities[0]?.id === "fresh",
  ),
);
s = harness({
  state: { ...account, data: { syncedAt: new Date().toISOString() } },
});
await s.task;
assert.equal(s.calls.length, 3, "Incomplete snapshots are not fresh");
let active = true;
gate = deferred();
s = harness({ current: () => active, serverGate: gate });
await settle();
active = false;
gate.resolve();
await s.task;
assert.ok(
  !s.events.some(
    ([key, value]) => key === "onData" && value?.activities[0]?.id === "server",
  ),
);
console.log(
  "Passed account restore: cached first paint, five-minute freshness, background refresh, failures, slow/blocked storage, account checks, sign-out/disconnect cleanup and stale request cancellation.",
);

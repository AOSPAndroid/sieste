import { readFileSync } from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
function compile(source) {
  return ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(/^import .*;\s*$/gm, "")
    .replaceAll("export ", "");
}
const privateJson = new Function(
  compile(readFileSync("db/storage.ts", "utf8")) + ";return privateJson",
)();
let user = null,
  queries = 0,
  scopeCalls = 0,
  fail = false;
const row = { revision: "connection-1", token_ciphertext: "encrypted" };
const bindings = {
  getChatGPTUser: async () => user,
  connection: async () => {
    queries++;
    if (fail) throw Error("DB unavailable");
    return row;
  },
  corosConnection: async () => {
    queries++;
    return null;
  },
  deviceCacheScope: async (owner, training) => {
    scopeCalls++;
    assert.equal(owner, "owner-a");
    assert.equal(training, row);
    return "opaque-scope";
  },
  privateJson,
  storage: () => ({
    key: "test-key",
    get bucket() {
      throw Error("Metadata must never fetch R2 snapshots");
    },
  }),
};
const GET = new Function(
  ...Object.keys(bindings),
  compile(readFileSync("app/api/account/route.ts", "utf8")) + ";return GET",
)(...Object.values(bindings));
let response = await GET();
assert.equal((await response.json()).signedIn, false);
assert.equal(queries, 0);
assert.equal(
  scopeCalls,
  0,
  "Anonymous requests do no connection or credential work",
);
user = { userId: "owner-a", displayName: "Athlete" };
response = await GET();
assert.equal(response.status, 200);
assert.equal(response.headers.get("Cache-Control"), "no-store, private");
const account = await response.json();
assert.equal(account.userId, "owner-a");
assert.equal(account.cacheScope, "opaque-scope");
assert.equal(account.connected, true);
assert.equal(queries, 2);
assert.ok(!JSON.stringify(account).includes("encrypted"));
assert.ok(!("data" in account), "Metadata does not download the dashboard");
fail = true;
assert.equal(
  (await GET()).status,
  503,
  "Identity checks fail explicitly rather than reading a previous cache",
);
const sync = readFileSync("app/api/sync/route.ts", "utf8"),
  source = compile(
    sync.slice(
      sync.indexOf("async function providerGET()"),
      sync.indexOf("async function providerPOST("),
    ),
  );
let upstreamStatus = 503;
const providerGET = new Function(
  "getChatGPTUser",
  "corosConnection",
  "tredict",
  "corosSnapshot",
  "combineProviders",
  "privateJson",
  "chatGPTSignOutPath",
  source + ";return providerGET",
)(
  async () => user,
  async () => null,
  {
    GET: async () =>
      Response.json(
        upstreamStatus === 200
          ? { connected: true, data: { activities: [], sleep: {}, hrv: {} } }
          : { error: "Snapshot storage failed" },
        { status: upstreamStatus },
      ),
  },
  async () => null,
  (training) => training,
  privateJson,
  () => "/signout-with-chatgpt",
);
assert.equal(
  (await providerGET()).status,
  503,
  "A transient snapshot error cannot masquerade as a disconnect and clear the device cache",
);
upstreamStatus = 200;
response = await providerGET();
assert.equal(
  (await response.json()).userId,
  "owner-a",
  "The full snapshot identifies the verified account",
);
console.log(
  "Passed account metadata: small authenticated response, no snapshot download, private response headers, anonymous isolation, explicit failures and authoritative snapshot identity.",
);

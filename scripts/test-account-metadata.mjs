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
const sync=compile(readFileSync("app/api/sync/route.ts","utf8"));
const responseHelpers=new Function(compile(readFileSync('app/api/sync/response.ts','utf8'))+';return {dashboardHeaders,dashboardJson,matchesDashboardEtag}')();
let upstreamStatus=503,snapshotReads=0;
const deps={
 getChatGPTUser:async()=>user,connection:async()=>row,corosConnection:async()=>null,
 tredict:{DELETE:()=>{},loadSavedTredictData:async()=>{snapshotReads++;if(upstreamStatus!==200)throw Error('Snapshot storage failed');return {activities:[],sleep:{},hrv:{}}}},
 corosSnapshot:async()=>null,combineProviders:training=>training,privateJson,chatGPTSignOutPath:()=>'/signout-with-chatgpt',
 dashboardEtag:async()=>'W/"private-revision"',activityMerges:async()=>[],applyMerges:data=>data,...responseHelpers,
};
const syncGET=new Function(...Object.keys(deps),sync+';return GET')(...Object.values(deps));
const request=(suffix='',headers={})=>new Request('https://sieste.example/api/sync'+suffix,{headers});
assert.equal((await syncGET(request())).status,503,'Storage failure cannot masquerade as a disconnect');
upstreamStatus=200;response=await syncGET(request());
assert.equal((await response.json()).userId,'owner-a');
assert.equal(response.headers.get('ETag'),'W/"private-revision"');
assert.equal(response.headers.get('Cache-Control'),'private, no-cache');
assert.equal(response.headers.get('Vary'),'Cookie, Accept-Encoding');
const count=snapshotReads;
response=await syncGET(request('',{'If-None-Match':'"private-revision"'}));
assert.equal(response.status,304);assert.equal(await response.text(),'');
assert.equal(snapshotReads,count,'Unchanged conditional load never fetches R2');
response=await syncGET(request('?changed=1'));
assert.equal((await response.json()).revision,'W/"private-revision"');
assert.equal(snapshotReads,count,'Changed check reads only indexed metadata');
console.log('Passed account metadata: private owner checks, explicit failures, parallel-ready saved data, ETag304 and snapshot-free changed checks.');

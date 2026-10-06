import {readFileSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Execute the real policy/orchestrator against SQLite's actual conditional writes,
// with provider refreshes and R2 replaced by controllable account-owned snapshots.
const source = file => ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}
}).outputText.replace(/^import .*;\s*$/gm, '').replaceAll('export ', '');
const load = (file, names, values = {}) => new Function(...Object.keys(values), source(file) + ';return {' + names.join(',') + '}')(...Object.values(values));
const policy = load('app/background-sync-policy.ts', ['allowedPushEndpoint', 'validPushSubscription', 'syncFingerprint']);
const {seal, unseal} = load('db/token-crypto.ts', ['seal', 'unseal']);
const {combineProviders} = load('app/provider-data.ts', ['combineProviders']);
const database = new DatabaseSync(':memory:');
for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
  database.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
}
let now = Date.parse('2026-10-06T12:00:00Z');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const objects = new Map();
const encryptionKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
let afterWrite;
const db = {prepare: sql => {
  const bound = (args = []) => ({
    sql, args,
    first: async () => database.prepare(sql).get(...args) ?? null,
    all: async () => ({results: database.prepare(sql).all(...args)}),
    run: async () => {
      const result = {meta: {changes: database.prepare(sql).run(...args).changes}};
      if (afterWrite) await afterWrite(sql, args, result);
      return result;
    }
  });
  return {...bound(), bind: (...args) => bound(args)};
}, batch: async statements => {
  database.exec('BEGIN');
  try {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    database.exec('COMMIT');
    return results;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}};
const bucket = {
  get: async key => objects.has(key) ? {json: async () => structuredClone(objects.get(key))} : null,
  put: async (key, value) => objects.set(key, typeof value === 'string' ? JSON.parse(value) : value),
  delete: async key => objects.delete(key)
};
const storage = () => ({db, bucket, key: encryptionKey});
const connection = async owner => database.prepare('SELECT * FROM athlete_connections WHERE owner=?').get(owner) ?? null;
const corosConnection = async owner => database.prepare('SELECT * FROM coros_connections WHERE owner=?').get(owner) ?? null;
const corosSnapshot = async row => row.snapshot_key && objects.get(row.snapshot_key) ? structuredClone(objects.get(row.snapshot_key)) : null;
let trainingHandler;
let healthHandler;
const env = {SYNC_VAPID_PUBLIC_KEY: 'public-test-key', SYNC_BRIDGE_TOKEN: 'private-test-worker-token'};
const apiNames = ['endpointId', 'settings', 'status', 'setSettings', 'queuePush', 'runDueSync', 'notificationJobs', 'delivered'];
const api = load('db/background-sync.ts', apiNames, {
  env, storage, connection, corosConnection, corosSnapshot, seal, unseal, combineProviders,
  syncFingerprint: policy.syncFingerprint, Date: Clock,
  syncStoredAccount: async (...args) => trainingHandler(...args),
  syncCoros: async (...args) => healthHandler(...args)
});
const privateJson = (value, status = 200) => Response.json(value, {status});
let user = {userId: 'alice'};
const origin = 'https://sieste.daaalil.chatgpt.site';
const route = load('app/api/background-sync/route.ts', ['GET', 'POST'], {
  getChatGPTUser: async () => user, privateJson,
  sameOrigin: request => request.headers.get('origin') === new URL(request.url).origin,
  status: api.status, setSettings: api.setSettings,
  allowedPushEndpoint: policy.allowedPushEndpoint, validPushSubscription: policy.validPushSubscription
});
const worker = load('app/api/background-sync/worker/route.ts', ['POST'], {
  env, privateJson, runDueSync: api.runDueSync, notificationJobs: api.notificationJobs, delivered: api.delivered
});
const post = (body, headers = {Origin: origin}) => new Request(origin + '/api/background-sync', {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
const workerPost = (body, token = env.SYNC_BRIDGE_TOKEN) => new Request(origin + '/api/background-sync/worker', {method: 'POST', headers: {Authorization: 'Bearer ' + token}, body: JSON.stringify(body)});
const snapshot = (distance = 10, extra = {}) => ({activities: [{id: 'workout', date: '2026-10-06T08:00:00Z', summary: {distance}}], sleep: {}, hrv: {}, syncedAt: new Clock().toISOString(), ...extra});
const subscription = suffix => ({endpoint: 'https://fcm.googleapis.com/fcm/send/' + suffix, keys: {p256dh: 'A'.repeat(87), auth: 'B'.repeat(22)}});
const jobRows = () => database.prepare('SELECT * FROM sync_notification_jobs ORDER BY created_at,id').all();
function reset() {
  database.exec('DELETE FROM sync_notification_jobs; DELETE FROM sync_push_subscriptions; DELETE FROM background_sync; DELETE FROM athlete_connections; DELETE FROM coros_connections; DELETE FROM sync_worker_health;');
  objects.clear(); afterWrite = undefined; trainingHandler = undefined; healthHandler = undefined;
}
async function connectTraining(owner, data = snapshot(), updatedAt = now - 600000) {
  const snapshotKey = owner + '/snapshot';
  objects.set(snapshotKey, data);
  database.prepare('INSERT INTO athlete_connections(owner,revision,token_ciphertext,snapshot_key,updated_at) VALUES(?,?,?,?,?)').run(owner, 'prior-' + owner, 'encrypted-token', snapshotKey, new Clock(updatedAt).toISOString());
}
async function connectHealth(owner, data) {
  const snapshotKey = data ? owner + '/health' : null;
  if (data) objects.set(snapshotKey, data);
  database.prepare('INSERT INTO coros_connections(owner,revision,credentials,region,snapshot_key,updated_at) VALUES(?,?,?,?,?,?)').run(owner, 'health-' + owner, 'encrypted-health-credentials', 'eu', snapshotKey, new Clock(now - 600000).toISOString());
}
async function enable(owner, fingerprint) {
  await api.setSettings(owner, {enabled: true, subscription: subscription(owner)});
  if (fingerprint !== undefined) database.prepare('UPDATE background_sync SET last_fingerprint=? WHERE owner=?').run(fingerprint, owner);
}
function makeDue(owner) { database.prepare('UPDATE background_sync SET next_run=0 WHERE owner=?').run(owner); }
function refreshedTraining(data) {
  return async owner => {
    const row = await connection(owner);
    objects.set(row.snapshot_key, structuredClone(data));
    database.prepare('UPDATE athlete_connections SET revision=?,updated_at=? WHERE owner=?').run('fresh-' + crypto.randomUUID(), new Clock().toISOString(), owner);
    return Response.json(data, {headers: {'X-Sync-Refreshed': 'true'}});
  };
}

for (const endpoint of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.attacker.test/x', 'https://attacker.test@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://evil-push.apple.com/x', 'https://fcm.googleapis.com/x#undeliverable']) {
  assert.equal(policy.allowedPushEndpoint(endpoint), false, 'Untrusted endpoint cannot reach the bridge: ' + endpoint);
}
for (const endpoint of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://db5p.notify.windows.com/x']) assert.equal(policy.allowedPushEndpoint(endpoint), true);
assert.equal(policy.validPushSubscription(subscription('valid')), true);
assert.equal(policy.validPushSubscription({...subscription('bad'), keys: {p256dh: 'x', auth: 'bad'}}), false);
const baseline = snapshot(10);
assert.equal(policy.syncFingerprint(baseline), policy.syncFingerprint({...baseline, syncedAt: '2030-01-01', warnings: ['temporary']}), 'Sync timestamps and warnings are not new health data');
assert.notEqual(policy.syncFingerprint(baseline), policy.syncFingerprint(snapshot(11)), 'A real workout change is new data');
const two = {...baseline, activities: [...baseline.activities, {id: 'other', date: '2026-10-05', summary: {distance: 4}}]};
assert.equal(policy.syncFingerprint(two), policy.syncFingerprint({...two, activities: [...two.activities].reverse()}), 'Provider ordering does not trigger a duplicate alert');
const oldProfile = {...baseline, extra: {bodyvalues: {bodyvalues: [{timestamp: '2026-10-06T08:00:00Z', weightInKilograms: 70, heightInCentimeters: 180, hrRestDynamic: 50}]}}};
const repeatedProfile = {...baseline, extra: {bodyvalues: {bodyvalues: [...oldProfile.extra.bodyvalues.bodyvalues, {timestamp: '2026-10-06T12:00:00Z', weightInKilograms: 70, heightInCentimeters: 180}]}}};
assert.equal(policy.syncFingerprint(oldProfile), policy.syncFingerprint(repeatedProfile), 'Repeated COROS profile capture alone does not generate an alert');
const changedResting = {...oldProfile, extra: {bodyvalues: {bodyvalues: [{...oldProfile.extra.bodyvalues.bodyvalues[0], hrRestDynamic: 51}]}}};
assert.notEqual(policy.syncFingerprint(oldProfile), policy.syncFingerprint(changedResting), 'New resting heart rate remains detectable');

assert.equal((await route.POST(post({enabled: true}, {Origin: 'https://attacker.test'}))).status, 403);
user = null;
assert.equal((await route.GET()).status, 401);
assert.equal((await route.POST(post({enabled: true}))).status, 401);
user = {userId: 'alice'};
assert.equal((await route.POST(post({subscription: {...subscription('evil'), endpoint: 'https://localhost/'}}))).status, 400);
assert.equal((await worker.POST(workerPost({op: 'tick'}, 'wrong-token'))).status, 401);
assert.equal(database.prepare('SELECT COUNT(*) AS n FROM sync_worker_health').get().n, 0, 'Rejected workers cannot claim or mark the PC online');
await assert.rejects(api.setSettings('alice', {enabled: true}), /Connect/);

// The subscription is encrypted and authentication never changes its owner.
await connectTraining('alice'); await connectTraining('bob');
await enable('alice'); await enable('bob');
const aliceSubscription = database.prepare('SELECT * FROM sync_push_subscriptions WHERE owner=?').get('alice');
assert.equal(aliceSubscription.subscription.includes('fcm.googleapis.com'), false);
assert.deepEqual(JSON.parse(await unseal(aliceSubscription.subscription, encryptionKey, 'alice:push')), subscription('alice'));
await assert.rejects(unseal(aliceSubscription.subscription, encryptionKey, 'bob:push'));
assert.equal((await api.status('alice')).subscriptions, 1);
await api.setSettings('alice', {removeEndpoint: subscription('bob').endpoint});
assert.equal((await api.status('bob')).subscriptions, 1, 'One user cannot remove another user’s endpoint');
trainingHandler = refreshedTraining(snapshot(12));
const result = await api.runDueSync(origin);
assert.equal(result.synced, true);
assert.equal(result.status, 'completed');
assert.equal(jobRows().length, 1);
assert.equal(jobRows()[0].owner, 'alice', 'Only the claimed account receives its completion notification');
assert.equal(JSON.stringify(JSON.parse(jobRows()[0].payload)).includes('distance'), false, 'Health data does not enter push payloads');
assert.equal((await api.settings('bob')).last_completed, null);
assert.equal((await api.status('alice')).workerOnline, true);
database.prepare('UPDATE background_sync SET enabled=0 WHERE owner=?').run('bob');
makeDue('alice'); trainingHandler = refreshedTraining(snapshot(12));
await api.runDueSync(origin);
assert.equal(jobRows().length, 1, 'Successful refreshes with identical data stay quiet');

// Delivery claims are single-use and stale acknowledgements cannot remove successors.
const firstJobs = await api.notificationJobs();
assert.equal(firstJobs.length, 1);
assert.equal((await api.notificationJobs()).length, 0, 'An active delivery claim cannot be claimed twice');
now += 181000;
const secondJobs = await api.notificationJobs();
assert.equal(secondJobs.length, 1);
assert.notEqual(secondJobs[0].claim, firstJobs[0].claim);
await api.delivered(firstJobs[0].id, firstJobs[0].claim, 201);
assert.equal(jobRows().length, 1, 'Stale claim cannot delete the new delivery');
await api.delivered(secondJobs[0].id, secondJobs[0].claim, 410);
assert.equal(jobRows().length, 0);
assert.equal((await api.status('alice')).subscriptions, 0);
assert.equal((await api.status('bob')).subscriptions, 1, 'Expired device cleanup stays within its owner');

reset(); await connectTraining('alice'); await enable('alice');
await api.setSettings('alice', {test: true});
const testPayload = JSON.parse(jobRows()[0].payload);
assert.equal(testPayload.type, 'sieste-sync-test');
assert.equal(Number.isFinite(Date.parse(testPayload.syncedAt)), true, 'Test payload carries the valid date required by the PC bridge');

// Cached/manual updates are not proof that this background run refreshed a provider.
reset(); await connectTraining('alice', snapshot(12), now - 500);
await enable('alice', policy.syncFingerprint(snapshot(10)));
trainingHandler = async owner => Response.json(objects.get((await connection(owner)).snapshot_key));
const cached = await api.runDueSync(origin);
assert.equal(cached.synced, false, 'A cached response following a recent manual sync is not fresh background work');
assert.equal(jobRows().length, 0, 'Cached data cannot generate a background completion alert');

// The first COROS snapshot must count as a refresh even with no prior date.
reset(); await connectHealth('alice'); await enable('alice');
const refreshHealth = async row => {
  const data = snapshot(0, {activities: [], sleep: {'20261006': [28800]}, provider: 'coros'});
  const key = row.owner + '/new-health'; objects.set(key, data);
  database.prepare('UPDATE coros_connections SET snapshot_key=?,updated_at=? WHERE owner=?').run(key, new Clock().toISOString(), row.owner);
  return data;
};
healthHandler = refreshHealth;
const firstHealth = await api.runDueSync(origin);
assert.equal(firstHealth.synced, true, 'A first COROS refresh is fresh without a previous snapshot timestamp');
assert.equal(jobRows().length, 1, 'The first available health readings generate a completion notification');

// A failed primary and successful fallback produce an honest partial alert.
reset(); await connectTraining('alice');
await connectHealth('alice', snapshot(0, {activities: [], sleep: {}, provider: 'coros', syncedAt: new Clock(now - 600000).toISOString()}));
await enable('alice'); trainingHandler = async () => { throw Error('private failure'); }; healthHandler = refreshHealth;
const mixed = await api.runDueSync(origin);
assert.equal(mixed.synced, true);
assert.equal(mixed.status, 'partial');
assert.equal(jobRows().length, 1);
assert.equal(JSON.parse(jobRows()[0].payload).status, 'partial', 'Successful fallback never masquerades as a complete provider refresh');

// A disconnected account can remove a notification device and turn checks off.
reset(); await connectTraining('alice'); await enable('alice');
database.prepare('DELETE FROM athlete_connections WHERE owner=?').run('alice');
const disconnected = await api.setSettings('alice', {removeEndpoint: subscription('alice').endpoint, intervalMinutes: 15});
assert.equal(disconnected.subscriptions, 0, 'Removing notification permissions remains possible after provider disconnect');
assert.equal(disconnected.intervalMinutes, 15);
assert.equal((await route.POST(post({enabled: false}))).status, 200);
assert.equal((await api.settings('alice')).enabled, 0);

// Disable during a provider request cancels its pending completion notification.
reset(); await connectTraining('alice'); await enable('alice');
trainingHandler = async owner => {
  await api.setSettings(owner, {enabled: false});
  return refreshedTraining(snapshot(13))(owner);
};
await api.runDueSync(origin);
assert.equal(jobRows().length, 0, 'Disabling while completion is queued prevents an alert');

// Completion and durable notifications commit together; enqueue failure can retry.
reset(); await connectTraining('alice'); await enable('alice');
await api.setSettings('alice', {subscription: subscription('alice-laptop')});
trainingHandler = refreshedTraining(snapshot(15));
let enqueues = 0;
afterWrite = async sql => {
  if (sql.startsWith('INSERT INTO sync_notification_jobs') && ++enqueues === 2) throw Error('Simulated D1 notification write failure');
};
await api.runDueSync(origin);
assert.equal(enqueues, 2, 'The regression actually exercises failure after a prior notification insert');
assert.equal(jobRows().length, 0, 'Atomic rollback removes any notification write from the failed completion');
assert.equal((await api.settings('alice')).last_fingerprint, policy.syncFingerprint(snapshot(10)), 'Failed enqueue does not consume the data change');
assert.equal((await api.settings('alice')).lease, null, 'Failed execution releases its own lease so recovery can proceed');
afterWrite = undefined; makeDue('alice');
await api.runDueSync(origin);
assert.equal(jobRows().length, 2, 'The next healthy check can notify every device about data whose enqueue failed');

// Provider errors preserve saved data, expose a partial outcome, and stay quiet.
reset(); await connectTraining('alice'); await enable('alice');
trainingHandler = async () => { throw Error('secret provider error'); };
const partial = await api.runDueSync(origin);
assert.equal(partial.synced, false);
assert.equal(partial.status, 'partial');
assert.equal(jobRows().length, 0);
assert.match((await api.status('alice')).lastError, /saved data remains/);
assert.equal((await api.status('alice')).lastError.includes('secret'), false);

// Overlapping scheduler requests cannot launch two provider refreshes for one user.
reset(); await connectTraining('alice'); await enable('alice');
let releaseProvider, startedProvider;
const providerGate = new Promise(resolve => {releaseProvider = resolve;});
const providerStarted = new Promise(resolve => {startedProvider = resolve;});
let refreshes = 0;
trainingHandler = async owner => { refreshes++; startedProvider(); await providerGate; return refreshedTraining(snapshot(14))(owner); };
const inFlightSync = api.runDueSync(origin);
await providerStarted;
assert.deepEqual(await api.runDueSync(origin), {synced: false}, 'Concurrent scheduler cannot claim an active account lease');
releaseProvider(); await inFlightSync;
assert.equal(refreshes, 1);
assert.equal(jobRows().length, 1, 'Only the lease holder can publish a completion');

// A taken-over execution never overwrites its successor or releases its lease.
reset(); await connectTraining('alice'); await enable('alice');
trainingHandler = async owner => {
  database.prepare('UPDATE background_sync SET lease=?,lease_until=? WHERE owner=?').run('successor', now + 600000, owner);
  return refreshedTraining(snapshot(14))(owner);
};
await api.runDueSync(origin);
assert.equal((await api.settings('alice')).lease, 'successor');
assert.equal((await api.settings('alice')).last_completed, null);
assert.equal(jobRows().length, 0);

database.close();
console.log('Background sync passed: endpoint safety, SQLite migrations, owner encryption/auth/isolation, changed-only alerts, cache truthfulness, initial COROS/partial outcomes, disconnected settings, atomic enqueue rollback/retry, disable/takeover fencing, delivery claims and expired-device cleanup.');

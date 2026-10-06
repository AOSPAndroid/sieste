import {readFileSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = file => ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}
}).outputText.replace(/^import .*;\s*$/gm, '').replaceAll('export ', '');
const {seal, unseal} = new Function(source('db/token-crypto.ts') + ';return {seal,unseal}')();
const database = new DatabaseSync(':memory:');
for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) {
  database.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
}
const encryptionKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
const storage = () => ({key: encryptionKey, db: {prepare: sql => {
  const bound = (args = []) => ({
    first: async () => database.prepare(sql).get(...args) ?? null,
    run: async () => ({meta: {changes: database.prepare(sql).run(...args).changes}})
  });
  return {...bound(), bind: (...args) => bound(args)};
}}});
const env = {GARMIN_CLIENT_ID: 'test-client', GARMIN_CLIENT_SECRET: 'test-client-secret'};
let user = {userId: 'alice'};
let remoteUser = 'garmin-alice';
let remotePermissions = ['ACTIVITY_EXPORT', 'HEALTH_EXPORT'];
let calls = [];
let fetchHandler;
const token = (access = 'test-access', refresh = 'test-refresh') => ({
  access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: 86400, refresh_token_expires_in: 7775998
});
const defaultFetch = async (url, options) => {
  if (url.endsWith('/oauth/token')) return Response.json(token());
  if (url.endsWith('/user/id')) return Response.json({userId: remoteUser});
  if (url.endsWith('/user/permissions')) return Response.json(remotePermissions);
  if (url.endsWith('/user/registration')) return new Response(null, {status: 204});
  throw new Error('Unexpected outbound endpoint');
};
const fetch = async (url, options) => {
  calls.push({url, options});
  return (fetchHandler ?? defaultFetch)(url, options);
};
const names = ['GARMIN_ORIGIN', 'GARMIN_AUTHORIZE', 'GARMIN_TOKEN', 'GARMIN_USER_API', 'GarminError', 'garminConfigured', 'garminConfig', 'garminSameOrigin', 'garminConnection', 'encodeGarminCredentials', 'decodeGarminCredentials', 'beginGarminAuthorization', 'consumeGarminAuthorization', 'completeGarminAuthorization', 'garminPermissions', 'garminTokenCredentials', 'accessGarminCredentials', 'disconnectGarmin', 'garminMetadata'];
const api = new Function('env', 'storage', 'seal', 'unseal', 'fetch', source('db/garmin.ts') + ';return {' + names.join(',') + '}')(env, storage, seal, unseal, fetch);
const privateJson = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'no-store, private'}});
const loadRoute = (file, methods) => new Function('getChatGPTUser', 'privateJson', ...names, source(file) + ';return {' + methods.join(',') + '}')(async () => user, privateJson, ...names.map(name => api[name]));
const connect = loadRoute('app/api/garmin/connect/route.ts', ['POST']);
const callback = loadRoute('app/api/garmin/callback/route.ts', ['GET']);
const account = loadRoute('app/api/garmin/route.ts', ['GET', 'DELETE']);
const origin = api.GARMIN_ORIGIN;
const request = (path, method = 'POST', headers = {Origin: origin}) => new Request(origin + path, {method, headers});
const callbackRequest = (state, {cookie = state, code = 'test-code', error} = {}) => {
  const query = new URLSearchParams({state});
  if (code !== null) query.set('code', code);
  if (error) query.set('error', error);
  return new Request(origin + '/api/garmin/callback?' + query, {headers: {Cookie: 'sieste_garmin_state=' + cookie}});
};
const status = response => response.headers.get('Location');
const begin = owner => api.beginGarminAuthorization(owner, origin);
const rowCount = owner => database.prepare('SELECT count(*) AS count FROM garmin_connections WHERE owner = ?').get(owner).count;
const grant = async (owner, id) => {
  user = {userId: owner}; remoteUser = id;
  const started = await begin(owner);
  assert.equal(status(await callback.GET(callbackRequest(started.state))), '/?garmin=connected');
  return api.garminConnection(owner);
};

assert.equal((await connect.POST(request('/api/garmin/connect', 'POST', {Origin: 'https://attacker.test'}))).status, 403);
assert.equal((await connect.POST(request('/api/garmin/connect', 'POST', {}))).status, 403);
assert.equal((await account.DELETE(request('/api/garmin', 'DELETE', {Origin: 'https://attacker.test'}))).status, 403);
user = null;
assert.equal((await account.GET()).status, 401);
assert.equal((await connect.POST(request('/api/garmin/connect'))).status, 401);
assert.equal((await account.DELETE(request('/api/garmin', 'DELETE'))).status, 401);
user = {userId: 'alice'};
delete env.GARMIN_CLIENT_SECRET;
assert.equal((await connect.POST(request('/api/garmin/connect'))).status, 503);
assert.deepEqual(await (await account.GET()).json(), {configured: false, connected: false, permissions: [], dataSyncReady: false, updatedAt: null});
env.GARMIN_CLIENT_SECRET = 'test-client-secret';

const startedResponse = await connect.POST(request('/api/garmin/connect'));
const authorization = new URL((await startedResponse.json()).url);
assert.equal(authorization.origin + authorization.pathname, api.GARMIN_AUTHORIZE);
assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
assert.equal(authorization.searchParams.get('response_type'), 'code');
assert.equal(authorization.searchParams.get('redirect_uri'), origin + '/api/garmin/callback');
assert.equal(authorization.searchParams.has('scope'), false, 'Garmin scopes are not customizable');
assert.equal(authorization.href.includes(env.GARMIN_CLIENT_SECRET), false);
const state = authorization.searchParams.get('state');
assert.match(state, /^[A-Za-z0-9_-]{43}$/);
assert.match(startedResponse.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
const stateRow = database.prepare('SELECT * FROM garmin_oauth_states WHERE state = ?').get(state);
const decryptedPending = await api.decodeGarminCredentials('alice', stateRow.payload);
assert.match(decryptedPending.verifier, /^[A-Za-z0-9_-]{43}$/);
const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(decryptedPending.verifier))).toString('base64url');
assert.equal(challenge, authorization.searchParams.get('code_challenge'));
assert.ok(Date.parse(stateRow.expires) > Date.now() && Date.parse(stateRow.expires) <= Date.now() + 600000);
await assert.rejects(api.decodeGarminCredentials('bob', stateRow.payload));
assert.equal(status(await callback.GET(callbackRequest(state, {cookie: 'wrong'}))), '/?garmin=expired');
user = {userId: 'bob'};
assert.equal(status(await callback.GET(callbackRequest(state))), '/?garmin=expired');
assert.equal(calls.length, 0);
user = null;
assert.equal(status(await callback.GET(callbackRequest(state))), '/?garmin=signin');
user = {userId: 'alice'};
assert.equal(status(await callback.GET(callbackRequest(state))), '/?garmin=connected');
assert.equal(status(await callback.GET(callbackRequest(state))), '/?garmin=expired', 'Consumed state cannot replay');
assert.equal(calls.filter(call => call.url === api.GARMIN_TOKEN).length, 1);
assert.ok(calls.every(call => call.options.redirect === 'manual'), 'Provider redirects cannot leak credentials');
const exchanged = calls.find(call => call.url === api.GARMIN_TOKEN).options.body;
assert.equal(exchanged.get('client_secret'), env.GARMIN_CLIENT_SECRET);
assert.equal(exchanged.get('code_verifier'), decryptedPending.verifier);
let alice = await api.garminConnection('alice');
assert.equal(alice.user_id, 'garmin-alice');
assert.equal(alice.credentials.includes('test-access'), false);
assert.equal((await api.decodeGarminCredentials('alice', alice.credentials)).accessToken, 'test-access');
await assert.rejects(api.decodeGarminCredentials('bob', alice.credentials));
const metadata = await (await account.GET()).json();
assert.equal(metadata.connected, true); assert.equal(metadata.dataSyncReady, false);
assert.deepEqual(metadata.permissions, remotePermissions);
assert.equal(JSON.stringify(metadata).includes('test-access'), false);

let attempt = await begin('alice');
database.prepare('UPDATE garmin_oauth_states SET expires = ? WHERE state = ?').run('2000-01-01', attempt.state);
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=expired');
attempt = await begin('alice');
assert.equal(status(await callback.GET(callbackRequest(attempt.state, {error: 'access_denied', code: null}))), '/?garmin=cancelled');
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=expired');
attempt = await begin('alice'); delete env.GARMIN_CLIENT_SECRET;
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=unconfigured');
env.GARMIN_CLIENT_SECRET = 'test-client-secret';
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=expired');

user = {userId: 'bob'}; remoteUser = 'garmin-alice';
attempt = await begin('bob');
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=failed');
assert.equal(rowCount('bob'), 0, 'One Garmin identity cannot belong to two local owners');
assert.equal((await api.garminConnection('alice')).revision, alice.revision);
assert.equal(calls.filter(call => call.options.method === 'DELETE').length, 0, 'Identity collision never revokes another owner');
user = {userId: 'alice'}; remoteUser = 'different-garmin-alice';
attempt = await begin('alice');
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=disconnect-first');
assert.equal((await api.garminConnection('alice')).user_id, 'garmin-alice', 'Switching identities preserves the existing account');
assert.ok(calls.some(call => call.url.endsWith('/registration') && call.options.method === 'DELETE'), 'Rejected unmapped identity has consent cleaned up');
user = {userId: 'bob'};
for (const response of [new Response('secret provider detail', {status: 500}), new Response('not-json'), Response.json({access_token: 'incomplete'})]) {
  attempt = await begin('bob'); fetchHandler = async () => response;
  const failed = await callback.GET(callbackRequest(attempt.state));
  assert.equal(status(failed), '/?garmin=failed');
  assert.equal(await failed.text(), '');
  assert.equal(rowCount('bob'), 0);
}
fetchHandler = undefined;
assert.throws(() => api.garminPermissions({unknown: ['HEALTH_EXPORT']}));
assert.deepEqual(api.garminPermissions({permissions: ['ACTIVITY_EXPORT', 'ACTIVITY_EXPORT']}), ['ACTIVITY_EXPORT']);
for (const invalid of [{...token(), expires_in: Infinity}, {...token(), refresh_token: null}, {...token(), refresh_token_expires_in: -1}, {...token(), token_type: 'unknown'}]) {
  assert.throws(() => api.garminTokenCredentials(invalid, 'test-client'));
}
user = {userId: 'identity-failure'};
attempt = await begin(user.userId); calls = [];
fetchHandler = async (url, options) => url.endsWith('/user/id') ? new Response('unknown identity', {status: 500}) : defaultFetch(url, options);
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=cleanup-required');
assert.equal(calls.some(call => call.options.method === 'DELETE'), false, 'Unknown identity cannot trigger speculative revocation');
fetchHandler = undefined;

const setExpired = async owner => {
  const current = await api.garminConnection(owner);
  const saved = await api.decodeGarminCredentials(owner, current.credentials);
  saved.expiresAt = Date.now() - 1;
  database.prepare('UPDATE garmin_connections SET credentials = ? WHERE owner = ?').run(await api.encodeGarminCredentials(owner, saved), owner);
  return api.garminConnection(owner);
};
alice = await setExpired('alice');
calls = [];
let releaseRefresh;
const refreshGate = new Promise(resolve => {releaseRefresh = resolve});
fetchHandler = async () => {await refreshGate; return Response.json(token('rotated-access', 'rotated-refresh'))};
const firstRefresh = api.accessGarminCredentials(alice);
while (!calls.length) await new Promise(resolve => setTimeout(resolve, 0));
const secondRefresh = api.accessGarminCredentials(alice);
const otherWorker = new Function('env', 'storage', 'seal', 'unseal', 'fetch', source('db/garmin.ts') + ';return {' + names.join(',') + '}')(env, storage, seal, unseal, fetch);
await assert.rejects(otherWorker.accessGarminCredentials(alice), error => error.status === 409, 'A separate worker cannot exchange the same rotating refresh token');
releaseRefresh();
const rotated = await Promise.all([firstRefresh, secondRefresh]);
assert.equal(calls.length, 1, 'Same-worker refreshes share one token exchange');
assert.equal(rotated[0].refreshToken, 'rotated-refresh');
assert.equal(rotated[1].accessToken, 'rotated-access');
assert.equal(calls[0].options.body.get('grant_type'), 'refresh_token');
assert.equal(calls[0].options.body.get('refresh_token'), 'test-refresh');
alice = await api.garminConnection('alice');
assert.equal(alice.refresh_lock, 0);
assert.equal((await api.decodeGarminCredentials('alice', alice.credentials)).refreshToken, 'rotated-refresh');
assert.ok(rotated[0].expiresAt > Date.now() + 86000000);
database.prepare('UPDATE garmin_connections SET refresh_lock = ? WHERE owner = ?').run(Date.now() + 60000, 'alice');
await assert.rejects(api.accessGarminCredentials(alice), error => error.status === 409, 'Another worker lease blocks access');
database.prepare('UPDATE garmin_connections SET refresh_lock = 0 WHERE owner = ?').run('alice');

alice = await setExpired('alice');
fetchHandler = async () => {
  database.prepare('UPDATE garmin_connections SET revision = ? WHERE owner = ?').run('replacement-revision', 'alice');
  return Response.json(token('must-not-save', 'must-not-save'));
};
await assert.rejects(api.accessGarminCredentials(alice), error => error.status === 409);
assert.equal((await api.garminConnection('alice')).credentials, alice.credentials, 'Revision guard rejects obsolete refresh');
database.prepare('UPDATE garmin_connections SET refresh_lock = 0 WHERE owner = ?').run('alice');
fetchHandler = undefined;

await grant('carol', 'garmin-carol');
user = {userId: 'carol'};
fetchHandler = async () => new Response('remote-failure', {status: 500});
assert.equal((await account.DELETE(request('/api/garmin', 'DELETE'))).status, 502);
assert.equal(rowCount('carol'), 1, 'Failed Garmin revoke never claims successful disconnect');
fetchHandler = undefined; calls = [];
assert.equal((await account.DELETE(request('/api/garmin', 'DELETE'))).status, 200);
assert.equal(rowCount('carol'), 0);
assert.ok(calls.some(call => call.url === api.GARMIN_USER_API + '/registration' && call.options.method === 'DELETE'));
assert.equal((await account.DELETE(request('/api/garmin', 'DELETE'))).status, 200, 'Disconnect is locally idempotent');

await grant('hannah', 'garmin-hannah'); calls = [];
let deleteAttempts = 0;
fetchHandler = async (url, options) => {
  if (url.endsWith('/registration')) return new Response(null, {status: ++deleteAttempts === 1 ? 401 : 204});
  if (url === api.GARMIN_TOKEN) return Response.json(token('revoke-refreshed', 'revoke-rotated'));
  return defaultFetch(url, options);
};
await api.disconnectGarmin('hannah');
assert.equal(deleteAttempts, 2, 'Unauthorized registration delete retries once after refresh');
assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer revoke-refreshed');
assert.equal(rowCount('hannah'), 0);
fetchHandler = undefined;

// A disconnect must fence callbacks even when no connection row exists yet.
user = {userId: 'dana'}; remoteUser = 'garmin-dana';
attempt = await begin('dana');
let releaseExchange;
const exchangeGate = new Promise(resolve => {releaseExchange = resolve});
calls = [];
fetchHandler = async (url, options) => {if (url === api.GARMIN_TOKEN) await exchangeGate; return defaultFetch(url, options)};
const lateCallback = callback.GET(callbackRequest(attempt.state));
while (!calls.length) await new Promise(resolve => setTimeout(resolve, 0));
await api.disconnectGarmin('dana'); releaseExchange();
assert.equal(status(await lateCallback), '/?garmin=failed');
assert.equal(rowCount('dana'), 0, 'Late initial callback cannot reconnect after disconnect');
assert.ok(calls.some(call => call.url.endsWith('/registration') && call.options.method === 'DELETE'), 'Late rejected grant is deregistered');
fetchHandler = undefined;

// Cleanup and a concurrent authorization share a cross-worker operation lease.
await grant('harriet', 'garmin-harriet');
attempt = await begin('harriet'); remoteUser = 'rejected-garmin-harriet'; calls = [];
let releaseRevoke;
const revokeGate = new Promise(resolve => {releaseRevoke = resolve});
fetchHandler = async (url, options) => {if (url.endsWith('/registration')) await revokeGate; return defaultFetch(url, options)};
const switching = callback.GET(callbackRequest(attempt.state));
while (!calls.some(call => call.options.method === 'DELETE')) await new Promise(resolve => setTimeout(resolve, 0));
const exchangesBefore = calls.filter(call => call.url === api.GARMIN_TOKEN).length;
user = {userId: 'isaac'};
const concurrent = await begin('isaac');
assert.equal(status(await callback.GET(callbackRequest(concurrent.state))), '/?garmin=failed');
assert.equal(calls.filter(call => call.url === api.GARMIN_TOKEN).length, exchangesBefore, 'Cleanup lease blocks concurrent token issuance/finalization');
assert.equal(rowCount('isaac'), 0);
await assert.rejects(api.disconnectGarmin('harriet'), error => error.status === 409, 'Revoke cannot overlap authorization cleanup');
releaseRevoke();
assert.equal(status(await switching), '/?garmin=disconnect-first');
assert.equal((await api.garminConnection('harriet')).user_id, 'garmin-harriet');
fetchHandler = undefined;

// An expired/taken-over auth operation cannot publish credentials or release its successor lease.
user = {userId: 'lease-takeover'}; remoteUser = 'garmin-lease-takeover';
attempt = await begin(user.userId); calls = [];
fetchHandler = async (url, options) => {
  if (url === api.GARMIN_TOKEN) database.prepare("UPDATE garmin_oauth_operations SET lease_token = 'successor', expires = ? WHERE id = 'authorization'").run(Date.now() + 180000);
  return defaultFetch(url, options);
};
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=cleanup-required');
assert.equal(rowCount('lease-takeover'), 0);
assert.equal(calls.some(call => call.options.method === 'DELETE'), false, 'Lost operation lease forbids provider revocation');
assert.equal(database.prepare("SELECT lease_token FROM garmin_oauth_operations WHERE id = 'authorization'").get().lease_token, 'successor');
database.prepare('DELETE FROM garmin_oauth_operations').run();
fetchHandler = undefined;

user = {userId: 'fran'}; remoteUser = 'garmin-fran';
attempt = await begin('fran');
let releaseCleanupExchange;
const cleanupGate = new Promise(resolve => {releaseCleanupExchange = resolve});
calls = [];
fetchHandler = async (url, options) => {
  if (url === api.GARMIN_TOKEN) await cleanupGate;
  if (url.endsWith('/registration')) return new Response('cleanup failed secret detail', {status: 500});
  return defaultFetch(url, options);
};
const cleanupCallback = callback.GET(callbackRequest(attempt.state));
while (!calls.length) await new Promise(resolve => setTimeout(resolve, 0));
await api.disconnectGarmin('fran'); releaseCleanupExchange();
assert.equal(status(await cleanupCallback), '/?garmin=cleanup-required', 'Actual provider cleanup failure is surfaced explicitly');
assert.equal(rowCount('fran'), 0);
fetchHandler = undefined;

// A rejected old callback must not delete consent belonging to a newer attempt.
user = {userId: 'gina'}; remoteUser = 'garmin-gina';
attempt = await begin('gina');
let releaseSupersededExchange;
const supersededGate = new Promise(resolve => {releaseSupersededExchange = resolve});
calls = [];
fetchHandler = async (url, options) => {if (url === api.GARMIN_TOKEN) await supersededGate; return defaultFetch(url, options)};
const supersededCallback = callback.GET(callbackRequest(attempt.state));
while (!calls.length) await new Promise(resolve => setTimeout(resolve, 0));
await begin('gina'); releaseSupersededExchange();
assert.equal(status(await supersededCallback), '/?garmin=failed');
assert.equal(calls.some(call => call.options.method === 'DELETE'), false, 'Newer pending consent is never deregistered by an obsolete callback');
fetchHandler = undefined;

await grant('erin', 'garmin-erin');
attempt = await begin('erin');
await api.disconnectGarmin('erin');
user = {userId: 'erin'};
assert.equal(status(await callback.GET(callbackRequest(attempt.state))), '/?garmin=expired');
assert.equal(rowCount('erin'), 0);

console.log('Garmin OAuth: SQLite migrations, PKCE/owner encryption, strict origin/auth, consent/state/expiry/replay, missing setup, sanitized errors, identity/switch isolation, rotating singleflight/cross-worker refresh, shared finalization/revoke leases and takeover fencing, verified revoke/retry and rejected-grant cleanup/disconnect races passed.');
database.close();

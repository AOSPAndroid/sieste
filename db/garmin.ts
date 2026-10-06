import {env} from 'cloudflare:workers';
import {storage} from './storage';
import {seal, unseal} from './token-crypto';

export const GARMIN_ORIGIN = 'https://sieste.daaalil.chatgpt.site';
export const GARMIN_AUTHORIZE = 'https://connect.garmin.com/oauth2Confirm';
export const GARMIN_TOKEN = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
export const GARMIN_USER_API = 'https://apis.garmin.com/wellness-api/rest/user';
const REFRESH_MARGIN = 600_000;
// Disconnect can make four sequential requests, each with a 20s deadline.
const LEASE_DURATION = 120_000;
const AUTH_LEASE_DURATION = 180_000;
type GarminAuthLease = {token: string; expires: number};

export class GarminError extends Error {
  constructor(message: string, public status = 502, public callbackStatus?: 'cleanup-required' | 'disconnect-first') {
    super(message);
  }
}

export type GarminConnection = {
  owner: string;
  revision: string;
  user_id: string;
  credentials: string;
  permissions: string;
  updated_at: string;
  refresh_lock: number;
};
export type GarminCredentials = {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
};
export type GarminPending = {
  verifier: string;
  redirectUri: string;
  clientId: string;
  generation: string;
  connectionRevision: string | null;
};

export function garminConfigured() {
  const bindings = env as unknown as {GARMIN_CLIENT_ID?: string; GARMIN_CLIENT_SECRET?: string};
  return !!(bindings.GARMIN_CLIENT_ID?.trim() && bindings.GARMIN_CLIENT_SECRET?.trim());
}

export function garminConfig() {
  const bindings = env as unknown as {GARMIN_CLIENT_ID?: string; GARMIN_CLIENT_SECRET?: string};
  const clientId = bindings.GARMIN_CLIENT_ID?.trim();
  const clientSecret = bindings.GARMIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new GarminError('Garmin setup is pending. Approved app credentials are required.', 503);
  }
  return {clientId, clientSecret};
}

export function garminSameOrigin(request: Request) {
  return new URL(request.url).origin === GARMIN_ORIGIN && request.headers.get('origin') === GARMIN_ORIGIN;
}

export function garminConnection(owner: string) {
  return storage().db.prepare('SELECT * FROM garmin_connections WHERE owner = ?')
    .bind(owner).first<GarminConnection>();
}

export function encodeGarminCredentials(owner: string, value: unknown) {
  return seal(JSON.stringify(value), storage().key, owner + ':garmin');
}

export async function decodeGarminCredentials<T>(owner: string, value: string): Promise<T> {
  return JSON.parse(await unseal(value, storage().key, owner + ':garmin'));
}

function base64url(value: Uint8Array) {
  return btoa(Array.from(value, byte => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function beginGarminAuthorization(owner: string, origin: string) {
  const {clientId} = garminConfig();
  if (origin !== GARMIN_ORIGIN) throw new GarminError('Garmin requires the registered sieste address.', 400);
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const generation = crypto.randomUUID();
  const row = await garminConnection(owner);
  const pending: GarminPending = {verifier, clientId, generation, redirectUri: origin + '/api/garmin/callback', connectionRevision: row?.revision ?? null};
  await storage().db.prepare("INSERT INTO garmin_account_state (owner,generation,intent) VALUES (?,?,'authorization') ON CONFLICT(owner) DO UPDATE SET generation=excluded.generation,intent=excluded.intent")
    .bind(owner, generation).run();
  await storage().db.prepare('DELETE FROM garmin_oauth_states WHERE owner = ? OR expires <= ?')
    .bind(owner, new Date().toISOString()).run();
  const result = await storage().db.prepare('INSERT INTO garmin_oauth_states (state,owner,payload,expires) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM garmin_account_state WHERE owner = ? AND generation = ?)')
    .bind(state, owner, await encodeGarminCredentials(owner, pending), new Date(Date.now() + 600_000).toISOString(), owner, generation).run();
  if (!result.meta.changes) throw new GarminError('Another Garmin sign-in started. Please retry.', 409);
  const query = new URLSearchParams({response_type: 'code', client_id: clientId, redirect_uri: pending.redirectUri, state, code_challenge: challenge, code_challenge_method: 'S256'});
  return {state, url: GARMIN_AUTHORIZE + '?' + query};
}

export async function consumeGarminAuthorization(owner: string, state: string, origin: string) {
  const row = await storage().db.prepare('DELETE FROM garmin_oauth_states WHERE state = ? AND owner = ? AND expires > ? RETURNING payload')
    .bind(state, owner, new Date().toISOString()).first<{payload: string}>();
  if (!row) return null;
  const pending = await decodeGarminCredentials<GarminPending>(owner, row.payload);
  const current = await storage().db.prepare('SELECT generation FROM garmin_account_state WHERE owner = ?')
    .bind(owner).first<{generation: string}>();
  if (origin !== GARMIN_ORIGIN || pending.redirectUri !== origin + '/api/garmin/callback' || current?.generation !== pending.generation) return null;
  if (typeof pending.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(pending.verifier)) return null;
  return pending;
}

async function garminRequest(url: string, init: RequestInit) {
  const response = await fetch(url, {...init, redirect: 'manual', signal: AbortSignal.timeout(20_000)});
  if (!response.ok) {
    throw new GarminError(response.status === 401 || response.status === 403 ? 'Please reconnect Garmin.' : response.status === 429 ? 'Garmin is limiting requests. Please retry later.' : 'Garmin could not complete this request. Please retry.', response.status === 401 || response.status === 403 ? 401 : response.status === 429 ? 429 : 502);
  }
  return response;
}

async function garminJson(url: string, init: RequestInit) {
  try {
    return await (await garminRequest(url, init)).json() as unknown;
  } catch (error) {
    if (error instanceof GarminError) throw error;
    throw new GarminError('Garmin returned an invalid response. Please retry.');
  }
}

export function garminPermissions(payload: unknown) {
  const values = Array.isArray(payload) ? payload : payload && typeof payload === 'object' ? (payload as {permissions?: unknown}).permissions : null;
  if (!Array.isArray(values) || !values.every(value => typeof value === 'string')) throw new GarminError('Garmin permissions could not be verified. Please reconnect.');
  return [...new Set(values as string[])];
}

export function garminTokenCredentials(payload: unknown, clientId: string): GarminCredentials {
  const value = payload as Record<string, unknown> | null;
  if (!value
    || typeof value.access_token !== 'string' || !value.access_token
    || typeof value.refresh_token !== 'string' || !value.refresh_token
    || value.token_type !== 'bearer' && value.token_type !== 'Bearer'
    || typeof value.expires_in !== 'number' || !Number.isFinite(value.expires_in) || value.expires_in <= 0
    || typeof value.refresh_token_expires_in !== 'number' || !Number.isFinite(value.refresh_token_expires_in) || value.refresh_token_expires_in <= 0) {
    throw new GarminError('Garmin token response could not be verified. Please reconnect.');
  }
  const now = Date.now();
  const expiresAt = now + value.expires_in * 1000;
  const refreshExpiresAt = now + value.refresh_token_expires_in * 1000;
  if (!Number.isFinite(expiresAt) || !Number.isFinite(refreshExpiresAt)) throw new GarminError('Garmin token expiration is invalid. Please reconnect.');
  return {clientId, accessToken: value.access_token, refreshToken: value.refresh_token, expiresAt, refreshExpiresAt};
}

async function requireGarminAuthLease(lease: GarminAuthLease, remaining = 0) {
  const current = await storage().db.prepare("SELECT lease_token,expires FROM garmin_oauth_operations WHERE id = 'authorization'")
    .first<{lease_token: string; expires: number}>();
  if (!current || current.lease_token !== lease.token || current.expires <= Date.now() + remaining) throw new GarminError('Garmin authorization is busy. Please retry.', 409);
}

async function withGarminAuthLease<T>(work: (lease: GarminAuthLease) => Promise<T>) {
  const now = Date.now();
  const lease = {token: crypto.randomUUID(), expires: now + AUTH_LEASE_DURATION};
  const result = await storage().db.prepare("INSERT INTO garmin_oauth_operations (id,lease_token,expires) VALUES ('authorization',?,?) ON CONFLICT(id) DO UPDATE SET lease_token=excluded.lease_token,expires=excluded.expires WHERE garmin_oauth_operations.expires <= ?")
    .bind(lease.token, lease.expires, now).run();
  if (!result.meta.changes) throw new GarminError('Garmin authorization is busy. Please retry shortly.', 409);
  try {
    return await work(lease);
  } finally {
    await storage().db.prepare("DELETE FROM garmin_oauth_operations WHERE id = 'authorization' AND lease_token = ?")
      .bind(lease.token).run();
  }
}

async function cleanupRejectedGarminGrant(owner: string, pending: GarminPending, userId: string, credentials: GarminCredentials, lease: GarminAuthLease) {
  const mapped = await storage().db.prepare('SELECT owner FROM garmin_connections WHERE user_id = ?').bind(userId).first<{owner: string}>();
  if (mapped) return;
  const state = await storage().db.prepare('SELECT generation,intent FROM garmin_account_state WHERE owner = ?')
    .bind(owner).first<{generation: string; intent: string}>();
  // Registration deletion targets the account, not one authorization. A newer
  // authorization must retain its consent even if its callback is still pending.
  if (!state || state.generation !== pending.generation && state.intent !== 'disconnected') return;
  try {
    await requireGarminAuthLease(lease, 20_000);
    await garminRequest(GARMIN_USER_API + '/registration', {method: 'DELETE', headers: {Authorization: 'Bearer ' + credentials.accessToken}});
  } catch {
    throw new GarminError('Garmin sign-in cleanup failed. Remove sieste from Garmin connected apps, then retry.', 502, 'cleanup-required');
  }
}

export async function completeGarminAuthorization(owner: string, pending: GarminPending, code: string) {
  return withGarminAuthLease(lease => completeGarminAuthorizationUnderLease(owner, pending, code, lease));
}

async function completeGarminAuthorizationUnderLease(owner: string, pending: GarminPending, code: string, lease: GarminAuthLease) {
  const config = garminConfig();
  if (pending.clientId !== config.clientId) throw new GarminError('Garmin configuration changed. Please reconnect.', 409);
  const payload = await garminJson(GARMIN_TOKEN, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret, code, code_verifier: pending.verifier, redirect_uri: pending.redirectUri})});
  const credentials = garminTokenCredentials(payload, config.clientId);
  const headers = {Authorization: 'Bearer ' + credentials.accessToken};
  let userId: string;
  try {
    const identity = await garminJson(GARMIN_USER_API + '/id', {headers}) as {userId?: unknown} | null;
    if (!identity || typeof identity.userId !== 'string' || !identity.userId.trim()) throw new Error('Unverified identity');
    userId = identity.userId;
  } catch {
    // Tokens exist, but registration deletion could affect an unknown mapping.
    throw new GarminError('Garmin identity could not be verified. Remove sieste from Garmin connected apps, then retry.', 502, 'cleanup-required');
  }
  try {
    const permissions = garminPermissions(await garminJson(GARMIN_USER_API + '/permissions', {headers}));
    const collision = await storage().db.prepare('SELECT owner FROM garmin_connections WHERE user_id = ? AND owner != ?')
      .bind(userId, owner).first<{owner: string}>();
    if (collision) throw new GarminError('This Garmin account is already connected to another sieste account.', 409);
    const existing = await garminConnection(owner);
    if (existing && existing.user_id !== userId) {
      throw new GarminError('Disconnect your current Garmin account before connecting another.', 409, 'disconnect-first');
    }
    const now = Date.now();
    const expectedRevision = pending.connectionRevision ?? '';
    await requireGarminAuthLease(lease);
    const result = await storage().db.prepare(`INSERT INTO garmin_connections (owner,revision,user_id,credentials,permissions,updated_at,refresh_lock)
      SELECT ?,?,?,?,?,?,0 WHERE EXISTS (SELECT 1 FROM garmin_account_state WHERE owner = ? AND generation = ?)
      AND EXISTS (SELECT 1 FROM garmin_oauth_operations WHERE id = 'authorization' AND lease_token = ? AND expires > ?)
      AND (? IS NULL OR EXISTS (SELECT 1 FROM garmin_connections WHERE owner = ? AND revision = ? AND refresh_lock <= ?))
      ON CONFLICT(owner) DO UPDATE SET revision=excluded.revision,user_id=excluded.user_id,credentials=excluded.credentials,permissions=excluded.permissions,updated_at=excluded.updated_at,refresh_lock=0
      WHERE garmin_connections.revision = ? AND garmin_connections.refresh_lock <= ?`)
      .bind(owner, crypto.randomUUID(), userId, await encodeGarminCredentials(owner, credentials), JSON.stringify(permissions), new Date(now).toISOString(), owner, pending.generation, lease.token, Date.now(), pending.connectionRevision, owner, expectedRevision, now, expectedRevision, now).run();
    if (!result.meta.changes) throw new GarminError('Your Garmin connection changed. Please retry.', 409);
  } catch (error) {
    await cleanupRejectedGarminGrant(owner, pending, userId, credentials, lease);
    throw error;
  }
}

async function withGarminLease<T>(row: GarminConnection, work: (lease: number) => Promise<T>) {
  const now = Date.now();
  const lease = now + LEASE_DURATION;
  const result = await storage().db.prepare('UPDATE garmin_connections SET refresh_lock = ? WHERE owner = ? AND revision = ? AND credentials = ? AND refresh_lock <= ?')
    .bind(lease, row.owner, row.revision, row.credentials, now).run();
  if (!result.meta.changes) throw new GarminError('Garmin connection is busy. Please retry shortly.', 409);
  try {
    return await work(lease);
  } finally {
    await storage().db.prepare('UPDATE garmin_connections SET refresh_lock = 0 WHERE owner = ? AND revision = ? AND refresh_lock = ?')
      .bind(row.owner, row.revision, lease).run();
  }
}

async function refreshGarminUnderLease(row: GarminConnection, lease: number, force = false) {
  const saved = await decodeGarminCredentials<GarminCredentials>(row.owner, row.credentials);
  if (!force && saved.expiresAt > Date.now() + REFRESH_MARGIN) return saved;
  const config = garminConfig();
  if (saved.clientId !== config.clientId || saved.refreshExpiresAt <= Date.now()) throw new GarminError('Please reconnect Garmin.', 401);
  const payload = await garminJson(GARMIN_TOKEN, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'refresh_token', client_id: config.clientId, client_secret: config.clientSecret, refresh_token: saved.refreshToken})});
  const next = garminTokenCredentials(payload, config.clientId);
  const result = await storage().db.prepare('UPDATE garmin_connections SET credentials = ?, updated_at = ? WHERE owner = ? AND revision = ? AND credentials = ? AND refresh_lock = ? AND refresh_lock > ?')
    .bind(await encodeGarminCredentials(row.owner, next), new Date().toISOString(), row.owner, row.revision, row.credentials, lease, Date.now()).run();
  if (!result.meta.changes) throw new GarminError('Your Garmin connection changed. Please retry.', 409);
  return next;
}

const refreshing = new Map<string, Promise<GarminCredentials>>();
export async function accessGarminCredentials(row: GarminConnection) {
  const config = garminConfig();
  const current = await garminConnection(row.owner);
  if (!current || current.revision !== row.revision) throw new GarminError('Your Garmin connection changed. Please retry.', 409);
  const key = row.owner + ':' + row.revision;
  const pending = refreshing.get(key);
  if (pending) return pending;
  const saved = await decodeGarminCredentials<GarminCredentials>(current.owner, current.credentials);
  if (saved.clientId !== config.clientId) throw new GarminError('Please reconnect Garmin.', 401);
  if (current.refresh_lock > Date.now()) throw new GarminError('Garmin connection is busy. Please retry shortly.', 409);
  if (saved.expiresAt > Date.now() + REFRESH_MARGIN) {
    const latest = await garminConnection(row.owner);
    if (!latest || latest.revision !== current.revision || latest.credentials !== current.credentials || latest.refresh_lock > Date.now()) throw new GarminError('Your Garmin connection changed. Please retry.', 409);
    return saved;
  }
  const joined = refreshing.get(key);
  if (joined) return joined;
  const work = (async () => {
    const credentials = await withGarminLease(current, lease => refreshGarminUnderLease(current, lease));
    const latest = await garminConnection(row.owner);
    if (!latest || latest.revision !== row.revision || latest.refresh_lock > Date.now()) throw new GarminError('Your Garmin connection changed. Please retry.', 409);
    return credentials;
  })();
  refreshing.set(key, work);
  try {
    return await work;
  } finally {
    refreshing.delete(key);
  }
}

export async function disconnectGarmin(owner: string) {
  // A generation survives absent connections, fencing a callback already exchanging its code.
  await storage().db.prepare("INSERT INTO garmin_account_state (owner,generation,intent) VALUES (?,?,'disconnected') ON CONFLICT(owner) DO UPDATE SET generation=excluded.generation,intent=excluded.intent")
    .bind(owner, crypto.randomUUID()).run();
  await storage().db.prepare('DELETE FROM garmin_oauth_states WHERE owner = ?').bind(owner).run();
  const row = await garminConnection(owner);
  if (!row) return;
  await withGarminAuthLease(authLease => withGarminLease(row, async lease => {
    let credentials = await refreshGarminUnderLease(row, lease);
    try {
      await requireGarminAuthLease(authLease, 20_000);
      await garminRequest(GARMIN_USER_API + '/registration', {method: 'DELETE', headers: {Authorization: 'Bearer ' + credentials.accessToken}});
    } catch (error) {
      if (!(error instanceof GarminError) || error.status !== 401) throw error;
      const latest = await garminConnection(owner);
      if (!latest || latest.revision !== row.revision || latest.refresh_lock !== lease) throw new GarminError('Your Garmin connection changed. Please retry.', 409);
      credentials = await refreshGarminUnderLease(latest, lease, true);
      await requireGarminAuthLease(authLease, 20_000);
      await garminRequest(GARMIN_USER_API + '/registration', {method: 'DELETE', headers: {Authorization: 'Bearer ' + credentials.accessToken}});
    }
    const result = await storage().db.prepare("DELETE FROM garmin_connections WHERE owner = ? AND revision = ? AND refresh_lock = ? AND EXISTS (SELECT 1 FROM garmin_oauth_operations WHERE id = 'authorization' AND lease_token = ? AND expires > ?)")
      .bind(owner, row.revision, lease, authLease.token, Date.now()).run();
    if (!result.meta.changes) throw new GarminError('Your Garmin connection changed. Please retry.', 409);
  }));
}

export async function garminMetadata(owner: string) {
  const row = await garminConnection(owner);
  return {configured: garminConfigured(), connected: !!row, permissions: row ? garminPermissions(JSON.parse(row.permissions)) : [], dataSyncReady: false, updatedAt: row?.updated_at ?? null};
}

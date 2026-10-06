/**
 * Outbound-only sieste scheduler and Web Push delivery bridge.
 * Configuration and delivery receipts live outside the repository, under the
 * protected %PROGRAMDATA%\Sieste\private directory on Windows. Never log secrets,
 * subscription URLs, provider responses, or health/activity data.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const SITE_ORIGIN = 'https://sieste.daaalil.chatgpt.site';
const POLL_MS = 60_000;
const MAX_BACKOFF_MS = 15 * 60_000;
const RECEIPT_TTL_MS = 30 * 24 * 60 * 60_000;
const args = process.argv.slice(2);
const once = args.includes('--once');
const configArgument = args.indexOf('--config');
const configPath = path.resolve(configArgument >= 0 && args[configArgument + 1]
  ? args[configArgument + 1]
  : process.platform === 'win32'
    ? path.join(process.env.ProgramData || 'C:/ProgramData', 'Sieste', 'private', 'config.json')
    : path.join(process.cwd(), 'SiesteBackground', 'config.json'));
const privateDirectory = path.dirname(configPath);
const statusPath = path.join(privateDirectory, 'status.json');
const receiptPath = path.join(privateDirectory, 'delivery-receipts.json');
const state = {
  workerOnline: false,
  connected: false,
  startedAt: new Date().toISOString(),
  updatedAt: null,
  lastTickAt: null,
  lastSuccessAt: null,
  lastSyncAt: null,
  lastPushAt: null,
  nextCheckAt: null,
  ticks: 0,
  syncs: 0,
  notifications: 0,
  failedNotifications: 0,
  failures: 0,
  error: null,
};
let stopping = false;
let sleepAbort = null;
let cachedRuntimePath = null;
let cachedWebPush = null;
let receipts = {};

class WorkerError extends Error {
  constructor(code) { super(code); this.code = code; }
}

async function writeJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await fs.rename(temporary, file);
}

async function saveState() {
  state.updatedAt = new Date().toISOString();
  try { await writeJson(statusPath, state); } catch { /* No secret/error output. */ }
}

function validKey(value, minLength, maxLength) {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength
    && /^[A-Za-z0-9_-]+={0,2}$/.test(value);
}

async function readConfig() {
  let config;
  try { config = JSON.parse((await fs.readFile(configPath, 'utf8')).replace(/^\uFEFF/, '')); }
  catch { throw new WorkerError('CONFIG_UNAVAILABLE'); }
  if (!config || typeof config !== 'object' || typeof config.token !== 'string'
      || config.token.length < 24 || config.token.length > 1024
      || /[\r\n]/.test(config.token) || typeof config.runtimePath !== 'string'
      || !path.isAbsolute(config.runtimePath)
      || !validKey(config.vapidPublicKey, 80, 128)
      || !validKey(config.vapidPrivateKey, 40, 64)) {
    throw new WorkerError('CONFIG_INVALID');
  }
  let base;
  try { base = new URL(config.base); } catch { throw new WorkerError('CONFIG_INVALID'); }
  // Keep a stolen/mistyped configuration from sending its bearer token elsewhere.
  if (base.origin !== SITE_ORIGIN || base.username || base.password
      || (base.pathname !== '/' && base.pathname !== '') || base.search || base.hash) {
    throw new WorkerError('CONFIG_INVALID');
  }
  config.base = base.origin;
  return config;
}

function webPush(config) {
  if (cachedRuntimePath !== config.runtimePath) {
    try {
      const anchor = /\.(?:json|m?js|cjs)$/i.test(config.runtimePath)
        ? config.runtimePath : path.join(config.runtimePath, 'package.json');
      cachedWebPush = createRequire(anchor)('web-push');
      cachedRuntimePath = config.runtimePath;
    } catch { throw new WorkerError('PUSH_RUNTIME_UNAVAILABLE'); }
  }
  return cachedWebPush;
}

async function callServer(config, body, timeout = 210_000) {
  let response;
  try {
    response = await fetch(`${config.base}/api/background-sync/worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        Origin: config.base,
        'User-Agent': 'sieste background sync bridge',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
      redirect: 'error',
    });
  } catch { throw new WorkerError('WORKER_NETWORK'); }
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel();
    throw new WorkerError('WORKER_UNAUTHORIZED');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new WorkerError('WORKER_RESPONSE');
  }
  let result;
  try {
    // The worker endpoint returns only scheduling outcomes and encrypted-push inputs.
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) { await reader.cancel(); throw new Error('oversize'); }
      chunks.push(value);
    }
    result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new WorkerError('WORKER_RESPONSE'); }
  if (!result || result.ok !== true) throw new WorkerError('WORKER_RESPONSE');
  return result;
}

function trustedPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 4096) return false;
  let url;
  try { url = new URL(endpoint); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash
      || (url.port && url.port !== '443')) return false;
  const host = url.hostname.toLowerCase();
  return host === 'fcm.googleapis.com' || host === 'android.googleapis.com'
    || host === 'web.push.apple.com' || host.endsWith('.push.apple.com')
    || host === 'push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com')
    || host === 'notify.windows.com' || host.endsWith('.notify.windows.com')
    || host === 'wns.windows.com' || host.endsWith('.wns.windows.com')
    || host === 'notify.live.net' || host.endsWith('.notify.live.net');
}

function validatedJob(job) {
  if (!job || typeof job.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(job.id)
      || typeof job.claim !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(job.claim)) return null;
  const subscription = job.subscription;
  const payload = job.payload;
  if (!subscription || !trustedPushEndpoint(subscription.endpoint)
      || !validKey(subscription.keys?.p256dh, 80, 128)
      || !validKey(subscription.keys?.auth, 16, 64)
      || !payload || !['sieste-sync-completed', 'sieste-sync-test'].includes(payload.type)
      || !['completed', 'partial'].includes(payload.status)
      || typeof payload.syncedAt !== 'string' || !Number.isFinite(Date.parse(payload.syncedAt))) return null;
  return {
    subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
    // Explicitly project the generic payload: no data from provider results enters a push.
    payload: { type: payload.type, status: payload.status, syncedAt: new Date(payload.syncedAt).toISOString() },
  };
}

async function loadReceipts() {
  try {
    const value = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) receipts = value;
  } catch { receipts = {}; }
  pruneReceipts();
}

function pruneReceipts() {
  const now = Date.now();
  receipts = Object.fromEntries(Object.entries(receipts)
    .filter(([id, value]) => /^[A-Za-z0-9_-]{1,128}$/.test(id) && value
      && Number.isInteger(value.statusCode)
      && ((value.statusCode >= 200 && value.statusCode < 300) || [404, 410].includes(value.statusCode))
      && Number.isFinite(value.at) && now - value.at < RECEIPT_TTL_MS)
    .sort((a, b) => b[1].at - a[1].at).slice(0, 1000));
}

async function acknowledge(config, job, statusCode) {
  await callServer(config, { op: 'delivered', id: job.id, claim: job.claim, statusCode }, 30_000);
}

async function deliver(config, job) {
  const validated = validatedJob(job);
  // Invalid inputs never trigger a network request to their advertised endpoint.
  if (!validated) {
    state.failedNotifications++;
    if (job && typeof job.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(job.id)
        && typeof job.claim === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(job.claim)) {
      await acknowledge(config, job, 400);
    }
    return;
  }
  const previous = Object.hasOwn(receipts, job.id) ? receipts[job.id] : null;
  if (previous) {
    await acknowledge(config, job, previous.statusCode);
    return;
  }
  let statusCode = 0;
  try {
    const result = await webPush(config).sendNotification(validated.subscription,
      JSON.stringify(validated.payload), {
        vapidDetails: { subject: config.base, publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey },
        timeout: 20_000,
        TTL: 60 * 60,
        urgency: 'normal',
        topic: validated.payload.type === 'sieste-sync-test' ? 'sieste-sync-test' : 'sieste-sync-completed',
      });
    statusCode = Number.isInteger(result.statusCode) ? result.statusCode : 201;
  } catch (error) {
    // Only the numeric service result leaves this process. Error bodies can contain secrets.
    statusCode = Number.isInteger(error?.statusCode) && error.statusCode >= 100 && error.statusCode <= 599
      ? error.statusCode : 0;
  }
  if ((statusCode >= 200 && statusCode < 300) || statusCode === 404 || statusCode === 410) {
    // A receipt prevents duplicate notifications when a successful push acknowledgement
    // is lost. Store no endpoint, keys, claim token, or notification contents.
    Object.defineProperty(receipts, job.id, {
      value: { statusCode, at: Date.now() }, configurable: true, enumerable: true, writable: true,
    });
    pruneReceipts();
    await writeJson(receiptPath, receipts);
  }
  if (statusCode >= 200 && statusCode < 300) {
    state.notifications++;
    state.lastPushAt = new Date().toISOString();
  } else state.failedNotifications++;
  await acknowledge(config, job, statusCode);
}

async function tick() {
  state.workerOnline = true;
  state.lastTickAt = new Date().toISOString();
  state.ticks++;
  await saveState();
  const config = await readConfig();
  // Fail before claiming notification work if the private delivery runtime is missing.
  webPush(config);
  const result = await callServer(config, { op: 'tick' });
  state.connected = true;
  state.lastSuccessAt = new Date().toISOString();
  state.error = null;
  if (result.synced === true) {
    state.syncs++;
    state.lastSyncAt = state.lastSuccessAt;
  }
  if (result.notificationJobs !== undefined && !Array.isArray(result.notificationJobs)) {
    throw new WorkerError('WORKER_RESPONSE');
  }
  // Keep claims bounded even if the server accidentally returns an oversized batch.
  for (const job of (result.notificationJobs || []).slice(0, 20)) {
    if (stopping) break;
    await deliver(config, job);
  }
  await saveState();
}

function stop() {
  stopping = true;
  sleepAbort?.abort();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

async function run() {
  await loadReceipts();
  let consecutiveFailures = 0;
  do {
    try {
      await tick();
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures++;
      state.connected = false;
      state.failures++;
      state.error = error instanceof WorkerError ? error.code : 'WORKER_UNAVAILABLE';
      if (once) process.exitCode = 1;
    }
    const waitMs = consecutiveFailures
      ? Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** Math.min(consecutiveFailures - 1, 5))
      : POLL_MS;
    state.nextCheckAt = once || stopping ? null : new Date(Date.now() + waitMs).toISOString();
    await saveState();
    if (once || stopping) break;
    sleepAbort = new AbortController();
    try { await delay(waitMs, undefined, { signal: sleepAbort.signal }); } catch { /* Shutdown. */ }
    sleepAbort = null;
  } while (!stopping);
  state.workerOnline = false;
  state.nextCheckAt = null;
  await saveState();
  if (once) process.stdout.write(`${JSON.stringify(state)}\n`);
}

// Contain every failure; the hidden launcher must never expose a secret-bearing stack.
run().catch(async () => {
  state.workerOnline = false;
  state.connected = false;
  state.error = 'WORKER_UNAVAILABLE';
  state.nextCheckAt = null;
  process.exitCode = 1;
  await saveState();
  if (once) process.stdout.write(`${JSON.stringify(state)}\n`);
});

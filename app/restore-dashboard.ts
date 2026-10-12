import {
  activateSnapshotScope,
  clearDeviceSnapshot,
  readDeviceSnapshot,
  validDashboard,
} from "./device-snapshot-cache";
import { progressiveSync } from "./progressive-sync";
import type { AthleteData } from "./analytics";

export type DashboardAccount = {
  signedIn: boolean;
  userId?: string;
  name?: string;
  connected: boolean;
  corosConnected: boolean;
  cacheScope: string | null;
};
type Options = {
  previous?: {scope:string;data:AthleteData};
  onAccount: (account: DashboardAccount) => void;
  onScope: (scope: string | null) => void;
  onData: (data: AthleteData | null, cachedAt: number | null) => void;
  onReady: () => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onPhase: (phase: string) => void;
  onRetrieved?: (data: AthleteData) => void;
  current?: () => boolean;
  request?: typeof fetch;
  cache?: {
    activate: typeof activateSnapshotScope;
    clear: typeof clearDeviceSnapshot;
    read: typeof readDeviceSnapshot;
  };
};
export async function restoreDashboard({
  previous,
  onAccount,
  onScope,
  onData,
  onReady,
  onBusy,
  onError,
  onPhase,
  onRetrieved,
  current = () => true,
  request = fetch,
  cache = {
    activate: activateSnapshotScope,
    clear: clearDeviceSnapshot,
    read: readDeviceSnapshot,
  },
}: Options) {
  let shown = false,
    authoritative = false,
    cachedTask: Promise<void> | undefined;
  const ready = () => {
    if (current()) onReady();
  };
  // Both requests authenticate independently; no saved data is displayed until
  // the cheap account response verifies its owner and connection scope.
  const accountTask=request('/api/account',{cache:'no-store',signal:AbortSignal.timeout(20000)});
  const savedTask=request('/api/sync',{
    cache:'no-cache',
    headers:previous?.data.syncRevision?{'If-None-Match':previous.data.syncRevision}:{},
    signal:AbortSignal.timeout(20000),
  }).then(response=>({response,error:null}),error=>({response:null,error}));
  try {
    const response = await accountTask;
    const account = (await response.json()) as DashboardAccount & {
      error?: string;
    };
    if (!current()) return;
    if (!response.ok)
      throw Error(account.error || "Could not check your account.");
    onAccount(account);
    if (
      !account.signedIn ||
      !account.connected ||
      !account.userId ||
      !account.cacheScope
    ) {
      onScope(null);
      await cache.clear();
      if (!current()) return;
      onData(null, null);
      ready();
      return;
    }
    const scope = account.cacheScope;
    cache.activate(scope);
    onScope(scope);
    onError("");
    onPhase("Refreshing saved dashboard…");
    onBusy(true);
    // Start the authoritative read in parallel with IndexedDB. Cache failures or
    // blocked storage cannot hold up a successful server response.
    cachedTask = cache
      .read(scope)
      .then((hit) => {
        if (hit && !authoritative && current()) {
          shown = true;
          onData(hit.data, hit.savedAt);
          ready();
        }
      })
      .catch(() => {});
    const result=await savedTask;
    if(result.error)throw result.error;
    let saved=result.response!;
    if(saved.status===304&&(!previous||previous.scope!==scope||saved.headers.get('X-Sieste-User')!==account.userId))saved=await request('/api/sync',{cache:'no-cache',signal:AbortSignal.timeout(20000)});
    const state = (saved.status===304?{...account,data:previous!.data}:await saved.json()) as DashboardAccount & {
      data?: AthleteData;
      error?: string;
    };
    if (!current()) return;
    if (!saved.ok&&saved.status!==304)
      throw Error(state.error || "Could not load your saved dashboard.");
    if (!state.signedIn || state.userId !== account.userId) {
      authoritative = true;
      shown = false;
      onScope(null);
      await cache.clear();
      if (!current()) return;
      onAccount({
        ...account,
        signedIn: false,
        connected: false,
        corosConnected: false,
        cacheScope: null,
      });
      onData(null, null);
      throw Error(
        "Your sign-in changed. Sign in again to load your dashboard.",
      );
    }
    if (!state.connected) {
      authoritative = true;
      shown = false;
      onScope(null);
      await cache.clear();
      if (!current()) return;
      onAccount({
        ...account,
        connected: false,
        corosConnected: false,
        cacheScope: null,
      });
      onData(null, null);
      ready();
      return;
    }
    onAccount({ ...account, corosConnected: !!state.corosConnected });
    if (validDashboard(state.data)) {
      const etag=saved.headers.get('ETag');
      if(etag)state.data={...state.data,syncRevision:etag};
      authoritative = true;
      shown = true;
      onData(state.data, null);
      ready();
    }
    const stamp = Date.parse(state.data?.syncedAt ?? "");
    if (
      validDashboard(state.data) &&
      Number.isFinite(stamp) &&
      stamp <= Date.now() &&
      Date.now() - stamp < 300000
    )
      return;
    onBusy(true);
    onError("");
    await progressiveSync(
      { token: "__saved__" },
      (fresh) => {
        if (current()) {
          authoritative = true;
          shown = true;
          onData(fresh, null);
          onRetrieved?.(fresh);
          ready();
        }
      },
      (phase) => {
        if (current()) onPhase(phase);
      },
      request,
      state.data,
    );
  } catch (error) {
    await cachedTask;
    if (current())
      onError(
        (shown ? "Showing your saved dashboard. " : "") +
          (error instanceof Error
            ? error.message
            : "Your dashboard could not refresh. Use Sync now to retry."),
      );
  } finally {
    if (current()) {
      onBusy(false);
      ready();
    }
  }
}

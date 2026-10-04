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
  try {
    const response = await request("/api/account", {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
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
    const saved = await request("/api/sync", {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const state = (await saved.json()) as DashboardAccount & {
      data?: AthleteData;
      error?: string;
    };
    if (!current()) return;
    if (!saved.ok)
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

import { analysisIdentity } from "./activity-analysis";
import { unseal } from "./token-crypto";
import type { Connection } from "./storage";
import type { CorosConnection } from "./coros";

// A Tredict snapshot revision changes on sync; its token identity stays stable.
// COROS connection revisions change on reconnect, rather than token refresh.
export async function deviceCacheScope(
  owner: string,
  training: Connection | null,
  coros: CorosConnection | null,
  key: string,
) {
  const identity = training
    ? await analysisIdentity(
        await unseal(training.token_ciphertext, key, owner),
      )
    : null;
  return analysisIdentity(
    JSON.stringify([
      "device-cache-v1",
      owner,
      identity,
      coros?.revision ?? null,
    ]),
  );
}

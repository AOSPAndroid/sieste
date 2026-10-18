// Structural sharing between dashboard versions: unchanged parts keep their
// previous object identity, so memoised views and device writes can skip them.
const VOLATILE = new Set(["syncedAt", "warnings", "sources"]);
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";

function share(previous: unknown, next: unknown): unknown {
  if (previous === next || !isObject(previous) || !isObject(next)) return next;
  if (Array.isArray(previous) !== Array.isArray(next)) return next;
  if (Array.isArray(previous) && Array.isArray(next)) {
    // Activities and similar rows are matched by id so an insertion at the top
    // does not make every later row look changed.
    const byId = new Map<unknown, unknown>();
    for (const item of previous)
      if (isObject(item) && "id" in item) byId.set(item.id, item);
    let same = previous.length === next.length;
    const out = next.map((item, i) => {
      const match =
        isObject(item) && "id" in item ? byId.get(item.id) : previous[i];
      const shared = match === undefined ? item : share(match, item);
      if (shared !== previous[i]) same = false;
      return shared;
    });
    return same ? previous : out;
  }
  const keys = Object.keys(next);
  let same = keys.length === Object.keys(previous).length;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = key in previous ? share(previous[key], next[key]) : next[key];
    if (out[key] !== previous[key]) same = false;
  }
  return same ? previous : out;
}

export function stableMerge<T>(previous: T | null | undefined, next: T): T {
  return previous ? (share(previous, next) as T) : next;
}

// True when a refreshed dashboard differs only in sync metadata (timestamps,
// source status, warnings), so there is nothing new to store on the device.
export function onlySyncMetadataChanged(
  previous: object | null | undefined,
  next: object,
) {
  if (!previous) return false;
  if (previous === next) return true;
  const a = previous as Record<string, unknown>,
    b = next as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (!VOLATILE.has(key) && a[key] !== b[key]) return false;
  return true;
}

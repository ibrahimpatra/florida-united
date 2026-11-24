/** Recently viewed products kept on the account (users/{id}.recentViewed): ids and times only, newest first, at most 20. */
export interface RecentItem { id: string; at: number }
export const RECENT_MAX = 20;

/** Merge lists from the browser and the account: one entry per product (the latest time wins), newest first, capped. */
export function mergeRecent(...lists: (RecentItem[] | undefined)[]): RecentItem[] {
  const best = new Map<string, number>();
  for (const l of lists) for (const i of l || []) {
    const id = String(i?.id || ''); const at = Number(i?.at) || 0;
    if (!id || id.startsWith('bundle:') || id.length > 80) continue;
    if (at > (best.get(id) ?? -1)) best.set(id, at);
  }
  return [...best.entries()].map(([id, at]) => ({ id, at })).sort((a, b) => b.at - a.at).slice(0, RECENT_MAX);
}

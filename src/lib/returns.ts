/** One place that decides when a delivered order can still be returned. Used by the order page, the return form and the API. */
export const DEFAULT_RETURN_DAYS = 7;

export function returnWindowDays(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(365, Math.round(n)) : DEFAULT_RETURN_DAYS;
}

/** When the order was delivered: the stored time, else the last "delivered" entry in its history, else null (unknown). */
export function deliveredAtOf(order: any): Date | null {
  const raw = order?.deliveredAt || [...(order?.statusHistory || [])].reverse().find((h: any) => h?.status === 'delivered')?.createdAt;
  if (!raw) return null;
  const d = new Date(raw?.toDate ? raw.toDate() : raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Whole days still left (0 = last day today), -1 once the window has closed, null when the delivery date is unknown. */
export function returnDaysLeft(order: any, windowDays: number, now = Date.now()): number | null {
  const d = deliveredAtOf(order);
  if (!d) return null;
  const end = d.getTime() + windowDays * 86400000;
  return now > end ? -1 : Math.ceil((end - now) / 86400000) - 1;
}

export const isInReturnWindow = (order: any, windowDays: number, now = Date.now()) => {
  const left = returnDaysLeft(order, windowDays, now);
  return left === null || left >= 0; // unknown delivery date: let the server decide
};

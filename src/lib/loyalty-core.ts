/** Loyalty rules (pure functions: no database). Money is KWD with 3 decimals. */
export interface LoyaltySettings {
  enabled: boolean;
  earnPerKwd: number;      // points earned per 1 KWD paid (after discounts, before shipping)
  pointValueKwd: number;   // KWD value of ONE point at checkout (0.01 => 100 points = 1 KWD)
  minRedeem: number;       // smallest number of points that can be used on one order
  maxRedeemPct: number;    // at most this % of the goods total can be paid with points
  tiers: { name: string; nameAr?: string; minSpent: number; bonusPct: number }[]; // bonus points % by lifetime spend
}
export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: false, earnPerKwd: 1, pointValueKwd: 0.01, minRedeem: 100, maxRedeemPct: 50,
  tiers: [{ name: 'Silver', nameAr: 'فضي', minSpent: 100, bonusPct: 10 }, { name: 'Gold', nameAr: 'ذهبي', minSpent: 500, bonusPct: 25 }],
};
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function sanitizeLoyalty(b: any): LoyaltySettings {
  const n = (v: any, d: number, lo: number, hi: number) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const d = DEFAULT_LOYALTY;
  const tiers = Array.isArray(b?.tiers) ? b.tiers.slice(0, 6).map((t: any) => ({
    name: String(t?.name || '').trim().slice(0, 20), nameAr: String(t?.nameAr || '').trim().slice(0, 20),
    minSpent: n(t?.minSpent, 0, 0, 1e7), bonusPct: n(t?.bonusPct, 0, 0, 500),
  })).filter((t: any) => t.name).sort((a: any, c: any) => a.minSpent - c.minSpent) : d.tiers;
  return {
    enabled: !!b?.enabled, earnPerKwd: n(b?.earnPerKwd, d.earnPerKwd, 0, 1000), pointValueKwd: n(b?.pointValueKwd, d.pointValueKwd, 0.001, 10),
    minRedeem: Math.floor(n(b?.minRedeem, d.minRedeem, 0, 1e7)), maxRedeemPct: n(b?.maxRedeemPct, d.maxRedeemPct, 0, 100), tiers,
  };
}

export function tierFor(s: LoyaltySettings, lifetimeSpent: number) {
  let t: LoyaltySettings['tiers'][number] | null = null;
  for (const x of s.tiers) if (lifetimeSpent >= x.minSpent) t = x;
  return t;
}

/** Points earned for goods worth `paidGoodsKwd` (after discounts). Tier bonus is added on top. */
export function earnPoints(s: LoyaltySettings, paidGoodsKwd: number, lifetimeSpent = 0): number {
  if (!s.enabled || !(paidGoodsKwd > 0)) return 0;
  const base = Math.floor(paidGoodsKwd * s.earnPerKwd);
  const bonus = tierFor(s, lifetimeSpent)?.bonusPct || 0;
  return Math.floor(base * (1 + bonus / 100));
}

/** How many of `requested` points can be used, and what they are worth. `payable` = goods total after coupon/deals. */
export function redeemPlan(s: LoyaltySettings, requested: number, balance: number, payable: number): { points: number; discount: number } {
  const none = { points: 0, discount: 0 };
  if (!s.enabled) return none;
  let pts = Math.floor(Math.min(Number(requested) || 0, balance));
  if (pts <= 0 || pts < s.minRedeem) return none;
  const capKwd = round3(Math.max(0, payable) * s.maxRedeemPct / 100);
  const capPts = Math.floor(capKwd / s.pointValueKwd + 1e-9);
  pts = Math.min(pts, capPts);
  if (pts <= 0 || pts < Math.min(s.minRedeem, capPts)) return none;
  return { points: pts, discount: round3(Math.min(pts * s.pointValueKwd, payable)) };
}

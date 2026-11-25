/**
 * Matches picture file names to product SKUs for the bulk photo page.
 *   LED-50W.jpg        -> SKU LED-50W, first picture
 *   LED-50W-2.jpg      -> SKU LED-50W, second picture   (also LED-50W_2, "LED-50W (2)")
 * A file whose whole name is a SKU always wins, so a SKU that itself ends in "-2" still works.
 */
export interface Matched { file: string; sku: string; order: number }

export function matchFileToSku(fileName: string, skus: Map<string, string>): { sku: string; order: number } | null {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').trim();
  const norm = (s: string) => s.trim().toLowerCase();
  if (skus.has(norm(base))) return { sku: skus.get(norm(base))!, order: 1 };
  const m = /^(.*?)(?:[\s_-]+\(?(\d{1,2})\)?|\s*\((\d{1,2})\))$/.exec(base);
  if (m) {
    const stem = norm(m[1]); const n = Number(m[2] || m[3]);
    if (skus.has(stem) && n >= 1) return { sku: skus.get(stem)!, order: n };
  }
  return null;
}

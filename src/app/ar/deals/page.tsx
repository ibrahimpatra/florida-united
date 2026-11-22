import Page from '@/app/deals/page';
import { baseMeta as BM } from '@/lib/listing-meta';
const baseMeta = BM.deals;
import { arabicMeta, listingSeo } from '@/lib/seo';
import { adminGetActiveFlashDeals } from '@/lib/shipping-admin';
export default Page;
export const revalidate = 300;
export async function generateMetadata() {
  let s: ReturnType<typeof listingSeo> = {};
  try { s = listingSeo(await adminGetActiveFlashDeals(), 'ar'); } catch {}
  return { ...arabicMeta(baseMeta, '/deals', { title: s.title || 'العروض', description: s.description }), keywords: s.keywords };
}

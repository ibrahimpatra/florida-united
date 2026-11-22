import Page from '@/app/bundles/page';
import { baseMeta as BM } from '@/lib/listing-meta';
const baseMeta = BM.bundles;
import { arabicMeta, listingSeo } from '@/lib/seo';
import { getStorefrontBundles } from '@/lib/firestore-admin';
export default Page;
export const revalidate = 300;
export async function generateMetadata() {
  let s: ReturnType<typeof listingSeo> = {};
  try { s = listingSeo(await getStorefrontBundles(), 'ar'); } catch {}
  return { ...arabicMeta(baseMeta, '/bundles', { title: s.title || 'الباقات والحزم', description: s.description }), keywords: s.keywords };
}

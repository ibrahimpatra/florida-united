import Page, { generateMetadata as base } from '@/app/shop/bundles/[slug]/page';
import { arabicMeta } from '@/lib/seo';
import { getStorefrontBundle } from '@/lib/firestore-admin';
import { bundleIdFromSlug } from '@/lib/bundle-path';
export const revalidate = 3600;
export async function generateStaticParams() { return []; }
export default Page;
export async function generateMetadata(props: any) {
  const m = await base(props);
  let ar: { title?: string; description?: string } = {};
  try { const b: any = await getStorefrontBundle(bundleIdFromSlug(props.params.slug)); if (b?.nameAr) ar = { title: b.metaTitleAr || b.nameAr, description: b.metaDescAr || b.descriptionAr?.slice(0, 160) }; } catch {}
  return arabicMeta(m, `/shop/bundles/${props.params.slug}`, ar);
}

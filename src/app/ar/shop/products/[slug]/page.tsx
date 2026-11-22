import Page, { generateMetadata as base } from '@/app/shop/products/[slug]/page';
import { arabicMeta } from '@/lib/seo';
import { adminGetProductBySlug } from '@/lib/firestore-admin';
export const revalidate = 60;
export default Page;
export async function generateMetadata(props: any) {
  const m = await base(props);
  let ar: { title?: string; description?: string } = {};
  try { const p: any = await adminGetProductBySlug(props.params.slug); if (p?.nameAr) ar = { title: p.metaTitleAr || p.nameAr, description: p.metaDescAr || p.shortDescriptionAr || p.descriptionAr?.slice(0, 160) }; } catch {}
  return arabicMeta(m, `/shop/products/${props.params.slug}`, ar);
}

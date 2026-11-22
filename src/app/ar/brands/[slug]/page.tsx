import Page, { generateMetadata as base } from '@/app/brands/[slug]/page';
import { arabicMeta } from '@/lib/seo';
import { getBrandBySlug } from '@/lib/brands';
export default Page;
export const revalidate = 300;
export async function generateMetadata(props: any) {
  const m = await base(props);
  let title: string | undefined, description: string | undefined;
  try { const b = await getBrandBySlug(props.params.slug); if (b?.nameAr) title = b.metaTitleAr || b.nameAr; description = b?.metaDescAr || b?.descriptionAr || undefined; } catch {}
  return arabicMeta(m, `/brands/${props.params.slug}`, { title, description });
}

import Page, { generateMetadata as base } from '@/app/shop/[category]/page';
import { arabicMeta } from '@/lib/seo';
import { adminGetCategories } from '@/lib/firestore-admin';
export default Page;
export async function generateMetadata(props: any) {
  const m = await base(props);
  let title: string | undefined; let description: string | undefined;
  try { const c = (await adminGetCategories(true)).find(x => x.slug === props.params.category); if (c?.nameAr) title = (c as any).metaTitleAr || c.nameAr; description = (c as any).metaDescAr || c?.descriptionAr || undefined; } catch {}
  return arabicMeta(m, `/shop/${props.params.category}`, { title, description });
}

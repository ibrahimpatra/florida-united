import { generateMetadata as base, default as Page } from '@/app/page';
import { arabicMeta } from '@/lib/seo';
import { getBrand } from '@/lib/brand-server';
export const revalidate = 300;
export default Page;
export async function generateMetadata() {
  const b = await getBrand();
  return arabicMeta(await base(), '/', { title: `${b.fullNameAr} | ${b.taglineAr}` });
}

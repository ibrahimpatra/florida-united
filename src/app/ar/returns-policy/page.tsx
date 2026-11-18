import Page, { metadata } from '@/app/returns-policy/page';
import { arabicMeta } from '@/lib/seo';
import { RETURNS } from '@/lib/legal-content';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/returns-policy', { title: RETURNS.title.ar });

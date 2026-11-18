import Page, { metadata } from '@/app/about/page';
import { arabicMeta } from '@/lib/seo';
import { ABOUT } from '@/lib/legal-content';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/about', { title: ABOUT.title.ar });

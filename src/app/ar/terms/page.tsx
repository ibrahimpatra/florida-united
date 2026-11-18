import Page, { metadata } from '@/app/terms/page';
import { arabicMeta } from '@/lib/seo';
import { TERMS } from '@/lib/legal-content';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/terms', { title: TERMS.title.ar });

import Page, { metadata } from '@/app/privacy/page';
import { arabicMeta } from '@/lib/seo';
import { PRIVACY } from '@/lib/legal-content';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/privacy', { title: PRIVACY.title.ar });

import Page, { metadata } from '@/app/bundles/page';
import { arabicMeta } from '@/lib/seo';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/bundles', { title: 'الباقات والحزم' });

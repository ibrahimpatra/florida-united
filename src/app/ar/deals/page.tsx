import Page, { metadata } from '@/app/deals/page';
import { arabicMeta } from '@/lib/seo';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/deals', { title: 'العروض' });

import Page from '@/app/shipping-info/page';
import { arabicMeta } from '@/lib/seo';
import { metadata } from '@/app/shipping-info/layout';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/shipping-info', { title: 'الشحن والتوصيل' });

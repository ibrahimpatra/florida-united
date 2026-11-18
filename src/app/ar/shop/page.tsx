import Page, { metadata } from '@/app/shop/page';
import { arabicMeta } from '@/lib/seo';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/shop', { title: 'تسوق جميع المنتجات' });

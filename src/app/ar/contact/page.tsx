import Page from '@/app/contact/page';
import { arabicMeta } from '@/lib/seo';
import { metadata } from '@/app/contact/layout';
export default Page;
export const generateMetadata = () => arabicMeta(metadata, '/contact', { title: 'اتصل بنا' });

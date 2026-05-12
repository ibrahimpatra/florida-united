import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartPageClient } from '@/components/cart/CartPageClient';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
export const metadata = { title: 'Shopping Cart' };
export default function CartPage() {
  return (<><AnnouncementBar/><Header/><main><CartPageClient/></main><Footer/></>);
}

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AccountClient } from '@/components/account/AccountClient';
export const metadata = { title: 'My Account' };
export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/login?callbackUrl=/account');
  return (<><Header/><main><AccountClient user={session.user}/></main><Footer/></>);
}

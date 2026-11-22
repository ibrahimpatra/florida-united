import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isSuperSession } from '@/lib/roles';

/** Super admin only. Normal admins are sent back to the dashboard. */
export default async function SuperOnly({ children }: { children: React.ReactNode }) {
  if (!(await isSuperSession(await getServerSession(authOptions)))) redirect('/admin/dashboard');
  return <>{children}</>;
}

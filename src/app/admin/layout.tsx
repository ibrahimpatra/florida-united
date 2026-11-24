import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isSuperSession } from '@/lib/roles';
import { AdminTopBar } from '@/components/admin/AdminTopBar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') redirect('/auth/login');
  const isSuper = await isSuperSession(session);
  return (
    <div className="flex flex-col h-screen bg-concrete overflow-hidden">
      <AdminTopBar user={session.user} isSuper={isSuper} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

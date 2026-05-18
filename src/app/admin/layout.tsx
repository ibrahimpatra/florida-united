import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') redirect('/auth/login');
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <AdminSidebar user={session.user} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

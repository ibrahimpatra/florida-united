import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isSuperSession } from '@/lib/roles';
import { AdminHome } from '@/components/admin/AdminHome';

// The admin home is the full-page menu. (The admin layout already checks the admin role.)
export default async function AdminIndex() {
  const session = await getServerSession(authOptions);
  return <AdminHome isSuper={await isSuperSession(session)} />;
}

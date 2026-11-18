import { redirect } from 'next/navigation';

// /admin has no page of its own; send people to the dashboard (the admin layout checks the admin role).
export default function AdminIndex() {
  redirect('/admin/dashboard');
}

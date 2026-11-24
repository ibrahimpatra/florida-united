import { Loader2 } from 'lucide-react';
// Shown while an admin page loads, so the screen is never blank.
export default function AdminLoading() {
  return <div className="flex items-center justify-center py-24 text-gray-400" role="status" aria-label="Loading"><Loader2 className="w-7 h-7 animate-spin" /></div>;
}

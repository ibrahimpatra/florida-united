import { Loader2 } from 'lucide-react';
export default function CheckoutLoading() {
  return <div className="flex items-center justify-center py-24 text-gray-400" role="status" aria-label="Loading"><Loader2 className="w-7 h-7 animate-spin" /></div>;
}

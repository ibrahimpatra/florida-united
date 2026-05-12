'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="bg-brand-600 text-white text-xs py-2 px-4 text-center relative">
      <span>🔥 Summer Sale — Up to 40% off Electrical Supplies! </span>
      <Link href="/deals" className="underline font-bold hover:text-blue-200 ml-1">Shop Deals →</Link>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

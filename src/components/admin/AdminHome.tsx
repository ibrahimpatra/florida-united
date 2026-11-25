'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Clock, ChevronDown } from 'lucide-react';
import { visibleGroups, ADMIN_GROUPS } from '@/lib/admin-nav';

const RECENT_KEY = 'admin-recent-pages';
export function rememberAdminPage(href: string) {
  try { const l: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); localStorage.setItem(RECENT_KEY, JSON.stringify([href, ...l.filter(x => x !== href)].slice(0, 6))); } catch { /* optional */ }
}

/** The admin home: every page as a small tile, grouped. Full width, works from phone to wide screens. */
export function AdminHome({ isSuper }: { isSuper: boolean }) {
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);   // collapsed by default; remembered
  const toggleRecent = () => setShowRecent(v => { try { localStorage.setItem('admin-recent-open', v ? '0' : '1'); } catch { /* optional */ } return !v; });
  const [badges, setBadges] = useState<{ orders: number; returns: number } | null>(null);
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); setShowRecent(localStorage.getItem('admin-recent-open') === '1'); } catch { /* optional */ }
    fetch('/api/admin/badges').then(r => r.ok ? r.json() : null).then(setBadges).catch(() => {});
  }, []);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visibleGroups(isSuper).map(g => ({ ...g, items: needle ? g.items.filter(i => `${i.label} ${i.keywords || ''} ${g.label}`.toLowerCase().includes(needle)) : g.items })).filter(g => g.items.length);
  }, [q, isSuper]);
  const all = ADMIN_GROUPS.flatMap(g => g.items.map(i => ({ ...i, color: g.color })));
  const recents = recent.map(h => all.find(i => i.href === h)).filter((i): i is typeof all[number] => !!i && (!i.superOnly || isSuper)).slice(0, 4);

  const Tile = ({ item, color }: { item: import('@/lib/admin-nav').NavItem; color: string }) => {
    const Icon = item.icon; const n = item.badge && badges ? badges[item.badge] : 0;
    return (
      <Link href={item.href} onClick={() => rememberAdminPage(item.href)} className="group relative flex flex-col items-center text-center gap-2 rounded-3xl p-3 hover:bg-gray-50 active:scale-95 transition-all">
        <span className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full ${color} text-white flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform`}>
          <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
          {n > 0 && <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">{n > 99 ? '99+' : n}</span>}
        </span>
        <span className="text-xs sm:text-sm font-semibold text-gray-700 leading-tight">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 sm:py-8">
      <div className="relative max-w-md mx-auto mb-4">
        <Search className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-4" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search pages…" className="input-field !rounded-full ps-10 py-3 text-sm w-full" aria-label="Search admin pages" />
      </div>
      {!q && recents.length > 0 && (
        <section className="mb-4">
          <button type="button" onClick={toggleRecent} aria-expanded={showRecent} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 mb-1 px-1"><Clock className="w-3.5 h-3.5" />Recent<ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRecent ? 'rotate-180' : ''}`} /></button>
          {showRecent && <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1">{recents.map(i => <Tile key={i.href} item={i} color={i.color} />)}</div>}
        </section>
      )}
      {groups.map(g => (
        <section key={g.id} className="mb-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2 px-2">{g.label}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1 rounded-[2rem] bg-white shadow-card border border-gray-100 p-2">
            {g.items.map(i => <Tile key={i.href} item={i} color={g.color} />)}
          </div>
        </section>
      ))}
      {!groups.length && <p className="text-center text-sm text-gray-500 py-10">No page matches "{q}".</p>}
    </div>
  );
}

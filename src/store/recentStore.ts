import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mergeRecent, RECENT_MAX, RecentItem } from '@/lib/recent';

interface RecentStore { ids: string[]; items: RecentItem[]; add: (id: string) => void; merge: (remote: RecentItem[]) => void; clear: () => void }

/** Recently viewed products: always kept in this browser; signed-in customers also get them saved to their account (see RecentSync). Newest first, no duplicates, ids and times only. */
export const useRecentStore = create<RecentStore>()(persist(
  (set) => ({
    ids: [], items: [],
    add: (id) => { if (!id || id.startsWith('bundle:')) return; set(s => { const items = mergeRecent(s.items, [{ id, at: Date.now() }]); return { items, ids: items.map(i => i.id) }; }); },
    merge: (remote) => set(s => { const items = mergeRecent(s.items, remote); return { items, ids: items.map(i => i.id) }; }),
    clear: () => set({ ids: [], items: [] }),
  }),
  {
    name: 'fk-recent',
    // older versions saved only ids: give them times so they can merge
    merge: (saved: any, cur) => {
      const items: RecentItem[] = Array.isArray(saved?.items) ? saved.items : (Array.isArray(saved?.ids) ? saved.ids.map((id: string, i: number) => ({ id, at: Date.now() - i * 1000 })) : []);
      const m = mergeRecent(items);
      return { ...cur, items: m, ids: m.map(i => i.id) };
    },
  },
));
void RECENT_MAX;

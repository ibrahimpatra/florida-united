import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX = 12;
interface RecentStore { ids: string[]; add: (id: string) => void; clear: () => void }

/** Recently viewed product ids, kept in this browser (localStorage). Newest first, no duplicates. */
export const useRecentStore = create<RecentStore>()(persist(
  (set) => ({
    ids: [],
    add: (id) => { if (!id || id.startsWith('bundle:')) return; set(s => ({ ids: [id, ...s.ids.filter(x => x !== id)].slice(0, MAX) })); },
    clear: () => set({ ids: [] }),
  }),
  { name: 'fk-recent' },
));

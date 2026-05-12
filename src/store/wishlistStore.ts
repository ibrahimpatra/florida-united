// src/store/wishlistStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistStore {
  items: string[]; // productIds
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  toggleItem: (productId: string) => boolean;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (productId) =>
        set((s) => ({ items: s.items.includes(productId) ? s.items : [...s.items, productId] })),
      removeItem: (productId) =>
        set((s) => ({ items: s.items.filter((id) => id !== productId) })),
      toggleItem: (productId) => {
        const isIn = get().items.includes(productId);
        if (isIn) get().removeItem(productId);
        else get().addItem(productId);
        return !isIn;
      },
      isInWishlist: (productId) => get().items.includes(productId),
      clearWishlist: () => set({ items: [] }),
    }),
    { name: 'florida-united-wishlist' }
  )
);

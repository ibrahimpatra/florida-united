import { create } from 'zustand';
import { SITE_CONFIG } from '@/lib/siteConfig';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  image: string;
  quantity: number;
  sku: string;
  variantId?: string;
  variantName?: string;
  stock: number;
  isReturnable: boolean;
  freeShipping?: boolean;
}

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getSubtotal: () => number;
  getCount: () => number;
  applyDiscount: (amount: number) => void;
  discountAmount: number;
  couponCode: string | null;
  setCoupon: (code: string, amount: number) => void;
  removeCoupon: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      discountAmount: 0,
      couponCode: null,

      addItem: (item) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => i.productId === item.productId && i.variantId === item.variantId
          );

          if (existingIndex >= 0) {
            const updated = [...state.items];
            const newQty = updated[existingIndex].quantity + (item.quantity || 1);
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: Math.min(newQty, updated[existingIndex].stock),
            };
            return { items: updated };
          }

          return {
            items: [
              ...state.items,
              { ...item, quantity: item.quantity || 1 },
            ],
          };
        });
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId)
          ),
        }));
      },

      updateQuantity: (productId, quantity, variantId) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity: Math.min(quantity, i.stock) }
              : i
          ),
        }));
      },

      clearCart: () => set({ items: [], discountAmount: 0, couponCode: null }),

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },

      getTotal: () => {
        const items = get().items;
        const subtotal = get().getSubtotal();
        const discount = get().discountAmount;
        // Shipping is free if: cart meets threshold, OR all items have freeShipping flag
        const allItemsFreeShip = items.length > 0 && items.every(i => (i as any).freeShipping);
        const shipping = (subtotal >= SITE_CONFIG.freeShippingThreshold || allItemsFreeShip)
          ? 0
          : SITE_CONFIG.defaultShippingCost;
        return Math.max(0, subtotal - discount + shipping);
      },

      getCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      applyDiscount: (amount) => set({ discountAmount: amount }),

      setCoupon: (code, amount) => set({ couponCode: code, discountAmount: amount }),

      removeCoupon: () => set({ couponCode: null, discountAmount: 0 }),
    }),
    {
      name: 'florida-united-cart',
      partialize: (state) => ({
        items: state.items,
        couponCode: state.couponCode,
        discountAmount: state.discountAmount,
      }),
    }
  )
);

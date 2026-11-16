// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format price in KWD (Kuwaiti Dinar)
/** True only in the browser while the Arabic UI is active (admin/server/PDF are always English). */
const arabicUi = () => typeof document !== 'undefined' && document.documentElement.lang === 'ar';

export function formatPrice(amount: number, currency = 'KWD'): string {
  const n = Number(amount) || 0;
  if (arabicUi() && currency === 'KWD') return `${n.toFixed(3)} د.ك`;
  return new Intl.NumberFormat('en-KW', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
}

/** Percentage off: calculateDiscount(originalPrice, salePrice) */
export function calculateDiscount(originalPrice: number, salePrice: number): number {
  if (!originalPrice || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(arabicUi() ? 'ar-KW-u-nu-latn' : 'en-KW', options || {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(arabicUi() ? 'ar-KW-u-nu-latn' : 'en-KW', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function generateOrderNumber(): string {
  // Format: 3 uppercase alpha + hyphen + 4 digits  e.g. KXR-7291
  // No I/O in alpha set to avoid confusion with 1/0
  const alpha  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rand3  = Array.from({ length: 3 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
  // XOR timestamp with a random salt so the digits look random, not sequential
  const salt   = Math.floor(Math.random() * 9999);
  const digits = (((Date.now() % 100000) ^ salt) % 10000).toString().padStart(4, '0');
  return `${rand3}-${digits}`;
}

export function isValidKuwaitPhone(phone: string): boolean {
  // Kuwait numbers: +965 followed by 8 digits starting with 5,6,9
  const cleaned = phone.replace(/\D/g, '');
  return /^(965)?[569]\d{7}$/.test(cleaned);
}

export function formatKuwaitPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('965')) return `+${cleaned}`;
  if (cleaned.length === 8) return `+965${cleaned}`;
  return phone;
}

// Alias used by some pages
export const generateSlug = slugify;

export function generateSKU(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/).slice(0, 3);
  const prefix = words.map(w => w.slice(0, 3)).join('');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

export function buildShareUrl(productSlug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/products/${productSlug}`;
}

export const ORDER_STATUSES = [
  { value: 'pending',           label: 'Pending',           color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed',         label: 'Confirmed',         color: 'bg-blue-100 text-blue-800' },
  { value: 'processing',        label: 'Processing',        color: 'bg-indigo-100 text-indigo-800' },
  { value: 'shipped',           label: 'Shipped',           color: 'bg-purple-100 text-purple-800' },
  { value: 'out_for_delivery',  label: 'Out for Delivery',  color: 'bg-orange-100 text-orange-800' },
  { value: 'delivered',         label: 'Delivered',         color: 'bg-green-100 text-green-800' },
  { value: 'cancelled',         label: 'Cancelled',         color: 'bg-red-100 text-red-800' },
  { value: 'return_requested',  label: 'Return Requested',  color: 'bg-pink-100 text-pink-800' },
  { value: 'return_approved',   label: 'Return Approved',   color: 'bg-teal-100 text-teal-800' },
  { value: 'return_rejected',   label: 'Return Rejected',   color: 'bg-red-100 text-red-800' },
  { value: 'return_picked_up',  label: 'Return Picked Up',  color: 'bg-cyan-100 text-cyan-800' },
  { value: 'returned',          label: 'Returned',          color: 'bg-gray-100 text-gray-800' },
  { value: 'refunded',          label: 'Refunded',          color: 'bg-emerald-100 text-emerald-800' },
] as const;

export function getStatusLabel(status: string): string {
  return ORDER_STATUSES.find(s => s.value === status)?.label ?? status.replace(/_/g, ' ');
}

export function getStatusColor(status: string): string {
  return ORDER_STATUSES.find(s => s.value === status)?.color ?? 'bg-gray-100 text-gray-800';
}

export const ORDER_STATUS_STEPS = [
  { key: 'pending',          label: 'Order Placed',      icon: '' },
  { key: 'confirmed',        label: 'Confirmed',         icon: '' },
  { key: 'processing',       label: 'Processing',        icon: '' },
  { key: 'shipped',          label: 'Shipped',           icon: '' },
  { key: 'out_for_delivery', label: 'Out for Delivery',  icon: '' },
  { key: 'delivered',        label: 'Delivered',         icon: '' },
] as const;

export function getOrderProgress(status: string): number {
  const idx = ORDER_STATUS_STEPS.findIndex(s => s.key === status);
  if (idx === -1) return 0;
  return Math.round((idx / (ORDER_STATUS_STEPS.length - 1)) * 100);
}
/** Translated order-status label; falls back to the English label for unknown statuses. */
export function statusText(t: (k: string) => string, status: string): string {
  const k = `orders.s_${status}`;
  const v = t(k);
  return v === k ? getStatusLabel(status) : v;
}

/** Display name for a Kuwait governorate (stored values stay in English). */
export const GOVERNORATE_AR: Record<string, string> = {
  'Al Asimah (Capital)': 'العاصمة', Hawalli: 'حولي', Farwaniya: 'الفروانية',
  Ahmadi: 'الأحمدي', Jahra: 'الجهراء', 'Mubarak Al-Kabeer': 'مبارك الكبير',
};
export const govLabel = (g: string | undefined, isArabic: boolean) => (g ? (isArabic ? GOVERNORATE_AR[g] || g : g) : '');

/** One place that knows how a saved shipping address is laid out (new Kuwait-style and legacy orders). */
export function formatAddress(sa: any): { name: string; line1: string; line2: string; phone: string } {
  const a = sa || {};
  const name = String(a.name || `${a.firstName || ''} ${a.lastName || ''}`).trim();
  const line1 = [a.block && `Block ${a.block}`, a.street || a.address1, a.building && `Building ${a.building}`, a.floor && `Floor ${a.floor}`, a.apartment && `Apt ${a.apartment}`, a.area]
    .filter(Boolean).join(', ');
  const line2 = [a.city, a.governorate, a.country || 'Kuwait'].filter(Boolean).join(', ');
  return { name, line1, line2, phone: String(a.phone || '') };
}

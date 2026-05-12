// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format price in KWD (Kuwaiti Dinar)
export function formatPrice(amount: number, currency = 'KWD'): string {
  return new Intl.NumberFormat('en-KW', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

export function calculateDiscount(originalPrice: number, salePrice: number): number {
  if (!originalPrice || originalPrice <= salePrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-KW', options || {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-KW', {
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
  const prefix = 'FUK'; // Florida United Kuwait
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
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
  { key: 'pending',          label: 'Order Placed',      icon: '🛒' },
  { key: 'confirmed',        label: 'Confirmed',         icon: '✅' },
  { key: 'processing',       label: 'Processing',        icon: '⚙️' },
  { key: 'shipped',          label: 'Shipped',           icon: '📦' },
  { key: 'out_for_delivery', label: 'Out for Delivery',  icon: '🚚' },
  { key: 'delivered',        label: 'Delivered',         icon: '🎉' },
] as const;

export function getOrderProgress(status: string): number {
  const idx = ORDER_STATUS_STEPS.findIndex(s => s.key === status);
  if (idx === -1) return 0;
  return Math.round((idx / (ORDER_STATUS_STEPS.length - 1)) * 100);
}
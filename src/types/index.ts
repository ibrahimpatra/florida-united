// src/types/index.ts

export type UserRole = 'admin' | 'customer';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  photoURL?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  addresses?: Address[];
  defaultAddressId?: string;
}

export interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  block?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  city: string;
  governorate: string; // Kuwait governorate
  country: string;
  phone?: string;
  isDefault: boolean;
}

export const KUWAIT_GOVERNORATES = [
  'Capital (العاصمة)',
  'Hawalli (حولي)',
  'Farwaniya (الفروانية)',
  'Ahmadi (الأحمدي)',
  'Jahra (الجهراء)',
  'Mubarak Al-Kabeer (مبارك الكبير)',
];

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  parentId?: string;
  parentName?: string;
  isActive: boolean;
  sortOrder: number;
  metaTitle?: string;
  metaDesc?: string;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  price?: number;
  stock: number;
  sku?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  sku: string;
  barcode?: string;
  price: number; // KWD
  comparePrice?: number;
  costPrice?: number;
  stock: number;
  lowStockAlert: number;
  weight?: number;
  categoryId: string;
  categoryName?: string;
  brand?: string;
  images: string[];
  tags: string[];
  isFeatured: boolean;
  isNewArrival: boolean;
  isOnSale: boolean;
  isActive: boolean;
  isReturnable: boolean;
  returnDays: number;
  uomId?: string;
  uomName?: string;
  uomAbbr?: string;
  metaTitle?: string;
  metaDesc?: string;
  metaKeywords?: string;
  avgRating: number;
  totalReviews: number;
  totalSold: number;
  variants?: ProductVariant[];
  // AI recommendation fields
  aiTags?: string[]; // e.g. ['mobile', 'samsung', 'android', 'smartphone']
  compatibleWith?: string[]; // product IDs this is compatible with
  createdAt: string;
  updatedAt: string;
}

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
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'return_photo_pending'
  | 'return_approved'
  | 'return_rejected'
  | 'return_picked_up'
  | 'returned'
  | 'refunded';

export type PaymentMethod = 'tap' | 'cod' | 'card';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'cod_pending';

export interface OrderItem {
  productId: string;
  productName: string;
  productSku: string;
  variantName?: string;
  price: number;
  quantity: number;
  total: number;
  image?: string;
  isReturnable: boolean;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  note?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  shippingAddress: Address;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  tapChargeId?: string;
  tapSessionId?: string;
  stripePaymentId?: string;
  stripeSessionId?: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  tax: number;
  total: number;
  currency: string; // 'KWD'
  couponCode?: string;
  notes?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export type ReturnStatus = 'pending' | 'photo_submitted' | 'approved' | 'rejected' | 'picked_up' | 'completed' | 'refunded';

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  reason: string;
  description?: string;
  status: ReturnStatus;
  refundAmount?: number;
  isRefundable: boolean;
  refundMethod?: string;
  adminNote?: string;
  images?: string[]; // customer photo evidence
  adminImages?: string[]; // admin verification photos
  photoVerified?: boolean;
  autoApproved?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  productName?: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  isVerified: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderAmount: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  mobileImage?: string;
  link?: string;
  buttonText?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Offer {
  id: string;
  title: string;
  description?: string;
  image?: string;
  discount: number;
  type: 'percentage' | 'fixed';
  categoryId?: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'order';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// AI Recommendation types
export interface ProductRecommendation {
  product: Product;
  score: number;
  reason: string; // 'frequently_bought_together' | 'same_category' | 'compatible' | 'similar_specs'
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Filter/Sort types
export interface ProductFilters {
  categoryId?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  inStock?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  freeShipping?: boolean;    // This product always ships free regardless of cart total
  isOnSale?: boolean;
  tags?: string[];
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest' | 'popular' | 'rating';
  page?: number;
  pageSize?: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  revenueChange: number;
  ordersChange: number;
  recentOrders: Order[];
  topProducts: Array<{ product: Product; sold: number; revenue: number }>;
  ordersByStatus: Record<string, number>;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
}

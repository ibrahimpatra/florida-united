// src/types/index.ts

export interface Address {
  name: string;
  phone?: string;
  street: string;
  area: string;
  block?: string;
  avenue?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  city: string;
  governorate: string;
  country: string;
  instructions?: string;
  isDefault?: boolean;
}

export interface ShippingAddress {
  name: string;
  phone?: string;
  street: string;
  area: string;
  block?: string;
  avenue?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  city: string;
  governorate: string;
  country: string;
  instructions?: string;
}

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
  showOnHome: boolean;     // show in homepage category grid
  showOnNav: boolean;      // show in header navigation bar
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
  price: number;
  comparePrice?: number;
  costPrice?: number;
  stock: number;
  lowStockAlert?: number;
  weight?: number;
  categoryId: string;
  categoryName: string;
  brand?: string;
  images: string[];
  tags?: string[];
  variants?: ProductVariant[];
  isFeatured: boolean;
  isNewArrival: boolean;
  isOnSale: boolean;
  isActive: boolean;
  isReturnable: boolean;
  returnDays?: number;
  metaTitle?: string;
  metaDesc?: string;
  avgRating: number;
  totalReviews: number;
  totalSold: number;
  aiTags?: string[];
  unit?: string;
  unitQty?: number;
  uomName?: string;
  uomAbbr?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productSku: string;
  variantId?: string;
  variantName?: string;
  price: number;
  quantity: number;
  total: number;
  image?: string;
  isReturnable?: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  couponId?: string;
  shippingCost: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentReference?: string;
  stripePaymentId?: string;
  shippingAddress: ShippingAddress;
  shippingMethod?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  notes?: string;
  adminNotes?: string;
  statusHistory?: Array<{ status: string; note: string; createdAt: string }>;
  deliveredAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'admin' | 'staff';
  addresses?: Address[];
  totalOrders?: number;
  totalSpent?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id?: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  images?: string[];
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
  description?: string;
  createdAt: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  mobileImage?: string;
  link?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Offer {
  id: string;
  title: string;
  description?: string;
  image?: string;
  link?: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  items?: OrderItem[];
  reason: string;
  description?: string;
  images?: string[];
  adminImages?: string[];
  status: string;
  refundAmount?: number;
  adminNote?: string;
  isRefundable?: boolean;
  autoApproved?: boolean;
  photoVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilters {
  categoryId?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  inStock?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isOnSale?: boolean;
  search?: string;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'popular' | 'rating';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  revenueChange: number;
  ordersChange: number;
  recentOrders: Order[];
  topProducts: Product[];
  ordersByStatus: Record<string, number>;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// Kuwait governorates — used in checkout and shipping admin
export const KUWAIT_GOVERNORATES = [
  'Al Asimah (Capital)',
  'Hawalli',
  'Farwaniya',
  'Ahmadi',
  'Jahra',
  'Mubarak Al-Kabeer',
] as const;

export type KuwaitGovernorate = typeof KUWAIT_GOVERNORATES[number];

export type ReturnStatus = 'pending' | 'photo_submitted' | 'approved' | 'rejected' | 'picked_up' | 'returned' | 'completed' | 'refunded';

// Cart item — used by checkout and cart store
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  quantity: number;
  sku?: string;
  variantId?: string;
  variantName?: string;
  stock: number;
  isReturnable?: boolean;
}

// Product recommendation with reason
export interface ProductRecommendation extends Product {
  reason?: string;
  score?: number;
}

// Flash deal type
export interface FlashDeal {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string;
  originalPrice: number;
  dealPrice: number;
  discount: number;
  stock: number;
  soldCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

// UOM type
export interface UOM {
  id: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
  createdAt: string;
}

// Shipping zone type
export interface ShippingZone {
  id: string;
  name: string;
  governorates: string[];
  baseRate: number;
  freeShippingThreshold?: number;
  estimatedDays: string;
  isActive: boolean;
  createdAt: string;
}

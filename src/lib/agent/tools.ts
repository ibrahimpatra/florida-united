/**
 * Tools the Gemini agent may call. Every tool runs on the SERVER with the caller's real session:
 *  - "public" tools read the same catalogue the storefront shows (active products only)
 *  - "user" tools only ever read the signed-in customer's own orders
 *  - "admin" tools exist only when session.role === 'admin' (checked here, not by the model)
 *  - "write" tools never run straight from the model: they return a preview and the human must press Confirm
 */
import { getAdminDb } from '../firebase-admin';
import {
  adminGetProducts, adminGetCategories, adminGetOrders, adminGetOrderByNumber, adminUpdateOrderStatus,
  adminCreateProduct, adminUpdateProduct, adminGetDashboardStats, adminGetProductBySlug,
} from '../firestore-admin';
import { placeOrder, loadShippingSettings, OrderError } from '../orders-server';
import { SITE_CONFIG } from '../siteConfig';
import { formatAddress } from '../utils';
import { getUsdRate, cardEnabled } from '../stripe';

export interface AgentUser { id?: string; email?: string; name?: string; role?: string }
export interface ToolResult { data: any; pending?: PendingAction }
export interface PendingAction { name: string; args: any; summary: string }

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const prod = (p: any) => ({
  name: p.name, nameAr: p.nameAr || undefined, sku: p.sku, price: p.price, comparePrice: p.comparePrice || undefined,
  inStock: (p.stock ?? 0) > 0, stock: p.stock, brand: p.brand || undefined, category: p.categoryName,
  slug: p.slug, link: `/product/${p.slug}`,
  units: (p.units || []).map((u: any) => ({ name: u.name, nameAr: u.nameAr, baseUnitsInside: u.factor, price: u.price })),
  freeShipping: !!p.freeShipping, returnable: p.isReturnable !== false,
});
const order = (o: any) => ({
  orderNumber: o.orderNumber, status: o.status, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
  total: o.total, createdAt: o.createdAt, governorate: o.shippingAddress?.governorate,
  trackingNumber: o.trackingNumber || undefined, carrier: o.carrier || undefined,
  items: (o.items || []).map((i: any) => ({ name: i.productName, nameAr: i.productNameAr || undefined, unit: i.variantName || undefined, qty: i.quantity, lineTotal: i.total })),
});

export const PUBLIC_DECLS: any[] = [
  { name: 'search_products', description: 'Search the store catalogue by keyword (English or Arabic, typo tolerant). Optionally filter by category slug, max price (KWD) or in-stock only.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, categorySlug: { type: 'STRING' }, maxPrice: { type: 'NUMBER' }, inStockOnly: { type: 'BOOLEAN' }, limit: { type: 'INTEGER' } } } },
  { name: 'get_product', description: 'Full details of one product by slug (from search results).', parameters: { type: 'OBJECT', properties: { slug: { type: 'STRING' } }, required: ['slug'] } },
  { name: 'list_categories', description: 'All store categories.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'store_info', description: 'Contact details, opening hours, shipping, payment methods (cash on delivery and card in USD), return policy and currency.', parameters: { type: 'OBJECT', properties: {} } },
];
export const USER_DECLS: any[] = [
  { name: 'my_orders', description: "The signed-in customer's own recent orders with their items and status.", parameters: { type: 'OBJECT', properties: { limit: { type: 'INTEGER' } } } },
  { name: 'my_order_status', description: "Status of one of the signed-in customer's own orders by order number.", parameters: { type: 'OBJECT', properties: { orderNumber: { type: 'STRING' } }, required: ['orderNumber'] } },
];
export const ADMIN_DECLS: any[] = [
  { name: 'admin_stats', description: 'Dashboard numbers: revenue, orders, customers, top products, low stock.', parameters: { type: 'OBJECT', properties: {} } },
  { name: 'admin_orders', description: 'List orders, optionally by status (pending, confirmed, processing, shipped, delivered, cancelled) or a search term.', parameters: { type: 'OBJECT', properties: { status: { type: 'STRING' }, search: { type: 'STRING' }, limit: { type: 'INTEGER' } } } },
  { name: 'admin_order', description: 'Full detail of any order by order number.', parameters: { type: 'OBJECT', properties: { orderNumber: { type: 'STRING' } }, required: ['orderNumber'] } },
  { name: 'admin_low_stock', description: 'Products that are out of stock or at/below their low-stock alert.', parameters: { type: 'OBJECT', properties: { limit: { type: 'INTEGER' } } } },
  { name: 'admin_update_order_status', description: 'PROPOSE changing an order status. The admin must confirm before it happens.', parameters: { type: 'OBJECT', properties: { orderNumber: { type: 'STRING' }, status: { type: 'STRING' }, note: { type: 'STRING' } }, required: ['orderNumber', 'status'] } },
  { name: 'admin_create_product', description: 'PROPOSE creating a product. Needs name, price (KWD) and a category slug from list_categories. The admin must confirm.',
    parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, nameAr: { type: 'STRING' }, price: { type: 'NUMBER' }, stock: { type: 'INTEGER' }, categorySlug: { type: 'STRING' }, sku: { type: 'STRING' }, brand: { type: 'STRING' }, description: { type: 'STRING' }, descriptionAr: { type: 'STRING' } }, required: ['name', 'price', 'categorySlug'] } },
  { name: 'admin_update_product', description: 'PROPOSE changing a product price and/or stock (by SKU). The admin must confirm.', parameters: { type: 'OBJECT', properties: { sku: { type: 'STRING' }, price: { type: 'NUMBER' }, stock: { type: 'INTEGER' } }, required: ['sku'] } },
  { name: 'admin_place_order', description: 'PROPOSE placing a cash-on-delivery order for a registered customer. Needs customerEmail, items (sku + quantity), and a Kuwait delivery address. The admin must confirm.',
    parameters: { type: 'OBJECT', properties: { customerEmail: { type: 'STRING' }, items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { sku: { type: 'STRING' }, quantity: { type: 'INTEGER' } }, required: ['sku', 'quantity'] } },
      firstName: { type: 'STRING' }, lastName: { type: 'STRING' }, phone: { type: 'STRING' }, governorate: { type: 'STRING' }, city: { type: 'STRING' }, block: { type: 'STRING' }, street: { type: 'STRING' }, building: { type: 'STRING' } },
      required: ['customerEmail', 'items', 'firstName', 'phone', 'governorate', 'city', 'block', 'street', 'building'] } },
];

export function declsFor(user: AgentUser) {
  const d = [...PUBLIC_DECLS];
  if (user.id) d.push(...USER_DECLS);
  if (user.role === 'admin') d.push(...ADMIN_DECLS);
  return d;
}

const WRITE_TOOLS = new Set(['admin_update_order_status', 'admin_create_product', 'admin_update_product', 'admin_place_order']);
const lim = (n: any, d = 8, max = 20) => Math.min(max, Math.max(1, Number(n) || d));

async function skuProduct(sku: string) {
  const r = await adminGetProducts({ search: sku, admin: true, pageSize: 20 } as any);
  return r.items.find(p => String(p.sku).toLowerCase() === String(sku).toLowerCase()) || null;
}

/** Run a read tool, or turn a write tool into a preview that needs a human click. */
export async function runTool(name: string, a: any, user: AgentUser): Promise<ToolResult> {
  const admin = user.role === 'admin';
  if (name.startsWith('admin_') && !admin) return { data: { error: 'Not allowed.' } };
  if ((name === 'my_orders' || name === 'my_order_status') && !user.id) return { data: { error: 'The customer must sign in first.' } };

  if (WRITE_TOOLS.has(name)) return preview(name, a);

  switch (name) {
    case 'search_products': {
      const r = await adminGetProducts({ search: a.query || undefined, categorySlug: a.categorySlug || undefined, maxPrice: a.maxPrice, inStock: !!a.inStockOnly, pageSize: lim(a.limit) } as any);
      return { data: { total: r.total, products: r.items.map(prod) } };
    }
    case 'get_product': {
      const p = await adminGetProductBySlug(String(a.slug || ''));
      if (!p || p.isActive === false) return { data: { error: 'Product not found.' } };
      return { data: { ...prod(p), description: p.description, descriptionAr: p.descriptionAr, weightKg: p.weight, returnDays: p.returnDays } };
    }
    case 'list_categories': {
      const c = await adminGetCategories(true);
      return { data: c.map(x => ({ name: x.name, nameAr: x.nameAr, slug: x.slug, parent: x.parentName || undefined })) };
    }
    case 'store_info': {
      const { settings } = await loadShippingSettings();
      const rate = await getUsdRate();
      return { data: {
        name: SITE_CONFIG.fullName, nameAr: SITE_CONFIG.fullNameAr, phone: SITE_CONFIG.phone, whatsapp: SITE_CONFIG.whatsapp, email: SITE_CONFIG.email,
        address: SITE_CONFIG.addressFull, addressAr: SITE_CONFIG.addressFullAr, currency: 'KWD (no VAT)',
        freeShippingFrom: settings.freeShippingThreshold ?? null, defaultShippingCost: settings.defaultShippingCost,
        payment: { cashOnDelivery: settings.codEnabled !== false, codFee: settings.codFee ?? 0, card: cardEnabled() ? `Card via Stripe, charged in USD at 1 KWD = ${rate} USD` : 'Card payment currently unavailable' },
        returns: 'Returns accepted on returnable products within the return window after delivery; start from My Orders.',
      } };
    }
    case 'my_orders': {
      const s = await getAdminDb().collection('orders').where('userId', '==', user.id).get();
      const list = s.docs.map(d => d.data() as any).sort((x, y) => String(y.createdAt?.toDate?.()?.toISOString?.() ?? y.createdAt).localeCompare(String(x.createdAt?.toDate?.()?.toISOString?.() ?? x.createdAt))).slice(0, lim(a.limit, 5, 10));
      return { data: list.map(order) };
    }
    case 'my_order_status': {
      const o: any = await adminGetOrderByNumber(String(a.orderNumber || '').trim().toUpperCase());
      if (!o || o.userId !== user.id) return { data: { error: 'Order not found on your account.' } };
      return { data: order(o) };
    }
    case 'admin_stats': return { data: await adminGetDashboardStats() };
    case 'admin_orders': {
      const r = await adminGetOrders({ status: a.status || undefined, search: a.search || undefined, pageSize: lim(a.limit, 10, 25) });
      return { data: { total: r.total, orders: r.items.map((o: any) => ({ orderNumber: o.orderNumber, status: o.status, total: o.total, customer: o.userName, paymentStatus: o.paymentStatus })) } };
    }
    case 'admin_order': {
      const o: any = await adminGetOrderByNumber(String(a.orderNumber || '').trim().toUpperCase());
      return { data: o ? { ...order(o), customer: o.userName, email: o.userEmail, phone: o.shippingAddress?.phone, address: `${formatAddress(o.shippingAddress).line1}, ${formatAddress(o.shippingAddress).line2}` } : { error: 'Order not found.' } };
    }
    case 'admin_low_stock': {
      const r = await adminGetProducts({ admin: true, stockStatus: 'low', pageSize: lim(a.limit, 15, 40) } as any);
      const o = await adminGetProducts({ admin: true, stockStatus: 'out', pageSize: 15 } as any);
      return { data: { low: r.items.map(p => ({ name: p.name, sku: p.sku, stock: p.stock })), out: o.items.map(p => ({ name: p.name, sku: p.sku })) } };
    }
  }
  return { data: { error: 'Unknown tool.' } };
}

async function preview(name: string, a: any): Promise<ToolResult> {
  switch (name) {
    case 'admin_update_order_status': {
      if (!STATUSES.includes(a.status)) return { data: { error: `Status must be one of: ${STATUSES.join(', ')}` } };
      const o: any = await adminGetOrderByNumber(String(a.orderNumber || '').trim().toUpperCase());
      if (!o) return { data: { error: 'Order not found.' } };
      return pend(name, { orderNumber: o.orderNumber, status: a.status, note: a.note || '' }, `Change order ${o.orderNumber} from "${o.status}" to "${a.status}"`);
    }
    case 'admin_create_product': {
      const cats = await adminGetCategories(false);
      const c = cats.find(x => x.slug === a.categorySlug);
      if (!c) return { data: { error: 'Unknown category slug. Call list_categories first.' } };
      if (!(Number(a.price) >= 0) || !String(a.name || '').trim()) return { data: { error: 'Name and a valid price are required.' } };
      return pend(name, { ...a, price: Number(a.price), stock: Number(a.stock) || 0, categoryId: c.id }, `Create product "${a.name}"${a.nameAr ? ` / ${a.nameAr}` : ''} in ${c.name} at KWD ${Number(a.price).toFixed(3)}, stock ${Number(a.stock) || 0}`);
    }
    case 'admin_update_product': {
      const p = await skuProduct(a.sku);
      if (!p) return { data: { error: 'No product with that SKU.' } };
      const patch: any = {};
      if (a.price !== undefined) patch.price = Number(a.price);
      if (a.stock !== undefined) patch.stock = Number(a.stock);
      if (!Object.keys(patch).length) return { data: { error: 'Nothing to change.' } };
      return pend(name, { id: p.id, ...patch }, `Update "${p.name}" (${p.sku}): ${patch.price !== undefined ? `price ${p.price} -> ${patch.price}` : ''} ${patch.stock !== undefined ? `stock ${p.stock} -> ${patch.stock}` : ''}`.trim());
    }
    case 'admin_place_order': {
      const items: any[] = [];
      for (const it of a.items || []) {
        const p = await skuProduct(it.sku);
        if (!p) return { data: { error: `No product with SKU ${it.sku}.` } };
        items.push({ productId: p.id, quantity: Math.max(1, Number(it.quantity) || 1), label: `${it.quantity} x ${p.name}` });
      }
      if (!items.length) return { data: { error: 'No items.' } };
      const u = await getAdminDb().collection('users').where('email', '==', String(a.customerEmail).toLowerCase().trim()).limit(1).get();
      if (u.empty) return { data: { error: 'No registered customer with that email.' } };
      return pend(name, { ...a, userId: u.docs[0].id, items }, `Place a cash-on-delivery order for ${a.customerEmail}: ${items.map(i => i.label).join(', ')} to ${a.governorate}`);
    }
  }
  return { data: { error: 'Unknown tool.' } };
}
const pend = (name: string, args: any, summary: string): ToolResult => ({
  data: { status: 'awaiting_admin_confirmation', note: 'Tell the admin what will happen and that they must press Confirm.', summary }, pending: { name, args, summary },
});

/** Executes a confirmed write. Called ONLY from the Confirm button, after the admin session is re-checked. */
export async function executeConfirmed(p: PendingAction, user: AgentUser): Promise<string> {
  if (user.role !== 'admin') throw new Error('Not allowed.');
  const a = p.args;
  switch (p.name) {
    case 'admin_update_order_status': {
      const o: any = await adminGetOrderByNumber(a.orderNumber);
      if (!o) throw new Error('Order not found.');
      if (a.status === 'cancelled') {
        const { cancelOrder } = await import('../orders-server');
        await cancelOrder({ orderId: o.id, actor: { id: user.id || 'agent', role: 'admin' }, note: a.note || 'Cancelled by admin assistant' });
      } else await adminUpdateOrderStatus(o.id, a.status, a.note || 'Updated by admin assistant');
      return `Order ${a.orderNumber} is now "${a.status}".`;
    }
    case 'admin_create_product': {
      const id = await adminCreateProduct({
        name: a.name, nameAr: a.nameAr || undefined, price: a.price, stock: a.stock, categoryId: a.categoryId, brand: a.brand || undefined,
        sku: a.sku || undefined, description: a.description || '', descriptionAr: a.descriptionAr || undefined, images: [],
        isFeatured: false, isNewArrival: true, isOnSale: false, isActive: true, isReturnable: true,
      } as any);
      void id;
      return `Product "${a.name}" created. Add photos from Admin > Products.`;
    }
    case 'admin_update_product': {
      const { id, ...patch } = a;
      await adminUpdateProduct(id, patch);
      return 'Product updated.';
    }
    case 'admin_place_order': {
      try {
        const r: any = await placeOrder({
          userId: a.userId, userEmail: String(a.customerEmail).toLowerCase(), userName: `${a.firstName} ${a.lastName || ''}`.trim(), userPhone: a.phone,
          items: a.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })),
          shippingAddress: { firstName: a.firstName, lastName: a.lastName || '', phone: a.phone, governorate: a.governorate, city: a.city, block: a.block, street: a.street, building: a.building },
          paymentMethod: 'cod', notes: 'Placed by admin assistant',
        });
        return `Order ${r.orderNumber} placed (cash on delivery).`;
      } catch (e) { throw new Error(e instanceof OrderError ? e.message : 'Could not place the order.'); }
    }
  }
  throw new Error('Unknown action.');
}

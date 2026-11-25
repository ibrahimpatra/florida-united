/** The admin menu: one list used by the full-page grid and the top bar. Add a page here and it appears everywhere. */
import { LayoutDashboard, ShoppingCart, RotateCcw, Users, Package, Gift, Tag, Award, Ruler, Upload, Image, Megaphone, Sparkles, Zap, Percent, Truck, Settings, ListChecks, AlertTriangle, Network, BarChart2, Bell, Sparkles as SparklesIcon } from 'lucide-react';

export interface NavItem { href: string; label: string; icon: any; superOnly?: boolean; badge?: 'orders' | 'returns'; keywords?: string }
export interface NavGroup { id: string; label: string; color: string; items: NavItem[] }

export const ADMIN_GROUPS: NavGroup[] = [
  { id: 'sales', label: 'Sales', color: 'bg-blue-600', items: [
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, badge: 'orders', keywords: 'order status ship deliver' },
    { href: '/admin/returns', label: 'Returns', icon: RotateCcw, badge: 'returns', keywords: 'refund return' },
    { href: '/admin/customers', label: 'Customers', icon: Users, keywords: 'users clients' },
  ] },
  { id: 'catalog', label: 'Catalog', color: 'bg-emerald-600', items: [
    { href: '/admin/products', label: 'Products', icon: Package, keywords: 'items stock price sku' },
    { href: '/admin/bundles', label: 'Bundles', icon: Gift, keywords: 'kit pack' },
    { href: '/admin/categories', label: 'Categories', icon: Tag },
    { href: '/admin/brands', label: 'Brands', icon: Award },
    { href: '/admin/uoms', label: 'Units', icon: Ruler, keywords: 'uom measure' },
    { href: '/admin/import', label: 'Bulk import', icon: Upload, keywords: 'excel csv upload' },
  ] },
  { id: 'marketing', label: 'Marketing', color: 'bg-orange-500', items: [
    { href: '/admin/banners', label: 'Banners', icon: Image },
    { href: '/admin/popups', label: 'Popups', icon: Megaphone },
    { href: '/admin/notifications', label: 'Notifications', icon: Bell, keywords: 'bell message offer announce send' },
    { href: '/admin/promo-tiles', label: 'Promo tiles', icon: Sparkles },
    { href: '/admin/flash-deals', label: 'Flash deals', icon: Zap, keywords: 'deals offers sale' },
    { href: '/admin/coupons', label: 'Coupons', icon: Percent, keywords: 'discount code' },
    { href: '/admin/loyalty', label: 'Loyalty', icon: Gift, superOnly: true, keywords: 'points rewards' },
  ] },
  { id: 'reports', label: 'Reports', color: 'bg-violet-600', items: [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'sales stats revenue' },
  ] },
  { id: 'settings', label: 'Settings', color: 'bg-gray-700', items: [
    { href: '/admin/settings', label: 'Store settings', icon: Settings, superOnly: true, keywords: 'payments cod' },
    { href: '/admin/shipping', label: 'Shipping zones', icon: Truck, superOnly: true, keywords: 'delivery' },
    { href: '/admin/jobs', label: 'Background jobs', icon: ListChecks, superOnly: true, keywords: 'seo cron' },
    { href: '/admin/issues', label: 'Issues', icon: AlertTriangle, superOnly: true, keywords: 'errors logs' },
    { href: '/admin/ai-usage', label: 'AI usage', icon: SparklesIcon, superOnly: true, keywords: 'gemini openai tokens cost' },
    { href: '/admin/graph', label: 'Code graph', icon: Network, superOnly: true },
  ] },
];

export const visibleGroups = (isSuper: boolean) =>
  ADMIN_GROUPS.map(g => ({ ...g, items: g.items.filter(i => !i.superOnly || isSuper) })).filter(g => g.items.length);

export function findNav(path: string): { item: NavItem; group: NavGroup } | null {
  let best: { item: NavItem; group: NavGroup } | null = null;
  for (const g of ADMIN_GROUPS) for (const item of g.items)
    if ((path === item.href || path.startsWith(item.href + '/')) && (!best || item.href.length > best.item.href.length)) best = { item, group: g };
  return best;
}

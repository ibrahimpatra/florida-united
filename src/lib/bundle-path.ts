import { slugify } from './utils';
/** Bundle page address: /shop/bundles/<readable-name>-<id>. The id after the last dash is what finds the bundle, so renaming a bundle never breaks an old link. */
export const bundleSlug = (b: { id: string; name?: string }) => `${slugify(b.name || '') || 'bundle'}-${b.id}`;
export const bundlePath = (b: { id: string; name?: string }) => `/shop/bundles/${bundleSlug(b)}`;
export const bundleIdFromSlug = (slug: string) => decodeURIComponent(slug).split('-').pop() || '';

'use client';
import { bundlePath } from '@/lib/bundle-path';
import { useState, useEffect, useRef } from 'react';
import { X, Search, ArrowRight, Clock, TrendingUp, LayoutGrid } from 'lucide-react';
import Link, { localizePath } from '@/components/ui/LocLink';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Product } from '@/types';

interface Props { isOpen: boolean; onClose: () => void; }

export function SearchModal({ isOpen, onClose }: Props) {
  const { t, L, dir } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const reqId = useRef(0);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      try { setRecent(JSON.parse(localStorage.getItem('fu-recent-searches') || '[]')); } catch { setRecent([]); }
      if (!cats.length) fetch('/api/categories').then(r => (r.ok ? r.json() : [])).then((d: any[]) => setCats((Array.isArray(d) ? d : []).filter(c => c.isActive !== false && !c.parentId).slice(0, 6))).catch(() => {});
    } else { setQuery(''); setResults([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const [bundleHits, setBundleHits] = useState<any[]>([]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); setBundleHits([]); setLoading(false); return; }
    clearTimeout(debounceRef.current);
    setLoading(true);
    const id = ++reqId.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(query)}&limit=6`);
        const data = await res.json();
        if (id === reqId.current) { setResults(data.items || []); setBundleHits(data.bundles || []); }
      } catch {}
      if (id === reqId.current) setLoading(false);
    }, 350);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function saveSearch(term: string) {
    const updated = [term, ...recent.filter(r => r !== term)].slice(0, 5);
    setRecent(updated);
    try { localStorage.setItem('fu-recent-searches', JSON.stringify(updated)); } catch {}
  }
  function handleSearch(term: string) {
    saveSearch(term);
    window.location.href = localizePath(`/search?q=${encodeURIComponent(term)}`, window.location.pathname);
    onClose();
  }

  if (!isOpen) return null;
  const label = 'text-xs font-semibold text-gray-400';

  return (
    <div dir={dir} className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4" role="dialog" aria-label={t('c1_search.dialog')}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && query.trim() && handleSearch(query.trim())}
            placeholder={t('c1_search.placeholder')} className="flex-1 min-w-0 text-base text-gray-800 placeholder-gray-400 outline-none bg-transparent" autoComplete="off" />
          {loading && <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
          {query && !loading && (
            <button onClick={() => setQuery('')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400" aria-label={t('c1_search.clear')}><X className="w-4 h-4" /></button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label={t('c1_search.close')}><X className="w-4 h-4" /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {bundleHits.length > 0 && (
            <div className="p-3 pb-0">
              <p className={`${label} px-2 mb-2`}>{t('c1_search.bundles')}</p>
              {bundleHits.map(b => (
                <Link key={b.id} href={bundlePath(b)} onClick={() => { saveSearch(query); onClose(); }} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">{b.image && <img src={b.image} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-brand-700">{L(b, 'name')}</p>
                    <p className="text-xs text-gray-500">{t('c1_search.bundleItems', { n: b.itemCount })}</p>
                  </div>
                  <p className="text-sm font-bold text-brand-700 flex-shrink-0">{formatPrice(b.price)}</p>
                </Link>
              ))}
            </div>
          )}
          {(results.length > 0 || bundleHits.length > 0) && results.length === 0 && query && (
            <button onClick={() => handleSearch(query)} className="flex items-center gap-2 w-full p-2.5 mx-3 mb-3 rounded-xl hover:bg-brand-50 text-brand-700 font-semibold text-sm transition-colors"><Search className="w-4 h-4" />{t('c1_search.viewAllFor', { q: query })}</button>
          )}
          {results.length > 0 && (
            <div className="p-3">
              <p className={`${label} px-2 mb-2`}>{t('c1_search.products')}</p>
              {results.map(p => (
                <Link key={p.id} href={`/shop/products/${p.slug}`} onClick={() => { saveSearch(query); onClose(); }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {p.images?.[0] && <img src={p.images[0]} alt={L(p, 'name')} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-brand-700">{L(p, 'name')}</p>
                    <p className="text-xs text-gray-500">{L(p, 'categoryName')} &middot; {t('c1_search.sku')}: <span dir="ltr">{p.sku}</span></p>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className="text-sm font-bold text-brand-700">{formatPrice(p.price)}</p>
                    {p.comparePrice ? <p className="text-xs text-gray-400 line-through">{formatPrice(p.comparePrice)}</p> : null}
                  </div>
                </Link>
              ))}
              {query && (
                <button onClick={() => handleSearch(query)} className="flex items-center gap-2 w-full p-2.5 mt-1 rounded-xl hover:bg-brand-50 text-brand-700 font-semibold text-sm transition-colors">
                  <Search className="w-4 h-4" />{t('c1_search.viewAllFor', { q: query })}
                  <ArrowRight className="w-4 h-4 ms-auto rtl:rotate-180" />
                </button>
              )}
            </div>
          )}

          {query && !loading && results.length === 0 && bundleHits.length === 0 && (
            <div className="p-8 text-center">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">{t('c1_search.noResults', { q: query })}</p>
              <p className="text-gray-400 text-sm mt-1">{t('c1_search.tryOther')}</p>
            </div>
          )}

          {!query && (
            <div className="p-4 space-y-4">
              {recent.length > 0 && (
                <div>
                  <p className={`${label} mb-2`}>{t('c1_search.recent')}</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map(r => (
                      <button key={r} onClick={() => setQuery(r)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
                        <Clock className="w-3 h-3 text-gray-400" />{r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className={`${label} mb-2`}>{t('c1_search.suggested')}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6].map(n => {
                    const term = t(`c1_search.p${n}`);
                    return (
                      <button key={n} onClick={() => handleSearch(term)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 rounded-lg text-sm text-brand-700 font-medium transition-colors">
                        <TrendingUp className="w-3 h-3" />{term}
                      </button>
                    );
                  })}
                </div>
              </div>
              {cats.length > 0 && (
                <div>
                  <p className={`${label} mb-2`}>{t('c1_search.browse')}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {cats.map(c => (
                      <Link key={c.id} href={`/shop/${c.slug}`} onClick={onClose}
                        className="flex items-center gap-2 p-2.5 bg-gray-50 hover:bg-brand-50 rounded-xl text-sm font-medium text-gray-700 hover:text-brand-700 transition-colors">
                        <LayoutGrid className="w-4 h-4 text-gray-400" />{L(c, 'name')}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

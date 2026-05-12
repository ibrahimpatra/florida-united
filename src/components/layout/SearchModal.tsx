'use client';
import { useState, useEffect, useRef } from 'react';
import { X, Search, ArrowRight, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

const POPULAR = ['Circuit Breakers', 'Extension Cord', 'Power Drill', 'Wire Connectors', 'Safety Gloves', 'LED Lights'];

interface Props { isOpen: boolean; onClose: () => void; }

export function SearchModal({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      const saved = JSON.parse(localStorage.getItem('fu-recent-searches') || '[]');
      setRecent(saved);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(query)}&limit=6`);
        const data = await res.json();
        setResults(data.items || []);
      } catch {}
      setLoading(false);
    }, 350);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (!isOpen) onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function saveSearch(term: string) {
    const updated = [term, ...recent.filter(r => r !== term)].slice(0, 5);
    setRecent(updated);
    localStorage.setItem('fu-recent-searches', JSON.stringify(updated));
  }

  function handleSearch(term: string) {
    saveSearch(term);
    window.location.href = `/search?q=${encodeURIComponent(term)}`;
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4" role="dialog" aria-label="Search">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && query.trim() && handleSearch(query.trim())}
            placeholder="Search hardware, electrical, tools..."
            className="flex-1 text-base text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            autoComplete="off"
          />
          {loading && <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
          {query && !loading && (
            <button onClick={() => setQuery('')} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results / Suggestions */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Product Results */}
          {results.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Products</p>
              {results.map((p) => (
                <Link
                  key={p.id}
                  href={`/shop/products/${p.slug}`}
                  onClick={() => { saveSearch(query); onClose(); }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {p.images?.[0] && (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-brand-700">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.categoryName} • SKU: {p.sku}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-brand-700">{formatPrice(p.price)}</p>
                    {p.comparePrice && <p className="text-xs text-gray-400 line-through">{formatPrice(p.comparePrice)}</p>}
                  </div>
                </Link>
              ))}
              {query && (
                <button
                  onClick={() => handleSearch(query)}
                  className="flex items-center gap-2 w-full p-2.5 mt-1 rounded-xl hover:bg-brand-50 text-brand-700 font-semibold text-sm transition-colors"
                >
                  <Search className="w-4 h-4" />
                  View all results for "{query}"
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </button>
              )}
            </div>
          )}

          {/* No results */}
          {query && !loading && results.length === 0 && (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-gray-600 font-medium">No results for "{query}"</p>
              <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
            </div>
          )}

          {/* Suggestions when no query */}
          {!query && (
            <div className="p-4 space-y-4">
              {recent.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent Searches</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button key={r} onClick={() => setQuery(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
                        <Clock className="w-3 h-3 text-gray-400" />{r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Popular Searches</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR.map((p) => (
                    <button key={p} onClick={() => handleSearch(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 rounded-lg text-sm text-brand-700 font-medium transition-colors">
                      <TrendingUp className="w-3 h-3" />{p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Browse Categories</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'Electrical', href: '/shop/electrical', emoji: '⚡' },
                    { name: 'Hardware', href: '/shop/hardware', emoji: '🔧' },
                    { name: 'Safety', href: '/shop/safety', emoji: '🛡' },
                    { name: 'Lighting', href: '/shop/lighting', emoji: '💡' },
                    { name: 'Plumbing', href: '/shop/plumbing', emoji: '🔩' },
                    { name: 'Industrial', href: '/shop/industrial', emoji: '🏗' },
                  ].map(({ name, href, emoji }) => (
                    <Link key={name} href={href} onClick={onClose}
                      className="flex items-center gap-2 p-2.5 bg-gray-50 hover:bg-brand-50 rounded-xl text-sm font-medium text-gray-700 hover:text-brand-700 transition-colors">
                      <span>{emoji}</span>{name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

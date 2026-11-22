'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, Mail, Phone, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { User } from '@/types';
import { useSession } from 'next-auth/react';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [error, setError]         = useState('');
  const [q, setQ]                 = useState('');
  const { data: sess } = useSession();
  const isSuper = !!(sess?.user as any)?.isSuper;
  async function setRole(id: string, role: string) {
    const r = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return toast.error(d.error || 'Could not change the role');
    toast.success(d.note || 'Role changed'); load(page, q);
  }

  const load = useCallback(async (p: number, term = '') => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`/api/admin/users?page=${p}${term ? `&search=${encodeURIComponent(term)}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setCustomers(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError('Failed to load customers. Check server logs.');
      toast.error('Failed to load customers');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(page, q); }, [page, q, load]);
  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const filtered = customers; // searching is done on the server across all customers

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Customers</h1>
          <p className="text-gray-500 text-sm">{total} registered customers</p>
        </div>
        <button onClick={() => load(page)} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4"/>Refresh
        </button>
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="input-field pl-9 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead>
            <tr>
              <th>Customer</th><th>Email</th><th>Phone</th>
              <th>Role</th><th>Status</th><th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><div className="skeleton h-4 w-full rounded"/></td>
                  ))}</tr>
                ))
              : filtered.length === 0
              ? <tr><td colSpan={6} className="text-center py-10 text-gray-400">No customers found</td></tr>
              : filtered.map(c => (
                  <tr key={c.uid}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {c.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="font-medium text-gray-800 text-sm">{c.name || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <a href={`mailto:${c.email}`} className="text-brand-600 hover:underline text-sm flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5"/>{c.email}
                      </a>
                    </td>
                    <td className="text-gray-600 text-sm">
                      {c.phone
                        ? <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400"/>{c.phone}</span>
                        : '—'}
                    </td>
                    <td>
                      {isSuper
                        ? <select value={c.role} onChange={e => setRole(c.uid, e.target.value)} className="input-field py-1 px-2 text-xs w-auto">
                            <option value="customer">customer</option><option value="admin">admin</option><option value="superadmin">superadmin</option>
                          </select>
                        : <span className={`badge text-xs font-bold ${c.role === 'admin' || c.role === 'superadmin' ? 'badge-red' : 'badge-blue'}`}>{c.role}</span>}
                    </td>
                    <td>
                      <span className={`badge text-xs font-bold ${c.isActive !== false ? 'badge-green' : 'badge-gray'}`}>
                        {c.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-gray-500 text-xs">{formatDate(c.createdAt)}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} &nbsp;·&nbsp; {total} customers total
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >← Prev</button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

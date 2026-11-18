'use client';
import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Download, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

type PlanRow = { line: number; action: 'create' | 'update' | 'error'; sku: string; name: string; message?: string; changes?: string[] };
type Plan = { rows: PlanRow[]; newCategories: { name: string; parentName?: string }[]; newUoms: { name: string }[]; unknownColumns: string[]; counts: { create: number; update: number; error: number } };
type Result = { created: number; updated: number; createdCategories: number; createdUnits: number; skipped: number; errors: string[]; moreErrors?: number };

const BADGE: Record<string, string> = { create: 'bg-green-100 text-green-800', update: 'bg-blue-100 text-blue-800', error: 'bg-red-100 text-red-800' };

export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<'' | 'preview' | 'import'>('');
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const send = async (f: File, mode: 'preview' | 'import') => {
    setBusy(mode);
    try {
      const fd = new FormData(); fd.append('file', f); fd.append('mode', mode);
      const r = await fetch('/api/admin/import', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error || 'Import failed'); if (d.plan) setPlan(d.plan); setBusy(''); return; }
      if (mode === 'preview') { setPlan(d.plan); setResult(null); }
      else { setResult(d); setPlan(null); toast.success(`${d.created} added, ${d.updated} updated`); }
    } catch { toast.error('Network error'); }
    setBusy('');
  };
  const pick = (f?: File) => {
    if (!f) return;
    if (!/\.(xlsx|csv|txt)$/i.test(f.name)) { toast.error('Upload an Excel (.xlsx) or CSV file.'); return; }
    setFile(f); setResult(null); setPlan(null); send(f, 'preview');
  };
  const reset = () => { setFile(null); setPlan(null); setResult(null); };
  const ok = plan ? plan.counts.create + plan.counts.update : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Import products from Excel</h1>
          <p className="text-gray-500 text-sm">Add and update every product, price and stock level from one spreadsheet.</p>
        </div>
        <a href="/api/admin/import/template" className="btn-secondary py-2 px-4 text-sm"><Download className="w-4 h-4" />Download Excel template</a>
      </div>

      {!plan && !result && (
        <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          onClick={() => ref.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${drag ? 'border-brand-500 bg-brand-50' : 'border-gray-300 bg-white hover:border-brand-400'}`}>
          {busy ? <Loader2 className="w-10 h-10 mx-auto text-brand-600 animate-spin" /> : <FileSpreadsheet className="w-10 h-10 mx-auto text-brand-600" />}
          <p className="mt-3 font-semibold text-gray-800">{busy ? `Checking ${file?.name}…` : 'Drop your Excel file here, or click to choose'}</p>
          <p className="text-xs text-gray-500 mt-1">.xlsx or .csv, up to 5,000 rows. You see a full preview before anything is saved.</p>
          <input ref={ref} type="file" hidden accept=".xlsx,.csv,.txt" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      )}

      {plan && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center gap-3 justify-between">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">{file?.name}</span>: <b className="text-green-700">{plan.counts.create} new</b>, <b className="text-blue-700">{plan.counts.update} updates</b>, <b className={plan.counts.error ? 'text-red-700' : 'text-gray-500'}>{plan.counts.error} with problems</b>
              {(plan.newCategories.length > 0 || plan.newUoms.length > 0) && <p className="text-xs text-gray-500 mt-1">Will also create {plan.newCategories.length} categories and {plan.newUoms.length} units that do not exist yet.</p>}
              {plan.unknownColumns.length > 0 && <p className="text-xs text-amber-700 mt-1">Ignored columns: {plan.unknownColumns.join(', ')}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="btn-secondary py-2 px-4 text-sm"><RefreshCw className="w-4 h-4" />Choose another file</button>
              <button disabled={!ok || !!busy} onClick={() => file && confirm(`Save ${plan.counts.create} new and ${plan.counts.update} updated products now? Rows with problems are skipped.`) && send(file, 'import')} className="btn-primary py-2 px-4 text-sm">
                {busy === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Import {ok} products
              </button>
            </div>
          </div>
          <div className="table-wrapper bg-white max-h-[60vh] overflow-auto">
            <table className="table min-w-[640px]">
              <thead><tr><th>Row</th><th>Result</th><th>SKU</th><th>Name</th><th>Details</th></tr></thead>
              <tbody>{plan.rows.map(r => (
                <tr key={r.line}>
                  <td>{r.line}</td>
                  <td><span className={`badge ${BADGE[r.action]}`}>{r.action === 'create' ? 'New' : r.action === 'update' ? 'Update' : 'Problem'}</span></td>
                  <td className="font-mono text-xs">{r.sku}</td><td>{r.name}</td>
                  <td className="text-xs text-gray-600">{r.message || (r.changes && r.changes.join(', '))}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="card p-6 space-y-3">
          <p className="flex items-center gap-2 font-semibold text-green-700"><CheckCircle className="w-5 h-5" />Done: {result.created} added, {result.updated} updated{result.createdCategories ? `, ${result.createdCategories} categories created` : ''}{result.createdUnits ? `, ${result.createdUnits} units created` : ''}.</p>
          {result.skipped > 0 && (
            <div><p className="flex items-center gap-2 text-sm font-semibold text-red-700"><XCircle className="w-4 h-4" />{result.skipped} rows skipped</p>
              <ul className="text-xs text-gray-600 list-disc ps-5 mt-1">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              {!!result.moreErrors && <p className="text-xs text-gray-500">…and {result.moreErrors} more.</p>}</div>)}
          <button onClick={reset} className="btn-secondary py-2 px-4 text-sm">Import another file</button>
        </div>
      )}
    </div>
  );
}

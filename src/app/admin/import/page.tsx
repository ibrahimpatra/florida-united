'use client';
import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Download, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

// ── CSV template columns ─────────────────────────────────────
const TEMPLATE_HEADERS = [
  'name','sku','price','comparePrice','costPrice',
  'stock','lowStockAlert','categoryId','categoryName',
  'brand','description','shortDescription',
  'image','tags','weight',
  'isFeatured','isNewArrival','isOnSale','isActive','isReturnable','returnDays',
  'barcode','metaTitle','metaDesc',
];

const TEMPLATE_EXAMPLE = [
  'LED Flood Light 50W','LED-FL-50W','8.500','12.000','5.000',
  '100','10','cat-lighting','Lighting',
  'Philips','High-efficiency 50W LED flood light for outdoor use','50W LED Flood Light',
  'https://example.com/image.jpg','led,flood,lighting,outdoor','0.8',
  'false','true','false','true','true','14',
  '','LED Flood Light 50W - Philips','Outdoor LED flood light',
];

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE.join(',')];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'florida-kuwait-product-import-template.csv';
  a.click(); URL.revokeObjectURL(url);
}

// ── Simple CSV parser (handles quoted fields) ─────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

type ImportResult = { success: boolean; created: number; skipped: number; errors: string[] };
type PreviewState  = 'idle' | 'previewing' | 'importing' | 'done';

export default function AdminImportPage() {
  const [state, setState]       = useState<PreviewState>('idle');
  const [rows, setRows]         = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult]     = useState<ImportResult|null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [isDragging, setIsDragging]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast.error('Please upload a CSV file (.csv or .txt)');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) { toast.error('File appears empty or has only headers.'); return; }
      setRows(parsed);
      setState('previewing');
      setResult(null);
    };
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleImport = async () => {
    if (rows.length < 2) return;
    if (!confirm(`Import ${rows.length - 1} products? This will add them to Firestore immediately.`)) return;

    setState('importing');
    try {
      const res  = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data: ImportResult = await res.json();
      if (data.success) {
        setResult(data);
        setState('done');
        toast.success(`✅ Imported ${data.created} products successfully!`);
      } else {
        toast.error((data as any).error || 'Import failed');
        setState('previewing');
      }
    } catch {
      toast.error('Network error during import');
      setState('previewing');
    }
  };

  const reset = () => { setState('idle'); setRows([]); setFileName(''); setResult(null); };

  const headers  = rows[0] || [];
  const dataRows = rows.slice(1);

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Bulk Product Import</h1>
          <p className="text-gray-500 text-sm">Upload a CSV file to add hundreds of products at once</p>
        </div>
        <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 border border-brand-300 text-brand-700 rounded-xl text-sm font-semibold hover:bg-brand-50 transition-colors">
          <Download className="w-4 h-4"/>Download CSV Template
        </button>
      </div>

      {/* Required columns info */}
      <div className="card p-5 mb-6 border-l-4 border-brand-500">
        <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500"/>Required CSV Columns</h3>
        <div className="flex flex-wrap gap-2">
          {['name','sku','price','stock','categoryId'].map(c=>(
            <span key={c} className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-mono font-bold">{c}</span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">All other columns (brand, description, images, tags, etc.) are optional. Download the template above to see all supported columns.</p>
        <div className="mt-3 text-xs text-gray-500 space-y-1">
          <p>• <strong>price</strong>: in KWD (e.g. 8.500 = KWD 8.500)</p>
          <p>• <strong>tags</strong>: comma-separated (e.g. led,outdoor,50w)</p>
          <p>• <strong>isFeatured / isNewArrival / isOnSale</strong>: true or false</p>
          <p>• <strong>image</strong>: full URL to product image</p>
        </div>
      </div>

      {/* Upload Zone */}
      {state === 'idle' && (
        <div
          onDrop={onDrop}
          onDragOver={e=>{e.preventDefault();setIsDragging(true);}}
          onDragLeave={()=>setIsDragging(false)}
          onClick={()=>fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'}`}
        >
          <FileSpreadsheet className={`w-14 h-14 mx-auto mb-4 ${isDragging ? 'text-brand-500' : 'text-gray-300'}`}/>
          <p className="text-lg font-bold text-gray-700 mb-1">Drop your CSV file here</p>
          <p className="text-sm text-gray-400">or click to browse — supports .csv files</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) processFile(f); }}/>
        </div>
      )}

      {/* Preview & Import */}
      {(state === 'previewing' || state === 'importing' || state === 'done') && rows.length > 0 && (
        <div className="space-y-4">
          {/* File info */}
          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-brand-600"/>
              <div>
                <p className="font-bold text-gray-800">{fileName}</p>
                <p className="text-sm text-gray-500">{dataRows.length} products · {headers.length} columns</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={reset} className="btn-secondary py-2 px-4 text-sm flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>New File</button>
              {state === 'previewing' && (
                <button onClick={handleImport} className="btn-primary py-2 px-5 text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4"/>Import {dataRows.length} Products
                </button>
              )}
              {state === 'importing' && (
                <button disabled className="btn-primary py-2 px-5 text-sm flex items-center gap-2 opacity-70">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Importing...
                </button>
              )}
            </div>
          </div>

          {/* Result summary */}
          {state === 'done' && result && (
            <div className="card p-5 border-l-4 border-green-500">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500"/>Import Complete</h3>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-2xl font-black text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600 font-semibold">Created</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <p className="text-2xl font-black text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600 font-semibold">Skipped</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <p className="text-2xl font-black text-red-700">{result.errors.length}</p>
                  <p className="text-xs text-red-600 font-semibold">Errors</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-700 mb-1">Errors (showing first 20):</p>
                  {result.errors.map((e,i)=><p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Preview table */}
          {state !== 'done' && (
            <div className="card overflow-hidden">
              <button
                onClick={()=>setShowPreview(v=>!v)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-700">Preview ({Math.min(dataRows.length, 5)} of {dataRows.length} rows)</span>
                {showPreview ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
              </button>
              {showPreview && (
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        {headers.map((h,i)=><th key={i} className="text-left px-3 py-2 font-bold text-gray-600 whitespace-nowrap border-r border-gray-100 last:border-0">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.slice(0,5).map((row,i)=>(
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                          {row.map((cell,j)=>(
                            <td key={j} className="px-3 py-2 text-gray-700 border-r border-gray-50 last:border-0 max-w-[200px] truncate">{cell||<span className="text-gray-300">—</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dataRows.length > 5 && (
                    <p className="text-center text-xs text-gray-400 py-3 border-t border-gray-100">+ {dataRows.length-5} more rows not shown</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

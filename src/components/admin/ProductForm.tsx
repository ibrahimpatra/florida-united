'use client';
import { HtmlField } from './HtmlField';
import { TranslateButton } from '@/components/admin/TranslateButton';
import { NumberInput } from '@/components/ui/NumberInput';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { uploadImage as sendImage } from '@/lib/client-upload';
import { Upload, X, Plus, Save, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateSlug, generateSKU } from '@/lib/utils';
import type { Category } from '@/types';
import { PillSelect } from './PillSelect';
import { Collapsible } from './Collapsible';
import { useBusy } from '@/components/layout/BusyLayer';

interface Props { initialData?: any; productId?: string; }

function AiMini({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return <button type="button" onClick={onClick} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}{label}</button>;
}

export function ProductForm({ initialData, productId }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brandNames, setBrandNames] = useState<string[]>([]);
  useEffect(() => { fetch('/api/brands').then(r => (r.ok ? r.json() : [])).then(d => setBrandNames(Array.isArray(d) ? d.map((b: any) => b.name) : [])).catch(() => {}); }, []);
  const { start: startBusy } = useBusy();
  const [parentCat, setParentCat] = useState<string | null>(null);   // Category pill
  const [subCat, setSubCat] = useState<string | null>(null);         // Sub-category pill (optional)
  const [images, setImages] = useState<string[]>(initialData?.images || []);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFacts, setAiFacts] = useState('');
  const [aiOverwrite, setAiOverwrite] = useState(false);
  const [uoms, setUoms] = useState<any[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: initialData || {
      isActive: true, isFeatured: false, isNewArrival: false,
      isOnSale: false, freeShipping: false, isReturnable: true, returnDays: 30,
      stock: 0, lowStockAlert: 5, price: 0,
    }
  });

  const nameValue = watch('name');
  // Draft memory (new products only): what you typed survives a refresh or an accidental close, and is dropped once saved.
  const DRAFT_KEY = 'admin-draft-product';
  const [draftNote, setDraftNote] = useState('');
  useEffect(() => {
    if (productId) return;
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d?.values?.name) {
        Object.entries(d.values).forEach(([k, v]) => setValue(k as any, v as any));
        if (Array.isArray(d.images)) setImages(d.images); if (Array.isArray(d.tags)) setTags(d.tags);
        if (d.parentCat) setParentCat(d.parentCat); if (d.subCat) setSubCat(d.subCat);
        setDraftNote('Draft restored');
      }
    } catch { /* no draft */ }
  }, []);                                    // eslint-disable-line react-hooks/exhaustive-deps
  const allValues = watch();
  useEffect(() => {
    if (productId) return;
    const t = setTimeout(() => { try { if (String(allValues?.name || '').trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ values: allValues, images, tags, parentCat, subCat })); } catch { /* storage is optional */ } }, 800);
    return () => clearTimeout(t);
  }, [JSON.stringify(allValues), images, tags, parentCat, subCat]);   // eslint-disable-line react-hooks/exhaustive-deps
  const uomId = watch('uomId' as any) as string | undefined;
  const units = (watch('units' as any) as any[] | undefined) || [];
  const setUnits = (u: any[]) => setValue('units' as any, u as any, { shouldDirty: true });
  const basePrice = Number(watch('price') || 0);

  useEffect(() => {
    fetch('/api/uoms').then(r => (r.ok ? r.json() : [])).then(d => setUoms(Array.isArray(d) ? d.filter((u: any) => u.isActive !== false) : [])).catch(() => {});
  }, []);

  const pickUom = (id: string) => {
    const u = uoms.find(x => x.id === id);
    setValue('uomId' as any, id, { shouldDirty: true });
    setValue('uomName' as any, u?.name || '', { shouldDirty: true });
    setValue('uomAbbr' as any, u?.abbreviation || '', { shouldDirty: true });
    setValue('uomNameAr' as any, u?.nameAr || '', { shouldDirty: true });
    setValue('uomAbbrAr' as any, u?.abbreviationAr || '', { shouldDirty: true });
  };

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then((cats: Category[]) => {
      setCategories(Array.isArray(cats) ? cats.filter(c => c.isActive !== false) : []);
    }).catch(() => toast.error('Could not load categories'));
  }, []);

  // The <select> can only show a value whose <option> already exists. Setting it in the
  // fetch callback ran BEFORE React rendered the options, so it silently stayed on
  // "Select Category". Apply it in an effect that runs AFTER the options are committed.
  useEffect(() => {
    if (!categories.length || !initialData?.categoryId) return;
    const c = categories.find(x => x.id === initialData.categoryId);
    if (c?.parentId && categories.some(x => x.id === c.parentId)) { setParentCat(c.parentId); setSubCat(c.id); }
    else if (c) setParentCat(c.id);
    setValue('categoryId', initialData.categoryId, { shouldDirty: false });
  }, [categories, initialData?.categoryId]);
  // the product stores ONE category id: the sub-category when chosen, else the category
  const chooseCategory = (id: string | null) => { setParentCat(id); setSubCat(null); setValue('categoryId', (id || '') as any, { shouldDirty: true, shouldValidate: true }); };
  const chooseSub = (id: string | null) => { setSubCat(id); setValue('categoryId', (id || parentCat || '') as any, { shouldDirty: true, shouldValidate: true }); };
  const createCategory = (parentId?: string) => async (name: string) => {
    const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, ...(parentId ? { parentId } : {}) }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.id) { toast.error(d.error || 'Could not add it.'); return null; }
    const cat = { id: d.id, name, parentId: parentId || undefined, isActive: true } as any as Category;
    setCategories(cs => [...cs, cat]); toast.success(`Added "${name}"`); return { id: d.id, label: name };
  };
  const createBrand = async (name: string) => {
    const res = await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 409) { toast.error(d.error || 'Could not add the brand.'); return null; }
    setBrandNames(b => b.includes(name) ? b : [...b, name]); if (res.ok) toast.success(`Added brand "${name}"`); return { id: name, label: name };
  };

  useEffect(() => {
    if (nameValue && !productId) {
      setValue('slug', generateSlug(nameValue));
      if (!watch('sku')) setValue('sku', generateSKU(nameValue));
    }
  }, [nameValue]);

  /** Writes descriptions (English + Arabic), meta text and tags from the name and the facts typed here. Only empty fields are filled unless "replace" is ticked. */
  const writeWithAi = async (only?: string[]) => {
    const name = String(watch('name') || '').trim();
    if (name.length < 3) { toast.error('Enter the product name first.'); return; }
    setAiBusy(true);
    try {
      const cat = categories.find((c: any) => c.id === watch('categoryId'));
      const res = await fetch('/api/admin/describe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name, nameAr: watch('nameAr' as any), brand: watch('brand'), category: (cat as any)?.name, sku: watch('sku'), specs: aiFacts, tags, existing: (aiOverwrite || only) ? watch('description') : '',
      }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || 'The writer is unavailable right now.'); return; }
      let n = 0;
      for (const [k, v] of Object.entries(d.fields || {})) {
        if (only && !only.includes(k)) continue;
        if (!only && !aiOverwrite && String(watch(k as any) || '').trim()) continue;
        setValue(k as any, v as any, { shouldDirty: true }); n++;
      }
      if (!only && Array.isArray(d.tags)) setTags(ts => [...ts, ...d.tags.filter((t: string) => !ts.includes(t))].slice(0, 20));
      toast.success(n ? `Written with ${d.provider === 'openai' ? 'OpenAI' : 'Gemini'}. Please read it before saving.` : 'Everything was already filled. Tick "Replace" to rewrite.');
    } catch { toast.error('Network error: check your connection and try again.'); }
    finally { setAiBusy(false); }
  };

  const uploadImage = async (file: File) => {
    if (images.length >= 8) { toast.error('Up to 8 images per product keeps storage small.'); return; }
    setUploading(true);
    try {
      // the name makes the stored file <product-name>-xxxx.webp, which Google Images can read
      const url = await sendImage(file, { folder: 'products', name: String(watch('name') || '') });
      setImages(imgs => [...imgs, url]); toast.success('Image uploaded');
    } catch (e: any) { toast.error(e?.message || 'Upload failed'); }
    setUploading(false);
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(t => [...t, tagInput.trim()]);
      setTagInput('');
    }
  };

  const onSubmit = async (data: any) => {
    if (saving) return;
    setSaving(true);
    const stopBusy = startBusy(productId ? 'Saving product…' : 'Creating product…');
    try {
      const { id, createdAt, updatedAt, categoryName, categoryPath, avgRating, totalReviews, totalSold, totalRevenue, ...rest } = data;
      const payload = {
        ...rest, images, tags,
        price: Number(data.price) || 0,
        comparePrice: data.comparePrice ? Number(data.comparePrice) : null,
        stock: Math.max(0, Math.floor(Number(data.stock) || 0)),
        lowStockAlert: Number(data.lowStockAlert) || 5,
        weight: data.weight ? Number(data.weight) : null,
        returnDays: Number(data.returnDays) || 0,
        freeShipping: !!data.freeShipping,
      };
      const url = productId ? `/api/products/${productId}` : '/api/products';
      const res = await fetch(url, { method: productId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let result: any = null;
      try { result = await res.json(); } catch { /* non-JSON error page */ }
      if (res.ok && (result?.success || result?.id)) {
        toast.success(productId ? 'Product updated!' : 'Product created!');
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        router.push('/admin/products');
        return;
      }
      toast.error(result?.error || `Save failed (server error ${res.status}). Nothing was changed.`);
    } catch { toast.error('Network error — check your connection and try again.'); }
    stopBusy(); setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Save and Cancel stay at the top while you scroll */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 mb-5 bg-gray-50/95 backdrop-blur border-b border-gray-200 flex items-center gap-2">
        <h1 className="flex-1 min-w-0 text-base sm:text-lg font-bold text-gray-900 font-display truncate">{productId ? 'Edit product' : 'New product'}{draftNote && <span className="ms-2 text-xs font-normal text-amber-700">{draftNote}</span>}</h1>
        <button type="button" onClick={() => router.push('/admin/products')} className="btn-secondary py-2 px-3 text-sm"><ArrowLeft className="w-4 h-4"/>Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary py-2 px-4 text-sm">
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><Save className="w-4 h-4"/>{productId?'Save':'Create'}</>}
        </button>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-bold text-gray-800">Basic Information</h3>
              <TranslateButton context="a product listing of a hardware and electrical supplies store" label="Translate all to Arabic" fields={[
                ...(['name', 'shortDescription', 'description'] as const).map(k => ({
                  en: watch(k as any) as string, ar: watch((k + 'Ar') as any) as string,
                  set: (v: string) => setValue((k + 'Ar') as any, v as any, { shouldDirty: true }),
                })),
                ...units.map((u: any, i: number) => ({ en: u.name, ar: u.nameAr, set: (v: string) => setUnits(units.map((x: any, j: number) => (j === i ? { ...x, nameAr: v } : x))) })),
              ]} />
            </div>
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => writeWithAi()} disabled={aiBusy} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-60">
                  {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Write with AI
                </button>
                <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={aiOverwrite} onChange={e => setAiOverwrite(e.target.checked)} className="accent-brand-600" /> Replace what I already wrote</label>
              </div>
              <textarea value={aiFacts} onChange={e => setAiFacts(e.target.value)} rows={2} className="input-field mt-2 text-sm resize-y" placeholder="Optional facts for the writer: size, power, material, what is in the box… It only uses what you give it." />
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Product Name *</label>
                <input {...register('name',{required:'Name required'})} className="input-field" placeholder="e.g. 20A Circuit Breaker Double Pole"/>
                {errors.name && <p className="text-red-500 text-xs mt-1">{(errors.name as any).message}</p>}
              </div>
              <div>
                <label className="label">Arabic Name <span dir="rtl" className="text-gray-400 font-normal">(الاسم بالعربية)</span></label>
                <input {...register('nameAr' as any)} dir="rtl" lang="ar" className="input-field" placeholder="مثال: قاطع كهربائي 20 أمبير"/>
                <p className="text-xs text-gray-400 mt-1">Shown to customers when the site is in Arabic, and printed on invoices. Optional; English is used if empty.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">URL Slug *</label>
                  <input {...register('slug',{required:'Slug required'})} className="input-field font-mono text-sm" placeholder="auto-generated"/>
                </div>
                <div>
                  <label className="label">SKU *</label>
                  <input {...register('sku',{required:'SKU required'})} className="input-field font-mono text-sm" placeholder="auto-generated"/>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between"><label className="label">Short Description</label><AiMini onClick={() => writeWithAi(['shortDescription', 'shortDescriptionAr'])} busy={aiBusy} label="Fill short text with AI" /></div>
                <input {...register('shortDescription')} className="input-field" placeholder="One-line summary for product cards"/>
              </div>
              <div>
                <label className="label">Arabic Short Description <span dir="rtl" className="text-gray-400 font-normal">(وصف مختصر)</span></label>
                <input {...register('shortDescriptionAr' as any)} dir="rtl" lang="ar" className="input-field" placeholder="ملخص من سطر واحد"/>
              </div>
              <div>
                <div className="flex items-center justify-between"><label className="label">Full Description *</label><AiMini onClick={() => writeWithAi(['description', 'descriptionAr'])} busy={aiBusy} label="Fill long text with AI" /></div>
                <input type="hidden" {...register('description',{required:'Description required'})} />
                <HtmlField value={watch('description') || ''} onChange={v => setValue('description', v, { shouldDirty: true, shouldValidate: true })} rows={8} placeholder="Plain text or simple HTML. Use the toolbar for bold, lists and links." />
                {(errors as any).description && <p className="text-xs text-red-600 mt-1">{(errors as any).description.message}</p>}
              </div>
              <div>
                <label className="label">Arabic Full Description <span dir="rtl" className="text-gray-400 font-normal">(الوصف الكامل)</span></label>
                <input type="hidden" {...register('descriptionAr' as any)} />
                <HtmlField dir="rtl" value={(watch('descriptionAr' as any) as string) || ''} onChange={v => setValue('descriptionAr' as any, v as any, { shouldDirty: true })} rows={8} placeholder="وصف تفصيلي للمنتج" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Brand</label>
                  <input type="hidden" {...register('brand')} />
                  <PillSelect value={(watch('brand') as string) || null} onChange={id => setValue('brand', (id || '') as any, { shouldDirty: true })} onCreate={createBrand}
                    placeholder="Search or add a brand" options={[...new Set([...brandNames, ...(initialData?.brand ? [initialData.brand] : [])])].map(n => ({ id: n, label: n }))} />
                </div>
                <div>
                  <label className="label">Barcode</label>
                  <input {...register('barcode')} className="input-field font-mono"/>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4">Pricing & Inventory</h3>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Sale Price *</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">KD</span>
                <input {...register('price',{required:'Price required',min:{value:0,message:'Must be ≥ 0'}})} type="number" step="0.001" className="input-field pl-9" placeholder="0.000"/></div>
              </div>
              <div>
                <label className="label">Compare Price</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">KD</span>
                <input {...register('comparePrice')} type="number" step="0.001" className="input-field pl-9" placeholder="0.000"/></div>
              </div>
              <div>
                <label className="label">Cost Price</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">KD</span>
                <input {...register('costPrice')} type="number" step="0.001" className="input-field pl-9" placeholder="0.000"/></div>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Stock Qty *</label>
                <input {...register('stock',{required:true,min:0})} type="number" className="input-field"/>
              </div>
              <div>
                <label className="label">Low Stock Alert</label>
                <input {...register('lowStockAlert')} type="number" className="input-field"/>
              </div>
              <div>
                <label className="label">Weight (kg)</label>
                <input {...register('weight')} type="number" step="0.1" className="input-field"/>
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4">Product Images</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {images.map((img,i) => (
                <div key={i} className="relative group aspect-square bg-gray-100 rounded-xl overflow-hidden">
                  <img src={img} alt="" className="w-full h-full object-cover"/>
                  <button type="button" onClick={()=>{
                    // an image uploaded in this editing session and now removed is unused: delete it from storage so it stops costing money
                    if (!(initialData?.images || []).includes(img)) fetch('/api/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: img }) }).catch(() => {});
                    setImages(imgs=>imgs.filter((_,idx)=>idx!==i));
                  }}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3"/>
                  </button>
                  {i===0 && <span className="absolute bottom-1 left-1 badge bg-brand-600 text-white text-xs">Main</span>}
                </div>
              ))}
              <label className={`aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors ${uploading?'opacity-50':''}`}>
                {uploading ? <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"/> : <><Upload className="w-6 h-6 text-gray-400 mb-1"/><span className="text-xs text-gray-500">Upload</span></>}
                <input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&uploadImage(e.target.files[0])}/>
              </label>
            </div>
            <div className="flex gap-2">
              <input value={imageUrlInput} onChange={e=>setImageUrlInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); if(imageUrlInput.startsWith('http')){ setImages(i=>[...i,imageUrlInput]); setImageUrlInput(''); } } }}
                placeholder="Or paste image URL and press Enter" className="input-field flex-1 text-sm py-2"/>
              <button type="button" onClick={()=>{ if(imageUrlInput.startsWith('http')){ setImages(i=>[...i,imageUrlInput]); setImageUrlInput(''); } }}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700">Add</button>
            </div>
            {/* Tags */}
            <div className="mt-4">
              <label className="label">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(t=><span key={t} className="flex items-center gap-1 badge-blue badge text-xs">{t}<button type="button" onClick={()=>setTags(ts=>ts.filter(x=>x!==t))}><X className="w-3 h-3"/></button></span>)}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addTag())}
                  placeholder="Add a tag..." className="input-field flex-1 text-sm py-2"/>
                <button type="button" onClick={addTag} className="px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50"><Plus className="w-4 h-4"/></button>
              </div>
            </div>
          </div>

          {/* SEO */}
          <Collapsible title="SEO (Google)" hint="Optional. Filled automatically in the background if left empty.">
            <div className="space-y-3">
              <div><label className="label">Meta Title</label><input {...register('metaTitle')} className="input-field" placeholder="Appears in Google search results"/></div>
              <div><label className="label">Meta Description</label><textarea {...register('metaDesc')} rows={2} className="input-field resize-none" placeholder="Brief description for search engines (150-160 chars)"/></div>
              <div><label className="label">Meta Title (Arabic)</label><input {...register('metaTitleAr' as any)} dir="rtl" className="input-field" placeholder="يظهر في نتائج جوجل بالعربية"/></div>
              <div><label className="label">Meta Description (Arabic)</label><textarea {...register('metaDescAr' as any)} dir="rtl" rows={2} className="input-field resize-none"/></div>
              <div><label className="label">Meta Keywords</label><input {...register('metaKeywords')} className="input-field" placeholder="keyword1, keyword2, keyword3"/></div>
            </div>
          </Collapsible>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Category + sub-category: one pill each */}
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Category *</h3>
              <input type="hidden" {...register('categoryId',{required:'Category required'})} />
              <PillSelect value={parentCat} onChange={chooseCategory} onCreate={createCategory()} placeholder="Search or add a category"
                options={categories.filter(c => !c.parentId || !categories.some(p => p.id === c.parentId)).map(c => ({ id: c.id, label: c.name, sub: (c as any).nameAr }))} />
              {errors.categoryId && <p className="text-red-500 text-xs mt-1">Category required</p>}
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Sub-category <span className="text-xs font-normal text-gray-400">(optional)</span></h3>
              <PillSelect value={subCat} onChange={chooseSub} onCreate={parentCat ? createCategory(parentCat) : undefined} disabled={!parentCat}
                placeholder={parentCat ? 'Search or add a sub-category' : 'Pick a category first'}
                options={categories.filter(c => c.parentId && c.parentId === parentCat).map(c => ({ id: c.id, label: c.name, sub: (c as any).nameAr }))} />
            </div>
          </div>

          {/* Unit of measure */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Unit of Measure</h3>
            <select value={uomId || ''} onChange={e => pickUom(e.target.value)} className="input-field">
              <option value="">None</option>
              {uoms.map(u => <option key={u.id} value={u.id}>{u.name}{u.nameAr ? ` / ${u.nameAr}` : ''} ({u.abbreviation})</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Manage units under Admin &gt; UOM.</p>
          </div>

          {/* Extra selling units */}
          <Collapsible title="Extra selling units" hint="Optional: boxes, cartons, packs" defaultOpen={units.length > 0}>
            <p className="text-xs text-gray-500 mb-3">Optional. The product price above is for one base unit. Add boxes, cartons or packs here; stock is always tracked in base units.</p>
            <div className="space-y-3">
              {units.map((u, i) => (
                <div key={u.id || i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={u.name || ''} onChange={e => setUnits(units.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="input-field" placeholder="Name (Box of 12)" />
                    <input dir="rtl" value={u.nameAr || ''} onChange={e => setUnits(units.map((x, j) => j === i ? { ...x, nameAr: e.target.value } : x))} className="input-field" placeholder="الاسم (علبة 12)" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs text-gray-500">Base units inside</label>
                      <NumberInput type="number" min={1} step={1} value={u.factor ?? ''} onChange={e => setUnits(units.map((x, j) => j === i ? { ...x, factor: Number(e.target.value), price: x.priceTouched ? x.price : Math.round(basePrice * Number(e.target.value) * 1000) / 1000 } : x))} className="input-field" /></div>
                    <div><label className="text-xs text-gray-500">Price (KWD)</label>
                      <NumberInput type="number" min={0} step="0.001" value={u.price ?? ''} onChange={e => setUnits(units.map((x, j) => j === i ? { ...x, price: Number(e.target.value), priceTouched: true } : x))} className="input-field" /></div>
                  </div>
                  <button type="button" onClick={() => setUnits(units.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">Remove unit</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setUnits([...units, { id: `u${Date.now().toString(36)}`, name: '', nameAr: '', factor: 12, price: Math.round(basePrice * 12 * 1000) / 1000 }])}
              className="mt-3 text-sm font-semibold text-brand-600 hover:underline">+ Add a unit</button>
          </Collapsible>

          {/* Status */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Status</h3>
            <div className="space-y-3">
              {[
                {key:'isActive', label:'Active (visible in store)'},
                {key:'isFeatured', label:'Featured on homepage'},
                {key:'isNewArrival', label:'New Arrival'},
                {key:'isOnSale', label:'On Sale'},
                {key:'freeShipping', label:'Free Shipping (always ships free, ignores threshold)'},
              ].map(({key,label}) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" {...register(key as any)} className="w-4 h-4 accent-brand-600 rounded"/>
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Returns */}
          <Collapsible title="Returns policy" hint="Returnable by default">
            <div>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input type="checkbox" {...register('isReturnable')} className="w-4 h-4 accent-brand-600 rounded"/>
              <span className="text-sm text-gray-700">Item is returnable</span>
            </label>
            <p className="text-xs text-gray-500">The return window (days after delivery) is set once for the whole store in Settings.</p>
            </div>
          </Collapsible>

        </div>
      </div>
    </form>
  );
}

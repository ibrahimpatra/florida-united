'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Upload, X, Plus, Save, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateSlug, generateSKU } from '@/lib/utils';
import type { Category } from '@/types';

interface Props { initialData?: any; productId?: string; }

export function ProductForm({ initialData, productId }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<string[]>(initialData?.images || []);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uoms, setUoms] = useState<any[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: initialData || {
      isActive: true, isFeatured: false, isNewArrival: false,
      isOnSale: false, freeShipping: false, isReturnable: true, returnDays: 30,
      stock: 0, lowStockAlert: 5, price: 0,
    }
  });

  const nameValue = watch('name');
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
    if (categories.length && initialData?.categoryId) setValue('categoryId', initialData.categoryId, { shouldDirty: false });
  }, [categories, initialData?.categoryId]);

  useEffect(() => {
    if (nameValue && !productId) {
      setValue('slug', generateSlug(nameValue));
      if (!watch('sku')) setValue('sku', generateSKU(nameValue));
    }
  }, [nameValue]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'products');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { setImages(imgs => [...imgs, data.url]); toast.success('Image uploaded'); }
      else toast.error(data.error || 'Upload failed');
    } catch { toast.error('Upload error'); }
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
        router.push('/admin/products');
        return;
      }
      toast.error(result?.error || `Save failed (server error ${res.status}). Nothing was changed.`);
    } catch { toast.error('Network error — check your connection and try again.'); }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4">Basic Information</h3>
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
                <label className="label">Short Description</label>
                <input {...register('shortDescription')} className="input-field" placeholder="One-line summary for product cards"/>
              </div>
              <div>
                <label className="label">Arabic Short Description <span dir="rtl" className="text-gray-400 font-normal">(وصف مختصر)</span></label>
                <input {...register('shortDescriptionAr' as any)} dir="rtl" lang="ar" className="input-field" placeholder="ملخص من سطر واحد"/>
              </div>
              <div>
                <label className="label">Full Description *</label>
                <textarea {...register('description',{required:'Description required'})} rows={5} className="input-field resize-y" placeholder="Detailed product description..."/>
              </div>
              <div>
                <label className="label">Arabic Full Description <span dir="rtl" className="text-gray-400 font-normal">(الوصف الكامل)</span></label>
                <textarea {...register('descriptionAr' as any)} dir="rtl" lang="ar" rows={5} className="input-field resize-y" placeholder="وصف تفصيلي للمنتج"/>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Brand</label>
                  <input {...register('brand')} className="input-field" placeholder="e.g. Siemens"/>
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
            <div className="grid grid-cols-4 gap-3 mb-4">
              {images.map((img,i) => (
                <div key={i} className="relative group aspect-square bg-gray-100 rounded-xl overflow-hidden">
                  <img src={img} alt="" className="w-full h-full object-cover"/>
                  <button type="button" onClick={()=>setImages(imgs=>imgs.filter((_,idx)=>idx!==i))}
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
          <div className="card p-6">
            <h3 className="font-bold text-gray-800 mb-4">SEO</h3>
            <div className="space-y-3">
              <div><label className="label">Meta Title</label><input {...register('metaTitle')} className="input-field" placeholder="Appears in Google search results"/></div>
              <div><label className="label">Meta Description</label><textarea {...register('metaDesc')} rows={2} className="input-field resize-none" placeholder="Brief description for search engines (150-160 chars)"/></div>
              <div><label className="label">Meta Keywords</label><input {...register('metaKeywords')} className="input-field" placeholder="keyword1, keyword2, keyword3"/></div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Category */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Category *</h3>
            <select {...register('categoryId',{required:'Category required'})} className="input-field">
              <option value="">Select Category</option>
              {categories.filter(c => !c.parentId).map(root => {
                const kids = categories.filter(c => c.parentId === root.id);
                return kids.length ? (
                  <optgroup key={root.id} label={`${root.name}${root.nameAr ? ` / ${root.nameAr}` : ''}`}>
                    <option value={root.id}>{root.name} (general)</option>
                    {kids.map(k => <option key={k.id} value={k.id}>- {k.name}{k.nameAr ? ` / ${k.nameAr}` : ''}</option>)}
                  </optgroup>
                ) : <option key={root.id} value={root.id}>{root.name}</option>;
              })}
              {/* orphaned sub-categories (parent missing/inactive) must still be selectable */}
              {categories.filter(c => c.parentId && !categories.some(p => p.id === c.parentId)).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.categoryId && <p className="text-red-500 text-xs mt-1">Category required</p>}
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
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-1">Extra Selling Units</h3>
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
                      <input type="number" min={1} step={1} value={u.factor ?? ''} onChange={e => setUnits(units.map((x, j) => j === i ? { ...x, factor: Number(e.target.value), price: x.priceTouched ? x.price : Math.round(basePrice * Number(e.target.value) * 1000) / 1000 } : x))} className="input-field" /></div>
                    <div><label className="text-xs text-gray-500">Price (KWD)</label>
                      <input type="number" min={0} step="0.001" value={u.price ?? ''} onChange={e => setUnits(units.map((x, j) => j === i ? { ...x, price: Number(e.target.value), priceTouched: true } : x))} className="input-field" /></div>
                  </div>
                  <button type="button" onClick={() => setUnits(units.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">Remove unit</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setUnits([...units, { id: `u${Date.now().toString(36)}`, name: '', nameAr: '', factor: 12, price: Math.round(basePrice * 12 * 1000) / 1000 }])}
              className="mt-3 text-sm font-semibold text-brand-600 hover:underline">+ Add a unit</button>
          </div>

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
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3">Returns Policy</h3>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input type="checkbox" {...register('isReturnable')} className="w-4 h-4 accent-brand-600 rounded"/>
              <span className="text-sm text-gray-700">Item is returnable</span>
            </label>
            <div>
              <label className="label">Return Window (days)</label>
              <input {...register('returnDays')} type="number" min="0" max="365" className="input-field"/>
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-2">
            <button type="button" onClick={()=>router.push('/admin/products')} className="btn-secondary flex-1 py-2.5 text-sm">
              <ArrowLeft className="w-4 h-4"/>Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5 text-sm">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><Save className="w-4 h-4"/>{productId?'Save Changes':'Create Product'}</>}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

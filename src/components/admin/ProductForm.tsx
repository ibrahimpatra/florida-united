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

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: initialData || {
      isActive: true, isFeatured: false, isNewArrival: false,
      isOnSale: false, freeShipping: false, isReturnable: true, returnDays: 30,
      stock: 0, lowStockAlert: 5, price: 0,
    }
  });

  const nameValue = watch('name');

  useEffect(() => {
    fetch('/api/categories').then(r=>r.json()).then((cats: Category[]) => {
      setCategories(cats);
      // Re-apply categoryId after categories load so the <select> shows the correct option
      if (initialData?.categoryId) {
        setValue('categoryId', initialData.categoryId);
      }
    });
  }, []);

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
      const data = await res.json();
      if (data.url) { setImages(imgs => [...imgs, data.url]); toast.success('Image uploaded'); }
      else toast.error('Upload failed');
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
    setSaving(true);
    try {
      const payload = { ...data, images, tags, price: Number(data.price), comparePrice: data.comparePrice ? Number(data.comparePrice) : null, stock: Number(data.stock), lowStockAlert: Number(data.lowStockAlert), weight: data.weight ? Number(data.weight) : null, returnDays: Number(data.returnDays) };
      const url = productId ? `/api/products/${productId}` : '/api/products';
      const method = productId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const result = await res.json();
      if (result.success || result.id) { toast.success(productId ? 'Product updated!' : 'Product created!'); router.push('/admin/products'); }
      else toast.error(result.error || 'Failed');
    } catch { toast.error('Save failed'); }
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
                <label className="label">Full Description *</label>
                <textarea {...register('description',{required:'Description required'})} rows={5} className="input-field resize-y" placeholder="Detailed product description..."/>
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
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId && <p className="text-red-500 text-xs mt-1">Category required</p>}
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
                {key:'freeShipping', label:'🚚 Free Shipping (always ships free, ignores threshold)'},
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

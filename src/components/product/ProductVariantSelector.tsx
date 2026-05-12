'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Info, Package, Minus, Plus, Check, AlertTriangle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { ProductVariantGroup, VariantOption, ProductUOM } from '@/lib/shipping';

interface VariantSelection {
  [groupId: string]: string; // groupId -> optionId
}

interface SelectedUOM {
  uomId: string;
  uomName: string;
  uomAbbr: string;
  priceMultiplier: number;
  stockMultiplier: number;
  minOrderQty: number;
  maxOrderQty?: number;
  stepQty: number;
  label?: string;
}

interface Props {
  basePrice: number;
  comparePrice?: number;
  baseStock: number;
  variantGroups?: ProductVariantGroup[];
  productUOMs?: ProductUOM[];
  onSelectionChange?: (selection: {
    variantSelections: VariantSelection;
    selectedOptions: VariantOption[];
    selectedUOM: SelectedUOM | null;
    quantity: number;
    finalPrice: number;
    finalStock: number;
    isAvailable: boolean;
    addToCartLabel: string;
  }) => void;
}

export function ProductVariantSelector({
  basePrice,
  comparePrice,
  baseStock,
  variantGroups = [],
  productUOMs = [],
  onSelectionChange,
}: Props) {
  const [variantSelections, setVariantSelections] = useState<VariantSelection>({});
  const [selectedUOMId, setSelectedUOMId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);

  // Get selected UOM object
  const selectedUOM: SelectedUOM | null = productUOMs.length > 0
    ? (productUOMs.find(u => u.uomId === selectedUOMId) || productUOMs.find(u => u.isDefault) || productUOMs[0])
    : null;

  // Get selected options
  const selectedOptions: VariantOption[] = variantGroups.map(group => {
    const optionId = variantSelections[group.id];
    return group.options.find(o => o.id === optionId)!;
  }).filter(Boolean);

  // Calculate final price
  const variantPriceAdjust = selectedOptions.reduce((sum, o) => sum + (o?.priceAdjustment || 0), 0);
  const uomMultiplier = selectedUOM?.priceMultiplier || 1;
  const finalPrice = (basePrice + variantPriceAdjust) * uomMultiplier;
  const finalCompare = comparePrice ? (comparePrice + variantPriceAdjust) * uomMultiplier : undefined;

  // Calculate stock
  const variantStock = selectedOptions.length > 0
    ? Math.min(...selectedOptions.map(o => o?.stockQty ?? baseStock))
    : baseStock;
  const finalStock = Math.floor(variantStock / (selectedUOM?.stockMultiplier || 1));

  // Validation
  const allRequired = variantGroups.filter(g => g.required).every(g => variantSelections[g.id]);
  const isAvailable = allRequired && finalStock > 0 && selectedOptions.every(o => o?.isAvailable !== false);

  // Min/max quantity from UOM
  const minQty = selectedUOM?.minOrderQty || 1;
  const stepQty = selectedUOM?.stepQty || 1;
  const maxQty = Math.min(finalStock, selectedUOM?.maxOrderQty || 999);

  // Auto-set quantity to min when UOM changes
  useEffect(() => {
    setQuantity(minQty);
  }, [selectedUOMId, minQty]);

  // Auto-select default UOM
  useEffect(() => {
    const def = productUOMs.find(u => u.isDefault) || productUOMs[0];
    if (def && !selectedUOMId) setSelectedUOMId(def.uomId);
  }, [productUOMs]);

  // Auto-select single options
  useEffect(() => {
    const autoSelects: VariantSelection = {};
    variantGroups.forEach(group => {
      if (group.options.length === 1 && !variantSelections[group.id]) {
        autoSelects[group.id] = group.options[0].id;
      }
    });
    if (Object.keys(autoSelects).length > 0) {
      setVariantSelections(v => ({ ...v, ...autoSelects }));
    }
  }, [variantGroups]);

  // Notify parent
  useEffect(() => {
    const addToCartLabel = !allRequired
      ? 'Select Options'
      : finalStock === 0
      ? 'Out of Stock'
      : `Add ${quantity} ${selectedUOM?.uomAbbr || 'unit'}${quantity > 1 ? 's' : ''} to Cart`;

    onSelectionChange?.({
      variantSelections,
      selectedOptions,
      selectedUOM,
      quantity,
      finalPrice,
      finalStock,
      isAvailable,
      addToCartLabel,
    });
  }, [variantSelections, selectedUOMId, quantity, finalPrice, finalStock, isAvailable]);

  const selectVariant = (groupId: string, optionId: string) => {
    setVariantSelections(v => ({ ...v, [groupId]: optionId }));
  };

  const adjustQuantity = (delta: number) => {
    setQuantity(q => {
      const next = q + delta * stepQty;
      return Math.max(minQty, Math.min(maxQty, next));
    });
  };

  const isOptionCompatible = (group: ProductVariantGroup, option: VariantOption): boolean => {
    // For now all options are shown; in future we can check cross-variant stock
    return option.isAvailable !== false && option.stockQty > 0;
  };

  return (
    <div className="space-y-5">
      {/* ── Price Display ── */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-3xl font-black text-brand-700">{formatPrice(finalPrice)}</span>
        {finalCompare && finalCompare > finalPrice && (
          <span className="text-lg text-gray-400 line-through">{formatPrice(finalCompare)}</span>
        )}
        {selectedUOM && (
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">per {selectedUOM.label || selectedUOM.uomName}</span>
        )}
        {finalCompare && finalCompare > finalPrice && (
          <span className="badge badge-red font-bold text-xs">
            Save {Math.round(((finalCompare - finalPrice) / finalCompare) * 100)}%
          </span>
        )}
      </div>

      {/* ── UOM Selector ── */}
      {productUOMs.length > 1 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-bold text-gray-700">Unit / Pack Size</label>
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-gray-400 cursor-help"/>
              <div className="absolute left-full ml-2 top-0 w-56 bg-gray-800 text-white text-xs rounded-lg p-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                Select the unit of measure or pack size you want to purchase. Price adjusts automatically.
              </div>
            </div>
          </div>

          {productUOMs.length <= 6 ? (
            /* Button grid for few UOMs */
            <div className="flex flex-wrap gap-2">
              {productUOMs.map(uom => {
                const active = (selectedUOMId || productUOMs.find(u=>u.isDefault)?.uomId) === uom.uomId;
                const uomPrice = (basePrice + (selectedOptions.reduce((s,o)=>s+(o?.priceAdjustment||0),0))) * uom.priceMultiplier;
                return (
                  <button key={uom.uomId} type="button" onClick={() => setSelectedUOMId(uom.uomId)}
                    className={`relative flex flex-col items-center px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all min-w-[80px] ${
                      active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}>
                    {active && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white"/></div>}
                    <span className="text-sm font-black">{uom.uomAbbr}</span>
                    <span className="text-gray-500 font-normal mt-0.5">{uom.label || uom.uomName}</span>
                    <span className={`mt-1 ${active ? 'text-brand-700' : 'text-gray-600'}`}>{formatPrice(uomPrice)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Dropdown for many UOMs */
            <select
              value={selectedUOMId}
              onChange={e => setSelectedUOMId(e.target.value)}
              className="input-field font-semibold"
            >
              {productUOMs.map(uom => {
                const uomPrice = (basePrice + (selectedOptions.reduce((s,o)=>s+(o?.priceAdjustment||0),0))) * uom.priceMultiplier;
                return (
                  <option key={uom.uomId} value={uom.uomId}>
                    {uom.uomAbbr} — {uom.label || uom.uomName} · {formatPrice(uomPrice)}
                  </option>
                );
              })}
            </select>
          )}

          {/* UOM info */}
          {selectedUOM && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
              {selectedUOM.stockMultiplier > 1 && <span className="bg-gray-100 rounded-lg px-2 py-0.5">1 {selectedUOM.uomName} = {selectedUOM.stockMultiplier} pieces</span>}
              {selectedUOM.minOrderQty > 1 && <span className="bg-amber-50 text-amber-700 rounded-lg px-2 py-0.5">Min order: {selectedUOM.minOrderQty}</span>}
              {selectedUOM.stepQty > 1 && <span className="bg-gray-100 rounded-lg px-2 py-0.5">Order in multiples of {selectedUOM.stepQty}</span>}
            </div>
          )}
        </div>
      )}

      {/* ── Variant Groups ── */}
      {variantGroups.map(group => {
        const selected = variantSelections[group.id];
        const selectedOption = group.options.find(o => o.id === selected);
        return (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm font-bold text-gray-700">
                {group.name}
                {group.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {selectedOption && (
                <span className="text-sm text-gray-500">— <span className="font-semibold text-gray-800">{selectedOption.value}</span>
                  {selectedOption.priceAdjustment !== 0 && (
                    <span className={`ml-1 text-xs ${selectedOption.priceAdjustment > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      ({selectedOption.priceAdjustment > 0 ? '+' : ''}{formatPrice(selectedOption.priceAdjustment)})
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Display type */}
            {group.displayType === 'color_swatches' ? (
              <div className="flex flex-wrap gap-2">
                {group.options.sort((a,b)=>a.sortOrder-b.sortOrder).map(option => {
                  const compat = isOptionCompatible(group, option);
                  const active = selected === option.id;
                  const colorMap: Record<string, string> = {
                    red:'#ef4444',blue:'#3b82f6',green:'#22c55e',yellow:'#eab308',
                    white:'#f9fafb',black:'#111827',gray:'#6b7280',orange:'#f97316',
                    purple:'#a855f7',pink:'#ec4899',brown:'#92400e',silver:'#9ca3af',
                  };
                  const bgColor = colorMap[option.value.toLowerCase()] || option.value;
                  return (
                    <button key={option.id} type="button" onClick={() => compat && selectVariant(group.id, option.id)}
                      title={option.value}
                      className={`relative w-9 h-9 rounded-full border-2 transition-all ${
                        active ? 'border-gray-900 scale-110 shadow-md' : compat ? 'border-gray-300 hover:border-gray-500 hover:scale-105' : 'border-gray-200 opacity-40 cursor-not-allowed'
                      }`}
                      style={{ backgroundColor: bgColor }}>
                      {active && <div className="absolute inset-0 flex items-center justify-center"><Check className="w-4 h-4 text-white drop-shadow"/></div>}
                      {!compat && <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-0.5 bg-gray-400 rotate-45 rounded"/></div>}
                    </button>
                  );
                })}
              </div>
            ) : group.displayType === 'image_buttons' ? (
              <div className="flex flex-wrap gap-2">
                {group.options.sort((a,b)=>a.sortOrder-b.sortOrder).map(option => {
                  const compat = isOptionCompatible(group, option);
                  const active = selected === option.id;
                  return (
                    <button key={option.id} type="button" onClick={() => compat && selectVariant(group.id, option.id)}
                      className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        active ? 'border-brand-500 shadow-md' : compat ? 'border-gray-200 hover:border-gray-400' : 'opacity-40 cursor-not-allowed border-gray-200'
                      }`}>
                      {option.image ? <img src={option.image} alt={option.value} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">{option.value}</div>}
                      {active && <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white"/></div>}
                    </button>
                  );
                })}
              </div>
            ) : group.displayType === 'dropdown' ? (
              <select value={selected || ''} onChange={e => selectVariant(group.id, e.target.value)} className="input-field">
                <option value="">Select {group.name}</option>
                {group.options.sort((a,b)=>a.sortOrder-b.sortOrder).map(o => {
                  const compat = isOptionCompatible(group, o);
                  return (
                    <option key={o.id} value={o.id} disabled={!compat}>
                      {o.value}{o.label ? ` (${o.label})` : ''}{o.priceAdjustment !== 0 ? ` ${o.priceAdjustment > 0 ? '+' : ''}${formatPrice(o.priceAdjustment)}` : ''}{!compat ? ' — Out of stock' : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              /* Buttons (default) */
              <div className="flex flex-wrap gap-2">
                {group.options.sort((a,b)=>a.sortOrder-b.sortOrder).map(option => {
                  const compat = isOptionCompatible(group, option);
                  const active = selected === option.id;
                  return (
                    <button key={option.id} type="button" onClick={() => compat && selectVariant(group.id, option.id)}
                      className={`relative px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                        active ? 'border-brand-500 bg-brand-50 text-brand-700' : compat
                          ? 'border-gray-200 hover:border-brand-300 text-gray-700 hover:text-brand-700'
                          : 'border-gray-200 text-gray-400 cursor-not-allowed line-through'
                      }`}>
                      {active && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white"/></div>}
                      {option.value}
                      {option.label && <span className="text-xs ml-1 opacity-70">({option.label})</span>}
                      {option.priceAdjustment !== 0 && (
                        <span className={`text-xs ml-1 ${option.priceAdjustment > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {option.priceAdjustment > 0 ? '+' : ''}{formatPrice(option.priceAdjustment)}
                        </span>
                      )}
                      {!compat && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-full h-0.5 bg-gray-400 rotate-45 rounded"/></span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Stock warning for selected */}
            {selectedOption && selectedOption.stockQty > 0 && selectedOption.stockQty <= 10 && (
              <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3"/>Only {selectedOption.stockQty} left in this option
              </p>
            )}
          </div>
        );
      })}

      {/* ── Quantity Selector ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-bold text-gray-700">Quantity</label>
          {selectedUOM && <span className="text-xs text-gray-400">({selectedUOM.uomName})</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <button type="button" onClick={() => adjustQuantity(-1)} disabled={quantity <= minQty}
              className="px-3 py-3 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-gray-200">
              <Minus className="w-4 h-4"/>
            </button>
            <input
              type="number"
              value={quantity}
              onChange={e => {
                const v = Number(e.target.value);
                if (!isNaN(v)) setQuantity(Math.max(minQty, Math.min(maxQty, Math.round(v / stepQty) * stepQty)));
              }}
              className="w-16 text-center font-bold text-gray-900 text-base py-3 outline-none bg-white"
              min={minQty}
              max={maxQty}
              step={stepQty}
            />
            <button type="button" onClick={() => adjustQuantity(1)} disabled={quantity >= maxQty}
              className="px-3 py-3 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-l border-gray-200">
              <Plus className="w-4 h-4"/>
            </button>
          </div>

          {/* Stock indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${
            finalStock === 0 ? 'bg-red-50 text-red-700' :
            finalStock <= 5 ? 'bg-orange-50 text-orange-700' :
            finalStock <= 20 ? 'bg-yellow-50 text-yellow-700' :
            'bg-green-50 text-green-700'
          }`}>
            <Package className="w-3.5 h-3.5"/>
            {finalStock === 0 ? 'Out of stock' : finalStock <= 5 ? `Only ${finalStock} left!` : finalStock <= 20 ? `${finalStock} in stock` : 'In stock'}
          </div>
        </div>

        {/* Bulk price note */}
        {quantity >= 10 && (
          <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
            💰 Buying in bulk? <a href="/contact" className="underline font-bold">Contact us for wholesale pricing</a>
          </p>
        )}
      </div>

      {/* ── Total ── */}
      {(productUOMs.length > 0 || quantity > 1) && (
        <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-brand-700">Total for {quantity} {selectedUOM?.uomAbbr || 'unit'}{quantity !== 1 ? 's' : ''}</span>
          <span className="text-lg font-black text-brand-700">{formatPrice(finalPrice * quantity)}</span>
        </div>
      )}

      {/* Required field note */}
      {variantGroups.some(g => g.required) && !allRequired && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"/>
          Please select {variantGroups.filter(g => g.required && !variantSelections[g.id]).map(g => g.name).join(', ')}
        </p>
      )}
    </div>
  );
}

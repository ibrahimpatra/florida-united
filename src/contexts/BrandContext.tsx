'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_BRAND, type Brand } from '@/lib/brand';

const BrandContext = createContext<Brand>(DEFAULT_BRAND);
export const BrandProvider = ({ value, children }: { value: Brand; children: ReactNode }) => <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
/** Same keys as SITE_CONFIG, but with whatever the admin saved in Settings applied. */
export const useBrand = () => useContext(BrandContext);

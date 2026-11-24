'use client';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PopupManager } from './PopupManager';
import { BusyProvider } from './BusyLayer';
import { RecentSync } from './RecentSync';
import { MobileNav } from './MobileNav';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <BusyProvider>
        {children}
        <PopupManager />
        <RecentSync />
        <MobileNav />
        </BusyProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}

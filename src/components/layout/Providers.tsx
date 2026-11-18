'use client';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PopupManager } from './PopupManager';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        {children}
        <PopupManager />
      </LanguageProvider>
    </SessionProvider>
  );
}

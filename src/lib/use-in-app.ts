'use client';
import { useEffect, useState } from 'react';

/** True inside the Android/iOS app shell (its user agent contains "FloridaKuwaitApp"). Google sign-in is blocked inside app web views, so those screens hide it. */
export function useInApp(): boolean {
  const [inApp, setInApp] = useState(false);
  useEffect(() => { try { setInApp(/FloridaKuwaitApp/i.test(navigator.userAgent)); } catch { /* ignore */ } }, []);
  return inApp;
}

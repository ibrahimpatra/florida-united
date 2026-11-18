import { AsyncLocalStorage } from 'node:async_hooks';

/** Collects the problems that happen while ONE API request is handled, so the response can explain them to an admin. */
export interface ReqStore { notes: string[] }
export const reqStore = new AsyncLocalStorage<ReqStore>();

const fmt = (args: any[]) => args.map(a => a instanceof Error ? a.message : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a)?.slice(0, 200); } catch { return String(a); } })()).join(' ').replace(/\x1b\[[0-9;]*m/g, '').slice(0, 400);

export function noteIssue(text: string) { const s = reqStore.getStore(); if (s && s.notes.length < 6) s.notes.push(text); }

// Every console.error / console.warn made while a request is running (our logger, route catch blocks, libraries) is also noted.
const g = globalThis as any;
if (!g.__fkConsolePatched) {
  g.__fkConsolePatched = true;
  for (const k of ['error', 'warn'] as const) {
    const orig = console[k].bind(console);
    console[k] = (...a: any[]) => { try { noteIssue(fmt(a)); } catch {} orig(...a); };
  }
}

'use client';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { useLanguage } from '@/contexts/LanguageContext';

export interface Bi { en: string; ar: string }
export interface Section { h: Bi; p?: Bi[]; list?: Bi[] }

/** Shared layout for the policy / about pages: a narrow reading column with a sticky section index on wide screens. */
export function InfoPage({ title, intro, sections, updated }: { title: Bi; intro?: Bi; sections: Section[]; updated?: string }) {
  const { isArabic } = useLanguage();
  const x = (b: Bi) => (isArabic ? b.ar : b.en);
  return (
    <><AnnouncementBar /><Header />
      <main>
        <div className="page-hero">
          <div className="container-custom">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 font-display">{x(title)}</h1>
            {intro && <p className="mt-3 max-w-2xl text-gray-600 leading-relaxed">{x(intro)}</p>}
            {updated && <p className="mt-3 text-xs text-gray-400">{isArabic ? 'آخر تحديث' : 'Last updated'}: {updated}</p>}
          </div>
        </div>
        <div className="container-custom py-10 grid lg:grid-cols-[14rem_1fr] gap-10">
          <nav className="hidden lg:block">
            <ul className="sticky top-28 space-y-2 border-s border-gray-200 ps-4 text-sm">
              {sections.map((s, i) => <li key={i}><a href={`#s${i}`} className="text-gray-500 hover:text-brand-700">{x(s.h)}</a></li>)}
            </ul>
          </nav>
          <article className="max-w-3xl space-y-9">
            {sections.map((s, i) => (
              <section key={i} id={`s${i}`} className="scroll-mt-28">
                <h2 className="text-xl font-bold text-gray-900 mb-3 font-display">{x(s.h)}</h2>
                {s.p?.map((p, k) => <p key={k} className="text-gray-700 leading-7 mb-3">{x(p)}</p>)}
                {s.list && <ul className="list-disc ps-5 space-y-1.5 text-gray-700 leading-7">{s.list.map((l, k) => <li key={k}>{x(l)}</li>)}</ul>}
              </section>
            ))}
            <p className="text-sm text-gray-500 pt-4 border-t border-gray-200">
              {isArabic ? 'لديك سؤال؟' : 'Questions?'} <Link href="/contact" className="text-brand-600 font-semibold hover:underline">{isArabic ? 'تواصل معنا' : 'Contact us'}</Link>
            </p>
          </article>
        </div>
      </main>
      <Footer /></>
  );
}

// Arabic twins of the public pages. Same components; the language comes from the /ar URL (see LanguageContext).
export default function ArabicLayout({ children }: { children: React.ReactNode }) {
  return <div lang="ar" dir="rtl">{children}</div>;
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '🎱 بلياردو الملوك (8-Ball Pool) & سنوكر | Royal Billiards & Snooker',
  description: 'لعبة بلياردو 8 Ball Pool الاحترافية وترابيزة السنوكر الإنجليزية الملكية',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased min-h-screen bg-[#020912] text-slate-100 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}

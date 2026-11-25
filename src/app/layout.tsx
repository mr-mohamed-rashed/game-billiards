import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '🎱 بلياردو الملوك (8-Ball Pool) & سنوكر | Royal Billiards & Snooker',
  description: 'لعبة بلياردو 8 Ball Pool الاحترافية وترابيزة السنوكر الإنجليزية الملكية',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased h-dvh w-screen bg-[#020912] text-slate-100 overflow-hidden">
        {children}
      </body>
    </html>
  );
}

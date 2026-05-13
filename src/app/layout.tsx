import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Global Digital Care | Assurgent',
  description: 'Digital Register System and HR Management',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-h-dvh bg-slate-50 dark:bg-slate-950" suppressHydrationWarning>
      <body className={`${inter.className} min-h-dvh bg-slate-50 dark:bg-slate-950 antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              <div className="flex min-h-0 h-dvh w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                <div className="hidden h-dvh min-h-0 shrink-0 self-stretch lg:flex lg:flex-col">
                  <Sidebar />
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
                  <Topbar />
                  <main className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-slate-50 dark:bg-slate-950 p-8 has-[.messages-route-root]:overflow-hidden has-[.messages-route-root]:p-0">
                    {children}
                  </main>
                </div>
              </div>
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

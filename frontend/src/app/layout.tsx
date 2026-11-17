import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import '@/styles/globals.css';
import { LiffProvider } from '@/hooks/useLiff';
import { CartProvider } from '@/hooks/useCart';
import { SellerProvider } from '@/hooks/useSeller';
import { ListingProvider } from '@/hooks/useListing';
import { ProfileProvider } from '@/hooks/useProfile';
import { V4OrdersProvider } from '@/hooks/useV4Orders';
import { AppModeProvider } from '@/hooks/useAppMode';
import { AppShell } from '@/components/layout/AppShell';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ibm-plex-thai',
});

export const metadata: Metadata = {
  title: 'GongDong (กองดอง) — ตลาดหนังสือมือสองบน LINE',
  description: 'ตลาดหนังสือมือสองสำหรับนักศึกษา · นัดรับใน มช. หรือส่งพัสดุ',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiUrl =
    process.env.NEXT_PUBLIC_USE_API_PROXY === 'true'
      ? ''
      : process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || '';

  return (
    <html lang="th" className={ibmPlexSansThai.variable}>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        {apiUrl && <link rel="preconnect" href={apiUrl} crossOrigin="anonymous" />}
      </head>
      <body className={`${ibmPlexSansThai.className} min-h-screen bg-slate-100 text-slate-900 antialiased flex flex-col items-center`}>
        <LiffProvider>
          <AppModeProvider>
          <ProfileProvider>
            <CartProvider>
              <SellerProvider>
                <V4OrdersProvider>
                  <ListingProvider>
                    <AppShell>{children}</AppShell>
                  </ListingProvider>
                </V4OrdersProvider>
              </SellerProvider>
            </CartProvider>
          </ProfileProvider>
          </AppModeProvider>
        </LiffProvider>
      </body>
    </html>
  );
}

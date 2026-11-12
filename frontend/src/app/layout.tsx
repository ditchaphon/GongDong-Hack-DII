import type { Metadata } from 'next';
import '@/styles/globals.css';
import { LiffProvider } from '@/hooks/useLiff';
import { CartProvider } from '@/hooks/useCart';
import { SellerProvider } from '@/hooks/useSeller';
import { ListingProvider } from '@/hooks/useListing';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'GongDong (กองดอง) — ตลาดหนังสือมือสองบน LINE',
  description: 'ซื้อขายหนังสือมือสอง มั่นใจ ปลอดภัย นัดรับได้ ไม่มีโกง',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased flex flex-col items-center">
        <LiffProvider>
          <CartProvider>
            <SellerProvider>
              <ListingProvider>
                <AppShell>{children}</AppShell>
              </ListingProvider>
            </SellerProvider>
          </CartProvider>
        </LiffProvider>
      </body>
    </html>
  );
}

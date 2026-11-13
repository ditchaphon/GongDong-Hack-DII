'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Payout verification moved into the shop wizard's KYC step. */
export default function PayoutVerifyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/seller/setup?step=4');
  }, [router]);
  return null;
}

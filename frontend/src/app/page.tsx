import React from 'react';
import { HomeFeedClient } from '@/components/home/HomeFeedClient';
import { BackendBookFeedItem, mapBackendBookToBook } from '@/lib/mappers';
import type { Book } from '@/types';

export const revalidate = 30;

async function fetchInitialBooks(): Promise<Book[]> {
  const configuredBackend = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  if (!configuredBackend) {
    return [];
  }

  try {
    const response = await fetch(`${configuredBackend}/api/books?limit=30`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: { books?: BackendBookFeedItem[] };
      books?: BackendBookFeedItem[];
    };
    const rawBooks = payload?.data?.books ?? payload?.books ?? [];
    return Array.isArray(rawBooks) ? rawBooks.map(mapBackendBookToBook) : [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const initialBooks = await fetchInitialBooks();
  return <HomeFeedClient initialBooks={initialBooks} />;
}

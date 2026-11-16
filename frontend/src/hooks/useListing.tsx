'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {
  BookGrade,
  ConditionChecklist as ConditionChecklistType,
  DeliveryMethod,
  ListingDefect,
  ListingDraft,
} from '@/types';
import { calculateGrade } from '@/components/ui/ConditionChecklist';

export const EMPTY_CHECKLIST: ConditionChecklistType = {
  coverIntact: true,
  noHighlight: true,
  noWaterDamage: true,
  pagesComplete: true,
  noYellowing: true,
};

export const EMPTY_DRAFT: ListingDraft = {
  mode: 'SINGLE',
  isbn: '',
  title: '',
  author: '',
  publisher: '',
  description: '',
  categories: [],
  customCategory: '',
  originalPrice: 0,
  totalVolumes: 1,
  missingVolumes: [],
  photos: {
    cover: '',
    back: '',
    spine: '',
    nameTag: '',
    defects: [],
  },
  checklist: EMPTY_CHECKLIST,
  defects: [],
  price: 0,
  deliveryMethods: ['MEETUP'],
  parcelShippingFee: 40,
  codEnabled: false,
};

export interface ListingContextValue {
  draft: ListingDraft;
  grade: BookGrade;
  setDraft: React.Dispatch<React.SetStateAction<ListingDraft>>;
  update: (patch: Partial<ListingDraft>) => void;
  setPhoto: (
    key: 'cover' | 'back' | 'spine' | 'nameTag' | 'inner',
    url: string
  ) => void;
  setChecklist: (next: ConditionChecklistType) => void;
  addDefect: (defect: ListingDefect) => void;
  removeDefect: (id: string) => void;
  toggleDelivery: (method: DeliveryMethod) => void;
  toggleMissingVolume: (volume: number) => void;
  resetDraft: (mode?: 'SINGLE' | 'SET') => void;
}

const ListingContext = createContext<ListingContextValue | null>(null);

export const ListingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [draft, setDraft] = useState<ListingDraft>(EMPTY_DRAFT);

  const grade = useMemo(() => calculateGrade(draft.checklist), [draft.checklist]);

  const update = (patch: Partial<ListingDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const setPhoto = (key: 'cover' | 'back' | 'spine' | 'nameTag' | 'inner', url: string) =>
    setDraft((prev) => ({
      ...prev,
      photos: { ...prev.photos, [key]: url },
    }));

  const setChecklist = (next: ConditionChecklistType) =>
    setDraft((prev) => ({ ...prev, checklist: next }));

  const addDefect = (defect: ListingDefect) =>
    setDraft((prev) => ({
      ...prev,
      defects: [...prev.defects, defect],
      photos: {
        ...prev.photos,
        defects: defect.photo
          ? [...prev.photos.defects, defect.photo]
          : prev.photos.defects,
      },
    }));

  const removeDefect = (id: string) =>
    setDraft((prev) => {
      const removed = prev.defects.find((d) => d.id === id);
      let removedOnePhoto = false;
      const nextDefectPhotos = removed?.photo
        ? prev.photos.defects.filter((url) => {
            if (!removedOnePhoto && url === removed.photo) {
              removedOnePhoto = true;
              return false;
            }
            return true;
          })
        : prev.photos.defects;
      return {
        ...prev,
        defects: prev.defects.filter((d) => d.id !== id),
        photos: {
          ...prev.photos,
          defects: nextDefectPhotos,
        },
      };
    });

  const toggleDelivery = (method: DeliveryMethod) =>
    setDraft((prev) => {
      const has = prev.deliveryMethods.includes(method);
      const next = has
        ? prev.deliveryMethods.filter((m) => m !== method)
        : [...prev.deliveryMethods, method];
      return { ...prev, deliveryMethods: next.length ? next : prev.deliveryMethods };
    });

  const toggleMissingVolume = (volume: number) =>
    setDraft((prev) => ({
      ...prev,
      missingVolumes: prev.missingVolumes.includes(volume)
        ? prev.missingVolumes.filter((v) => v !== volume)
        : [...prev.missingVolumes, volume].sort((a, b) => a - b),
    }));

  const resetDraft = (mode: 'SINGLE' | 'SET' = 'SINGLE') =>
    setDraft({ ...EMPTY_DRAFT, mode, totalVolumes: mode === 'SET' ? 2 : 1 });

  return (
    <ListingContext.Provider
      value={{
        draft,
        grade,
        setDraft,
        update,
        setPhoto,
        setChecklist,
        addDefect,
        removeDefect,
        toggleDelivery,
        toggleMissingVolume,
        resetDraft,
      }}
    >
      {children}
    </ListingContext.Provider>
  );
};

export function useListing(): ListingContextValue {
  const ctx = useContext(ListingContext);
  if (!ctx) throw new Error('useListing must be used within a <ListingProvider>');
  return ctx;
}

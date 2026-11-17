'use client';

import React from 'react';
import { FlaskConical } from 'lucide-react';

interface AdminDemoBannerProps {
  title?: string;
  description: string;
}

export const AdminDemoBanner: React.FC<AdminDemoBannerProps> = ({
  title = 'โหมดนำเสนอ (Admin Demo · Dry-run)',
  description,
}) => (
  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
    <FlaskConical className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
    <div className="text-[11px] leading-relaxed">
      <p className="font-bold">{title}</p>
      <p className="text-amber-800/90 mt-0.5">{description}</p>
    </div>
  </div>
);

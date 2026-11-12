'use client';

import React from 'react';
import { maskContact } from '@/lib/masking';

export interface MaskedTextProps {
  text: string;
  className?: string;
  /** Turn off only for system-generated text that never contains contact data. */
  mask?: boolean;
}

/**
 * Renders text with phone-like numbers, LINE ids/handles, e-mails and
 * bank-account-like numbers replaced by `•••` (v4 masking rule).
 */
export const MaskedText: React.FC<MaskedTextProps> = ({
  text,
  className,
  mask = true,
}) => (
  <span className={className}>{mask ? maskContact(text) : text}</span>
);

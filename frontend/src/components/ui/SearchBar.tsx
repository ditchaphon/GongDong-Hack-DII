'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  value?: string;
  onChange?: (val: string) => void;
  onSearch?: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder = 'ค้นหาชื่อหนังสือ, ผู้แต่ง, ISBN...',
  className,
  disabled = false,
  autoFocus = false,
}) => {
  const [internalValue, setInternalValue] = useState('');
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    if (!isControlled) setInternalValue(newVal);
    onChange?.(newVal);
  };

  const handleClear = () => {
    if (!isControlled) setInternalValue('');
    onChange?.('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch?.(value);
    }
  };

  return (
    <div
      className={clsx(
        'relative flex items-center w-full min-h-[44px] bg-slate-100 rounded-2xl px-3.5 py-2 transition-all',
        'focus-within:bg-white focus-within:ring-2 focus-within:ring-[#06C755]/20 focus-within:border focus-within:border-[#06C755]',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="ล้างการค้นหา"
          className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};


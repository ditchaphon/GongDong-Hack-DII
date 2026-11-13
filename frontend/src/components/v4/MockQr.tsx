'use client';

import React from 'react';
import { QR_SIZE, buildQrCells, finderOrigins, isFinderArea } from '@/lib/qr';

/** Prototype QR (not scannable by real apps) rendered as SVG. */
export const MockQr: React.FC<{ value: string; size?: number; className?: string }> = ({
  value,
  size = 200,
  className,
}) => {
  const cells = buildQrCells(value);
  return (
    <svg
      viewBox={`-2 -2 ${QR_SIZE + 4} ${QR_SIZE + 4}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="QR รับของ"
      shapeRendering="crispEdges"
    >
      <rect x={-2} y={-2} width={QR_SIZE + 4} height={QR_SIZE + 4} fill="#fff" />
      {cells.map((on, index) => {
        const row = Math.floor(index / QR_SIZE);
        const col = index % QR_SIZE;
        if (!on || isFinderArea(row, col)) return null;
        return <rect key={index} x={col} y={row} width={1} height={1} fill="#1f1a16" />;
      })}
      {finderOrigins().map(({ x, y }) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={7} height={7} fill="#1f1a16" />
          <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
          <rect x={x + 2} y={y + 2} width={3} height={3} fill="#1f1a16" />
        </g>
      ))}
    </svg>
  );
};

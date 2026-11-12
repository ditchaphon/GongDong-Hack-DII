'use client';

import React from 'react';
import clsx from 'clsx';
import { Order } from '@/types';
import { StatusBadge } from './StatusBadge';
import { MapPin, Truck, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface OrderCardProps {
  order: Order;
  role?: 'buyer' | 'seller';
  onAction?: (order: Order) => void;
  onClick?: () => void;
  className?: string;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  role = 'buyer',
  onAction,
  onClick,
  className,
}) => {
  const isMeetup = order.deliveryMethod === 'MEETUP';
  const firstBook = order.books[0];
  const totalBooks = order.books.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={clsx(
        'flex flex-col bg-white border border-slate-200 rounded-2xl p-4 transition-all select-none',
        'hover:border-slate-300 hover:shadow-xs active:scale-[0.99] cursor-pointer',
        className
      )}
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">#{order.id}</span>
          <span className="text-xs text-slate-300">•</span>
          <span className="text-xs text-slate-400">{order.createdAt}</span>
        </div>
        <StatusBadge status={order.status} size="sm" />
      </div>

      <div className="flex gap-3 py-3">
        {firstBook && (
          <div className="relative w-14 h-18 bg-slate-100 rounded-lg overflow-hidden shrink-0">
            <img
              src={firstBook.photos.cover}
              alt={firstBook.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <h4 className="font-semibold text-slate-900 text-sm line-clamp-1">
              {firstBook?.title || 'หนังสือมือสอง'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalBooks > 1 ? `และอีก ${totalBooks - 1} เล่ม` : `1 เล่ม`}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
            {isMeetup ? (
              <span className="flex items-center text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-[11px] font-medium">
                <MapPin className="w-3 h-3 mr-1 text-teal-600" />
                {order.meetupDetails?.zone || 'นัดรับ ฿0'}
              </span>
            ) : (
              <span className="flex items-center text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                <Truck className="w-3 h-3 mr-1 text-slate-500" />
                ส่งพัสดุ
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-1">
        <div>
          <span className="text-xs text-slate-500">ยอดรวม: </span>
          <span className="text-base font-bold text-slate-900">
            ฿{order.totalAmount.toLocaleString()}
          </span>
        </div>

        {role === 'buyer' && order.status === 'WAITING_PAYMENT' && !isMeetup && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAction?.(order);
            }}
          >
            แนบสลิปโอน
          </Button>
        )}

        {role === 'seller' && order.status === 'PENDING_ACCEPT' && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAction?.(order);
            }}
          >
            รับออเดอร์ (-1 เครดิต)
          </Button>
        )}

        {(!onAction || (role === 'buyer' && order.status !== 'WAITING_PAYMENT') || (role === 'seller' && order.status !== 'PENDING_ACCEPT')) && (
          <div className="flex items-center text-xs text-slate-400 group-hover:text-slate-600">
            <span>ดูรายละเอียด</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </div>
        )}
      </div>
    </div>
  );
};


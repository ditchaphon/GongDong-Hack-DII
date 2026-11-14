'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, EmptyState, Modal, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { BackendAddress, mapBackendAddressToAddress } from '@/lib/mappers';
import { useCart } from '@/hooks/useCart';
import { Address } from '@/types';
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react';

export default function AddressesPage() {
  const router = useRouter();
  const { refreshAddresses } = useCart();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadAddresses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ addresses: BackendAddress[] }>('/api/users/me/addresses');
      setAddresses((res.addresses ?? []).map(mapBackendAddressToAddress));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดที่อยู่ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    try {
      await api.delete(`/api/users/me/addresses/${id}`);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      setDeleteTargetId(null);
      setToastMessage('ลบที่อยู่เรียบร้อยแล้ว');
      await refreshAddresses();
    } catch (err) {
      setDeleteTargetId(null);
      setToastMessage(err instanceof Error ? err.message : 'ลบที่อยู่ไม่สำเร็จ');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/api/users/me/addresses/${id}`, { is_default: true });
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
      setToastMessage('ตั้งเป็นที่อยู่เริ่มต้นแล้ว ✓');
      await refreshAddresses();
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
      <TopBar title="จัดการที่อยู่จัดส่ง" />

      <div className="p-4 space-y-3 flex-1">
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>ที่อยู่ของคุณ ({addresses.length}/5 ที่อยู่)</span>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <EmptyState
              title="โหลดที่อยู่ไม่สำเร็จ"
              description={error}
              actionText="ลองใหม่"
              onAction={loadAddresses}
            />
          </div>
        ) : addresses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <EmptyState
              icon={<MapPin className="w-8 h-8 text-slate-400" />}
              title="ยังไม่มีที่อยู่จัดส่ง"
              description="เพิ่มที่อยู่เพื่อใช้คำนวณค่าส่งและรับพัสดุ"
              actionText="เพิ่มที่อยู่ใหม่"
              onAction={() => router.push('/addresses/edit')}
            />
          </div>
        ) : (
          addresses.map((addr) => (
          <div
            key={addr.id}
            className={`p-4 rounded-2xl border transition space-y-3 ${
              addr.isDefault
                ? 'bg-white border-[#8B5E3C] ring-1 ring-[#8B5E3C]/20 shadow-xs'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">{addr.fullName}</h3>
                  {addr.isDefault && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      ค่าเริ่มต้น ✓
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Link
                  href={`/addresses/edit?id=${addr.id}`}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
                >
                  <Edit2 className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(addr.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {addr.detail} ต.{addr.subdistrict} อ.{addr.district} จ.{addr.province}{' '}
              {addr.postalCode}
            </p>

            {!addr.isDefault && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleSetDefault(addr.id)}
                  className="text-xs text-[#8B5E3C] font-semibold hover:underline"
                >
                  ตั้งเป็นที่อยู่จัดส่งเริ่มต้น
                </button>
              </div>
            )}
          </div>
          ))
        )}
      </div>

      {/* Add Address CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => router.push('/addresses/edit')}
          >
            เพิ่มที่อยู่จัดส่งใหม่
          </Button>
        </div>
      </div>

      {/* Delete Address Modal (DELADDR in Figma 28:2267) */}
      <Modal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="ยืนยันการลบที่อยู่? (DELADDR)"
        description="คุณต้องการลบที่อยู่จัดส่งนี้ออกจากรายการของคุณใช่หรือไม่?"
        confirmText="ลบที่อยู่"
        confirmVariant="danger"
        onConfirm={handleDelete}
      />

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}


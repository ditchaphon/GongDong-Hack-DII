'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { THAI_PROVINCES } from '@/lib/delivery';
import { BackendAddress } from '@/lib/mappers';
import { useCart } from '@/hooks/useCart';
import { MapPin } from 'lucide-react';

const POPULAR_AREAS = [
  { label: 'มช. / สุเทพ', prov: 'เชียงใหม่', dist: 'เมืองเชียงใหม่', sub: 'สุเทพ', zip: '50200' },
  { label: 'ช้างเผือก', prov: 'เชียงใหม่', dist: 'เมืองเชียงใหม่', sub: 'ช้างเผือก', zip: '50300' },
  { label: 'ปทุมวัน กทม.', prov: 'กรุงเทพมหานคร', dist: 'ปทุมวัน', sub: 'วังใหม่', zip: '10330' },
  { label: 'เมืองนนทบุรี', prov: 'นนทบุรี', dist: 'เมืองนนทบุรี', sub: 'บางเขน', zip: '11000' },
];

function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext) return '/addresses';
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/addresses';
  }
  return trimmed;
}

export default function AddressEditPage() {
  const router = useRouter();
  const { refreshAddresses } = useCart();

  const [editId, setEditId] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState('/addresses');
  const [fullName, setFullName] = useState('');
  const [province, setProvince] = useState('เชียงใหม่');
  const [district, setDistrict] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [detail, setDetail] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    setNextPath(getSafeNextPath(params.get('next')));
    if (!id) return;
    setEditId(id);
    setLoading(true);
    api
      .get<BackendAddress[]>('/api/users/me/addresses')
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        const found = list.find((a) => a.id === id);
        if (found) {
          setFullName(found.full_name);
          setProvince(found.province);
          setDistrict(found.district);
          setSubdistrict(found.subdistrict);
          setPostalCode(found.postal_code);
          setDetail(found.detail);
          setIsDefault(Boolean(found.is_default));
        }
      })
      .catch(() => {
        setToastMessage('โหลดข้อมูลที่อยู่ไม่สำเร็จ');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelectArea = (item: (typeof POPULAR_AREAS)[number]) => {
    setProvince(item.prov);
    setDistrict(item.dist);
    setSubdistrict(item.sub);
    setPostalCode(item.zip);
  };

  const handleSave = async () => {
    if (
      !fullName.trim() ||
      !province.trim() ||
      !district.trim() ||
      !subdistrict.trim() ||
      !postalCode.trim() ||
      !detail.trim()
    ) {
      setToastMessage('กรุณากรอกข้อมูลที่อยู่จัดส่งให้ครบถ้วน');
      return;
    }
    if (!/^\d{5}$/.test(postalCode.trim())) {
      setToastMessage('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
      return;
    }
    setSaving(true);
    const payload = {
      fullName: fullName.trim(),
      province: province.trim(),
      district: district.trim(),
      subdistrict: subdistrict.trim(),
      postalCode: postalCode.trim(),
      detail: detail.trim(),
      isDefault,
    };
    try {
      if (editId) {
        await api.patch(`/api/users/me/addresses/${editId}`, payload);
      } else {
        await api.post('/api/users/me/addresses', payload);
      }
      await refreshAddresses();
      setToastMessage('บันทึกที่อยู่เรียบร้อยแล้ว ✓');
      setTimeout(() => router.push(nextPath), 500);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'บันทึกที่อยู่ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
      <TopBar title={editId ? 'แก้ไขที่อยู่จัดส่ง' : 'เพิ่มที่อยู่จัดส่ง'} />

      <div className="p-4 space-y-4 flex-1">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          ใช้สำหรับจัดส่งเท่านั้น
        </p>

        {/* Quick presets */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>ทางลัดพื้นที่ยอดนิยม (กดเติมอัตโนมัติ)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_AREAS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleSelectArea(item)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-[#8B5E3C] hover:text-[#8B5E3C] transition"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5">
          <Input
            label="ชื่อ-นามสกุล ผู้รับ *"
            placeholder="เช่น นภัทร ใจดี"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div className="space-y-1.5">
            <label htmlFor="addr-province" className="text-xs font-semibold text-slate-700 block">
              จังหวัด *
            </label>
            <select
              id="addr-province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-[#8B5E3C]"
            >
              {THAI_PROVINCES.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="อำเภอ / เขต *"
              placeholder="เช่น เมืองเชียงใหม่"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
            <Input
              label="ตำบล / แขวง *"
              placeholder="เช่น สุเทพ"
              value={subdistrict}
              onChange={(e) => setSubdistrict(e.target.value)}
            />
          </div>

          <Input
            label="รหัสไปรษณีย์ (5 หลัก) *"
            placeholder="เช่น 50200"
            inputMode="numeric"
            maxLength={5}
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              รายละเอียดที่อยู่ (บ้านเลขที่, ถนน, ซอย, ตึก/หอพัก) *
            </label>
            <textarea
              rows={3}
              placeholder="เช่น 239 ถนนห้วยแก้ว หอพัก 4 ห้อง 201"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5E3C]"
            />
          </div>

          {/* Toggle default address */}
          <label className="flex items-center gap-3 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 accent-[#8B5E3C] rounded"
            />
            <span className="text-xs font-semibold text-slate-700">
              ตั้งเป็นที่อยู่จัดส่งเริ่มต้น
            </span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" isLoading={saving} disabled={loading} onClick={handleSave}>
            บันทึกที่อยู่จัดส่ง
          </Button>
        </div>
      </div>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}


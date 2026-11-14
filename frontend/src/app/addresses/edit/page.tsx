'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, BottomSheet, Toast } from '@/components/ui';
import { api } from '@/lib/api';
import { BackendAddress } from '@/lib/mappers';
import { useCart } from '@/hooks/useCart';
import { MapPin, ChevronRight } from 'lucide-react';

export default function AddressEditPage() {
  const router = useRouter();
  const { refreshAddresses } = useCart();

  const [editId, setEditId] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState('/addresses');
  const [fullName, setFullName] = useState('');
  const [province, setProvince] = useState('เชียงใหม่');
  const [district, setDistrict] = useState('เมืองเชียงใหม่');
  const [subdistrict, setSubdistrict] = useState('สุเทพ');
  const [postalCode, setPostalCode] = useState('50200');
  const [detail, setDetail] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isProvSheetOpen, setIsProvSheetOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const next = params.get('next');
    if (next) setNextPath(next);
    if (!id) return;
    setEditId(id);
    setLoading(true);
    api
      .get<{ addresses: BackendAddress[] }>('/api/users/me/addresses')
      .then((res) => {
        const found = (res.addresses ?? []).find((a) => a.id === id);
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

  const popularProvinces = [
    { prov: 'เชียงใหม่', dist: 'เมืองเชียงใหม่', sub: 'สุเทพ', zip: '50200' },
    { prov: 'เชียงใหม่', dist: 'เมืองเชียงใหม่', sub: 'ช้างเผือก', zip: '50300' },
    { prov: 'กรุงเทพมหานคร', dist: 'ปทุมวัน', sub: 'วังใหม่', zip: '10330' },
    { prov: 'นนทบุรี', dist: 'เมืองนนทบุรี', sub: 'บางเขน', zip: '11000' },
  ];

  const handleSelectArea = (item: (typeof popularProvinces)[0]) => {
    setProvince(item.prov);
    setDistrict(item.dist);
    setSubdistrict(item.sub);
    setPostalCode(item.zip);
    setIsProvSheetOpen(false);
  };

  const handleSave = async () => {
    if (!fullName.trim() || !detail.trim() || !postalCode.trim()) {
      setToastMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    setSaving(true);
    const payload = {
      full_name: fullName.trim(),
      province: province.trim(),
      district: district.trim(),
      subdistrict: subdistrict.trim(),
      postal_code: postalCode.trim(),
      detail: detail.trim(),
      is_default: isDefault,
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
          ใช้สำหรับจัดส่งเท่านั้น · ระบบไม่ขอและไม่แสดงเบอร์โทรให้ผู้ขายเห็น
        </p>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5">
          <Input
            label="ชื่อ-นามสกุล ผู้รับ *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          {/* Province / District Picker Trigger (PROV in Figma 28:2276) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              จังหวัด / อำเภอ / ตำบล *
            </label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsProvSheetOpen(true)}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-sm"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-slate-800">
                  {province} • {district} • {subdistrict}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <Input
            label="รหัสไปรษณีย์ *"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              รายละเอียดที่อยู่ (บ้านเลขที่, ถนน, ซอย, ตึก/หอพัก) *
            </label>
            <textarea
              rows={3}
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

      {/* Province Picker BottomSheet (PROV in Figma 28:2276) */}
      <BottomSheet
        isOpen={isProvSheetOpen}
        onClose={() => setIsProvSheetOpen(false)}
        title="เลือกตำบล / อำเภอ / จังหวัด (PROV)"
      >
        <div className="space-y-2 py-2">
          {popularProvinces.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectArea(item)}
              className="flex justify-between items-center p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs"
            >
              <div>
                <span className="font-bold text-slate-900">
                  {item.sub} › {item.dist} › {item.prov}
                </span>
                <p className="text-slate-400 mt-0.5 font-mono">{item.zip}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          ))}
        </div>
      </BottomSheet>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}


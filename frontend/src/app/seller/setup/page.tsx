'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, Toast } from '@/components/ui';
import { AdminDemoBanner, MapPinPicker } from '@/components/v4';
import { useSeller } from '@/hooks/useSeller';
import { useAppMode } from '@/hooks/useAppMode';
import { useLiff } from '@/hooks/useLiff';
import { ADMIN_DEMO_SHOP_FALLBACK, ADMIN_DEMO_THAI_ID } from '@/lib/adminDemo';
import { safeDeleteUploadedImage, uploadImageFile } from '@/lib/api';
import {
  MeetupPoint,
  ShipMode,
  THAI_PROVINCES,
  provinceCentre,
} from '@/lib/delivery';
import { findContactLeaks } from '@/lib/masking';
import {
  formatThaiId,
  isValidPersonName,
  isValidThaiId,
  maskThaiId,
  onlyDigits,
} from '@/lib/kyc';
import {
  Store,
  Truck,
  FileText,
  Check,
  MapPin,
  CalendarDays,
  ShieldCheck,
  Lock,
  Plus,
  Trash2,
  Upload,
  Package,
  Calculator,
  Loader2,
} from 'lucide-react';

const DEFAULT_POINT: MeetupPoint = {
  id: 'mp-default',
  name: 'หน้าหอสมุดกลาง มช.',
  province: 'เชียงใหม่',
  lat: 18.8023,
  lng: 98.9524,
};

const SHOP_AVATARS = [
  'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=120',
  'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=120',
  'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=120',
  'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=120',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=120',
];

const DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const SLOTS = ['เช้า 9–12 น.', 'บ่าย 12–16 น.', 'เย็น 16–20 น.'];

const STEPS = [
  { id: 2, title: 'ข้อมูลร้านค้า', icon: Store },
  { id: 3, title: 'ตารางจัดส่ง', icon: Truck },
  { id: 4, title: 'ข้อมูล KYC', icon: FileText },
];

const STEP_HEADINGS: Record<number, { title: string; subtitle: string }> = {
  2: {
    title: 'ตั้งค่าร้านค้าของคุณ',
    subtitle: 'บอกเราเกี่ยวกับร้านของคุณเพื่อให้ผู้ซื้อค้นหาคุณได้',
  },
  3: {
    title: 'ตารางจัดส่ง',
    subtitle: 'จุดนัดรับ วันเวลา และรอบส่งพัสดุ · ผู้ซื้อเห็นก่อนส่งคำขอ ใช้ได้ทุกจังหวัด',
  },
  4: {
    title: 'ยืนยันตัวตน (KYC)',
    subtitle: 'ยืนยันตัวตนด้วยเลขบัตรประชาชนและชื่อจริง · แอดมินเห็นเท่านั้น',
  },
};

export default function ShopSetupWizardPage() {
  const router = useRouter();
  const { setMode } = useAppMode();
  const { user } = useLiff();
  const { shop, loading: sellerLoading, saveShop, submitKyc } = useSeller();

  const [adminDemoRequested, setAdminDemoRequested] = useState(false);
  const [hydratedAdminDemo, setHydratedAdminDemo] = useState(false);
  const isAdminDemoMode = Boolean(user.isAdmin && adminDemoRequested);

  const [step, setStep] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hydratedShop, setHydratedShop] = useState(false);

  // Step 2 — shop info
  const [shopName, setShopName] = useState(shop?.shopName || '');
  const [description, setDescription] = useState(shop?.description || '');
  const [shopAvatar, setShopAvatar] = useState(shop?.avatar || SHOP_AVATARS[0]);

  // Step 3 — delivery schedule
  const [province, setProvince] = useState(shop?.province ?? 'เชียงใหม่');
  const [points, setPoints] = useState<MeetupPoint[]>(
    shop?.meetupPoints?.length ? shop.meetupPoints : [DEFAULT_POINT]
  );
  const [addingPoint, setAddingPoint] = useState(false);
  const [newPointProvince, setNewPointProvince] = useState(shop?.province ?? 'เชียงใหม่');
  const [newPointName, setNewPointName] = useState('');
  const [newPointPin, setNewPointPin] = useState<{ lat: number; lng: number } | null>(null);
  const [days, setDays] = useState<string[]>(shop?.availableDays ?? ['จ', 'อ', 'พ', 'พฤ', 'ศ']);
  const [slots, setSlots] = useState<string[]>(shop?.availableSlots ?? [SLOTS[1]]);
  const [supportsParcel, setSupportsParcel] = useState(shop?.supportsParcel ?? false);
  const [shipMode, setShipMode] = useState<ShipMode>(shop?.shipMode ?? 'AFTER_ACCEPT');
  const [shipWithinDays, setShipWithinDays] = useState<number>(shop?.shipWithinDays ?? 2);

  // Step 4 — KYC (raw values live only in this form)
  const [nationalId, setNationalId] = useState('');
  const [firstName, setFirstName] = useState(shop?.kyc?.firstName || '');
  const [lastName, setLastName] = useState(shop?.kyc?.lastName || '');
  const [kycConsent, setKycConsent] = useState(false);
  const [editKyc, setEditKyc] = useState(!shop?.kyc);

  useEffect(() => {
    if (!shop || hydratedShop) return;
    setShopName(shop.shopName || '');
    setDescription(shop.description || '');
    if (shop.avatar) setShopAvatar(shop.avatar);
    setProvince(shop.province || 'เชียงใหม่');
    setNewPointProvince(shop.province || 'เชียงใหม่');
    if (shop.meetupPoints?.length) setPoints(shop.meetupPoints);
    if (shop.availableDays?.length) setDays(shop.availableDays);
    if (shop.availableSlots?.length) setSlots(shop.availableSlots);
    setSupportsParcel(shop.supportsParcel);
    setShipMode(shop.shipMode ?? 'AFTER_ACCEPT');
    setShipWithinDays(shop.shipWithinDays ?? 2);
    if (shop.kyc) {
      setFirstName(shop.kyc.firstName || '');
      setLastName(shop.kyc.lastName || '');
      if (!isAdminDemoMode) setEditKyc(false);
    }
    setHydratedShop(true);
  }, [shop, hydratedShop, isAdminDemoMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('adminDemo') === '1') {
      setAdminDemoRequested(true);
    }
    const requested = Number(params.get('step'));
    if (requested >= 1 && requested <= 4 && (shop?.setupComplete || (user.isAdmin && params.get('adminDemo') === '1'))) {
      setStep(Math.max(2, requested));
    }
  }, [shop?.setupComplete, user.isAdmin]);

  useEffect(() => {
    if (!isAdminDemoMode || sellerLoading || hydratedAdminDemo) return;
    if (!shop?.setupComplete) {
      setShopName(ADMIN_DEMO_SHOP_FALLBACK.shopName);
      setDescription(ADMIN_DEMO_SHOP_FALLBACK.description);
      setProvince(ADMIN_DEMO_SHOP_FALLBACK.province);
      setNewPointProvince(ADMIN_DEMO_SHOP_FALLBACK.province);
      setPoints(ADMIN_DEMO_SHOP_FALLBACK.meetupPoints);
      setDays(ADMIN_DEMO_SHOP_FALLBACK.availableDays);
      setSlots(ADMIN_DEMO_SHOP_FALLBACK.availableSlots);
      setSupportsParcel(ADMIN_DEMO_SHOP_FALLBACK.supportsParcel);
      setShipMode(ADMIN_DEMO_SHOP_FALLBACK.shipMode);
      setShipWithinDays(ADMIN_DEMO_SHOP_FALLBACK.shipWithinDays);
    }
    setEditKyc(true);
    setNationalId(ADMIN_DEMO_THAI_ID);
    setFirstName(shop?.kyc?.firstName || ADMIN_DEMO_SHOP_FALLBACK.firstName);
    setLastName(shop?.kyc?.lastName || ADMIN_DEMO_SHOP_FALLBACK.lastName);
    setKycConsent(true);
    setHydratedAdminDemo(true);
  }, [isAdminDemoMode, sellerLoading, hydratedAdminDemo, shop]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const validateStep = (current: number): string | null => {
    if (current === 2) {
      const clean = shopName.trim();
      if (clean.length < 2) return 'ตั้งชื่อร้านอย่างน้อย 2 ตัวอักษร';
      if (findContactLeaks(clean).length > 0) return 'ชื่อร้านห้ามมีเบอร์โทร ไลน์ หรือช่องทางติดต่อ';
      if (description.trim().length < 10) return 'เขียนรายละเอียดร้านอย่างน้อย 10 ตัวอักษร';
      if (findContactLeaks(description).length > 0)
        return 'รายละเอียดร้านห้ามมีเบอร์โทร ไลน์ หรือช่องทางติดต่อ';
    }
    if (current === 3) {
      if (points.length === 0 && !supportsParcel)
        return 'เพิ่มจุดนัดรับอย่างน้อย 1 จุด หรือเปิดรับส่งพัสดุ';
      if (days.length === 0) return 'เลือกวันที่สะดวกอย่างน้อย 1 วัน';
      if (slots.length === 0) return 'เลือกช่วงเวลาที่สะดวกอย่างน้อย 1 ช่วง';
    }
    if (current === 4 && editKyc) {
      if (!isValidThaiId(nationalId)) return 'เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก ตรวจหลักสุดท้ายไม่ผ่าน)';
      if (!isValidPersonName(firstName)) return 'กรอกชื่อจริงเป็นภาษาไทยหรืออังกฤษ';
      if (!isValidPersonName(lastName)) return 'กรอกนามสกุลเป็นภาษาไทยหรืออังกฤษ';
      if (!kycConsent) return 'กรุณายืนยันว่าข้อมูลเป็นของคุณ';
    }
    return null;
  };

  const goNext = () => {
    const problem = validateStep(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step < 4) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    finish();
  };

  const goBack = () => {
    setError(null);
    if (step === 2) {
      router.back();
      return;
    }
    setStep(step - 1);
  };

  const jumpTo = (target: number) => {
    if (target >= step) return; // forward only via validation
    setError(null);
    setStep(target);
  };

  const finish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (isAdminDemoMode) {
        setNationalId('');
        if (shop?.setupComplete) setMode('SELLER');
        setToastMessage('โหมดนำเสนอ (Dry-run): ตั้งร้านและ KYC สำเร็จ · ไม่ได้ทับข้อมูลจริง');
        setTimeout(() => router.push('/seller'), 600);
        return;
      }
      await saveShop({
        shopName: shopName.trim(),
        description: description.trim(),
        avatar: shopAvatar,
        province,
        meetupPoints: points,
        availableDays: days,
        availableSlots: slots,
        supportsParcel,
        shipMode,
        shipWithinDays,
      });
      if (editKyc) {
        await submitKyc({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          nationalId: onlyDigits(nationalId),
          nationalIdMasked: maskThaiId(nationalId),
          verifiedAt: new Date().toISOString(),
          pdpaConsent: kycConsent,
        });
      }
      setNationalId('');
      setMode('SELLER');
      setToastMessage(shop?.setupComplete ? 'บันทึกข้อมูลร้านแล้ว' : 'เปิดร้านสำเร็จ · ยืนยันตัวตนแล้ว');
      setTimeout(() => router.push('/seller'), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกข้อมูลร้านไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  const heading = STEP_HEADINGS[step];
  const nationalIdDigits = onlyDigits(nationalId);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title={
          isAdminDemoMode
            ? 'เปิดร้าน (Admin Demo)'
            : shop?.setupComplete
              ? 'แก้ไขข้อมูลร้าน'
              : 'เปิดร้าน'
        }
        onBack={goBack}
      />

      {isAdminDemoMode && (
        <div className="px-4 pt-3">
          <AdminDemoBanner
            title="Admin Setup Demo · Dry-run"
            description="เติมข้อมูลร้านและฟอร์ม KYC ตัวอย่างให้ครบแล้ว แก้ไขและกดถัดไปได้โดยไม่เขียนทับข้อมูลร้านจริง"
          />
        </div>
      )}

      {/* Step indicator */}
      <ol className="flex items-start px-4 pt-4 pb-2">
        {STEPS.map((s, index) => {
          const done = s.id < step;
          const current = s.id === step;
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex-1 flex flex-col items-center relative">
              {index > 0 && (
                <span
                  aria-hidden
                  className={clsx(
                    'absolute top-5 h-0.5',
                    s.id <= step ? 'bg-teal-600' : 'bg-slate-200'
                  )}
                  style={{ left: 'calc(-50% + 1.5rem)', right: 'calc(50% + 1.5rem)' }}
                />
              )}
              <button
                type="button"
                onClick={() => jumpTo(s.id)}
                aria-current={current ? 'step' : undefined}
                aria-label={s.title}
                className={clsx(
                  'relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition',
                  done || current
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-slate-400 border-2 border-slate-200',
                  current && 'ring-4 ring-teal-100'
                )}
              >
                {done ? <Check className="w-5 h-5 stroke-[3]" /> : <Icon className="w-5 h-5" />}
              </button>
              <span
                className={clsx(
                  'mt-1.5 text-[10px] text-center leading-tight',
                  current ? 'text-teal-700 font-bold' : done ? 'text-slate-800 font-semibold' : 'text-slate-400'
                )}
              >
                {s.title}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-5 shadow-xs">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{heading.title}</h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{heading.subtitle}</p>
          </div>

          {step === 2 && (
            <div className="space-y-4">
              <Input
                id="shop-name"
                label="ชื่อร้าน *"
                placeholder="ชื่อร้านของคุณ"
                value={shopName}
                maxLength={40}
                onChange={(event) => {
                  setShopName(event.target.value);
                  setError(null);
                }}
                helperText="ชื่อนี้แสดงให้ผู้ซื้อเห็น · ห้ามใส่เบอร์โทรหรือไลน์"
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="shop-description" className="text-xs font-semibold text-slate-700">
                  รายละเอียดร้าน *
                </label>
                <textarea
                  id="shop-description"
                  rows={4}
                  maxLength={300}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setError(null);
                  }}
                  placeholder="บอกผู้ซื้อเกี่ยวกับร้านของคุณ... เช่น ขายนิยายแปลและหนังสือเรียนคณะวิศวะ ดูแลอย่างดี"
                  className="w-full px-3.5 py-3 text-sm rounded-2xl border border-slate-200 resize-none focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                <p className="text-[11px] text-slate-400 text-right">{description.length}/300</p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">รูปร้าน</span>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <img src={shopAvatar} alt="รูปร้านที่เลือก" className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-500 bg-white" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <label
                      className={clsx(
                        'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700',
                        isUploadingAvatar ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-slate-100',
                      )}
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      {isUploadingAvatar ? 'กำลังอัปโหลด…' : 'อัปโหลดรูปร้านของคุณ'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingAvatar}
                        className="hidden"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (!file) return;
                          setIsUploadingAvatar(true);
                          try {
                            const previousAvatar = shopAvatar;
                            const uploaded = await uploadImageFile(file, 'avatars');
                            if (!isAdminDemoMode && previousAvatar && previousAvatar !== uploaded.url) {
                              void safeDeleteUploadedImage(previousAvatar);
                            }
                            setShopAvatar(uploaded.url);
                            setToastMessage('อัปโหลดรูปร้านแล้ว');
                          } catch (err) {
                            setToastMessage(err instanceof Error ? err.message : 'อัปโหลดรูปร้านไม่สำเร็จ');
                          } finally {
                            setIsUploadingAvatar(false);
                          }
                        }}
                      />
                    </label>
                    <p className="text-[10px] text-slate-400">โลโก้ร้าน ชั้นหนังสือ หรือเลือกรูปด้านล่าง</p>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {SHOP_AVATARS.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => {
                        if (!isAdminDemoMode && shopAvatar && shopAvatar !== url) {
                          void safeDeleteUploadedImage(shopAvatar);
                        }
                        setShopAvatar(url);
                      }}
                      aria-pressed={shopAvatar === url}
                      aria-label="เลือกรูปร้าน"
                      className={clsx(
                        'relative w-14 h-14 rounded-full overflow-hidden border-2 shrink-0 transition',
                        shopAvatar === url
                          ? 'border-teal-600 ring-2 ring-teal-600/20'
                          : 'border-slate-200 opacity-70'
                      )}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {shopAvatar === url && (
                        <span className="absolute inset-0 bg-teal-700/30 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white stroke-[3]" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <section className="space-y-2">
                <label htmlFor="shop-province" className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Package className="w-4 h-4 text-teal-600" />
                  จังหวัดที่ร้านอยู่ *
                </label>
                <select
                  id="shop-province"
                  value={province}
                  onChange={(event) => setProvince(event.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-teal-500"
                >
                  {THAI_PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    จุดนัดรับของร้าน
                  </span>
                  <span className="text-[10px] text-slate-400">{points.length} จุด · เพิ่มได้ทุกจังหวัด</span>
                </div>
                <ul className="space-y-2">
                  {points.map((point) => (
                    <li key={point.id} className="flex items-start gap-2 p-2.5 rounded-xl border border-teal-200 bg-teal-50/50">
                      <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 text-xs">
                        <p className="font-semibold text-slate-800">{point.name}</p>
                        <p className="text-[10px] text-slate-500">{point.province} · {point.lat.toFixed(4)}, {point.lng.toFixed(4)}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`ลบ ${point.name}`}
                        onClick={() => setPoints((prev) => prev.filter((p) => p.id !== point.id))}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>

                {addingPoint ? (
                  <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                    <select
                      value={newPointProvince}
                      aria-label="จังหวัดของจุดนัด"
                      onChange={(event) => {
                        setNewPointProvince(event.target.value);
                        setNewPointPin(provinceCentre(event.target.value));
                      }}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-white text-sm"
                    >
                      {THAI_PROVINCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <MapPinPicker
                      value={newPointPin}
                      onChange={setNewPointPin}
                      landmark={newPointName}
                      onLandmarkChange={setNewPointName}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAddingPoint(false)}>
                        ยกเลิก
                      </Button>
                      <Button
                        size="sm"
                        disabled={newPointName.trim().length < 3 || !newPointPin}
                        onClick={() => {
                          if (!newPointPin) return;
                          if (findContactLeaks(newPointName).length > 0) {
                            setError('ชื่อจุดนัดห้ามมีเบอร์โทรหรือช่องทางติดต่อ');
                            return;
                          }
                          setPoints((prev) => [
                            ...prev,
                            {
                              id: `mp-${Date.now()}`,
                              name: newPointName.trim(),
                              province: newPointProvince,
                              lat: newPointPin.lat,
                              lng: newPointPin.lng,
                            },
                          ]);
                          setNewPointName('');
                          setAddingPoint(false);
                          setError(null);
                        }}
                      >
                        บันทึกจุดนัด
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingPoint(true);
                      setNewPointProvince(province);
                      setNewPointPin(provinceCentre(province));
                    }}
                    className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 border-dashed border-teal-300 text-xs font-bold text-teal-700 hover:bg-teal-50"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่มจุดนัดรับเอง
                  </button>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <CalendarDays className="w-4 h-4 text-teal-600" />
                  วันที่สะดวก *
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map((day) => {
                    const selected = days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setDays((prev) => toggle(prev, day));
                          setError(null);
                        }}
                        className={clsx(
                          'aspect-square rounded-xl text-xs font-bold border transition',
                          selected
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'bg-white border-slate-200 text-slate-500'
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {SLOTS.map((slot) => (
                    <ChoiceChip
                      key={slot}
                      selected={slots.includes(slot)}
                      onClick={() => {
                        setSlots((prev) => toggle(prev, slot));
                        setError(null);
                      }}
                    >
                      {slot}
                    </ChoiceChip>
                  ))}
                </div>
              </section>

              <section className="space-y-3 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between pt-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Truck className="w-4 h-4 text-slate-500" />
                    รับส่งพัสดุ
                  </div>
                  <button
                    type="button"
                    onClick={() => setSupportsParcel((prev) => !prev)}
                    aria-pressed={supportsParcel}
                    aria-label="เปิดรับส่งพัสดุ"
                    className={clsx(
                      'w-10 h-6 rounded-full p-0.5 transition',
                      supportsParcel ? 'bg-teal-600' : 'bg-slate-300'
                    )}
                  >
                    <span
                      className={clsx(
                        'block w-5 h-5 bg-white rounded-full shadow transition',
                        supportsParcel ? 'translate-x-4' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>

                {supportsParcel ? (
                  <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-700">
                      รอบการจัดส่งพัสดุ
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShipMode('AFTER_ACCEPT')}
                        className={clsx(
                          'p-2.5 rounded-xl border text-left text-[11px] transition',
                          shipMode === 'AFTER_ACCEPT'
                            ? 'bg-teal-50 border-teal-400 text-teal-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600'
                        )}
                      >
                        <div>หลังรับออเดอร์</div>
                        <div className="text-[10px] opacity-80">ระบุจำนวนวันส่ง</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShipMode('DAILY')}
                        className={clsx(
                          'p-2.5 rounded-xl border text-left text-[11px] transition',
                          shipMode === 'DAILY'
                            ? 'bg-teal-50 border-teal-400 text-teal-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600'
                        )}
                      >
                        <div>ส่งทุกวัน</div>
                        <div className="text-[10px] opacity-80">จัดส่งรอบรายวัน</div>
                      </button>
                    </div>
                    {shipMode === 'AFTER_ACCEPT' && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <label htmlFor="ship-within-days" className="text-[11px] text-slate-600">
                          จัดส่งภายใน
                        </label>
                        <select
                          id="ship-within-days"
                          value={shipWithinDays}
                          onChange={(e) => setShipWithinDays(Number(e.target.value))}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                        >
                          {[1, 2, 3, 5, 7].map((d) => (
                            <option key={d} value={d}>
                              {d} วันหลังรับออเดอร์
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <p className="flex items-start gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                      <Calculator className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      ระบบคำนวณค่าส่งอัตโนมัติ: เล่มแรก ฿50 · เล่มถัดไป +฿10/เล่ม (รวมในยอดเก็บเงินปลายทาง)
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    ปิดอยู่ · ร้านจะรับเฉพาะนัดรับ เปิดได้ทุกเมื่อ
                  </p>
                )}
              </section>
            </div>
          )}

          {step === 4 &&
            (!editKyc && shop?.kyc ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 space-y-1">
                    <p className="font-bold">ยืนยันตัวตนแล้ว</p>
                    <p>
                      {shop.kyc.firstName} {shop.kyc.lastName}
                    </p>
                    <p>บัตรประชาชน {shop.kyc.nationalIdMasked}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" fullWidth onClick={() => setEditKyc(true)}>
                  แก้ไขข้อมูลยืนยันตัวตน
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  id="kyc-national-id"
                  label="เลขบัตรประจำตัวประชาชน *"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="x-xxxx-xxxxx-xx-x"
                  value={formatThaiId(nationalId)}
                  onChange={(event) => {
                    setNationalId(onlyDigits(event.target.value).slice(0, 13));
                    setError(null);
                  }}
                  error={
                    nationalIdDigits.length === 13 && !isValidThaiId(nationalIdDigits)
                      ? 'เลขบัตรไม่ถูกต้อง ตรวจสอบอีกครั้ง'
                      : undefined
                  }
                  helperText={
                    nationalIdDigits.length === 13 && isValidThaiId(nationalIdDigits)
                      ? '✓ รูปแบบเลขบัตรถูกต้อง'
                      : `${nationalIdDigits.length}/13 หลัก`
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="kyc-first-name"
                    label="ชื่อจริง *"
                    placeholder="ตามบัตรประชาชน"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value);
                      setError(null);
                    }}
                  />
                  <Input
                    id="kyc-last-name"
                    label="นามสกุล *"
                    placeholder="ตามบัตรประชาชน"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kycConsent}
                    onChange={(event) => {
                      setKycConsent(event.target.checked);
                      setError(null);
                    }}
                    className="mt-0.5 w-4 h-4 accent-teal-600"
                  />
                  <span className="text-[11px] text-slate-600 leading-relaxed">
                    ข้าพเจ้ายืนยันว่าข้อมูลเป็นของข้าพเจ้าจริง และยินยอมให้กองดองใช้เพื่อยืนยันตัวตน
                    รวมถึงส่งเลขบัตรประชาชนไปตรวจสอบประวัติกับระบบบัญชีดำภายนอก (Blacklistseller)
                    ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)
                  </span>
                </label>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800 leading-relaxed">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  ผู้ซื้อเห็นแค่ป้าย “ยืนยันตัวตนแล้ว” · เราเก็บเลขบัตรแบบปิดบัง ไม่แสดงชื่อจริงบนหน้าร้าน
                </div>
              </div>
            ))}

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg flex gap-2">
          {step > 2 && (
            <Button variant="outline" size="lg" onClick={goBack} className="shrink-0">
              ย้อนกลับ
            </Button>
          )}
          <Button fullWidth size="lg" isLoading={isSaving} onClick={goNext}>
            {step < 4
              ? 'ถัดไป'
              : isAdminDemoMode
              ? 'ยืนยันตัวตนและเปิดร้าน'
              : shop?.setupComplete
              ? 'บันทึกการแก้ไข'
              : 'ยืนยันตัวตนและเปิดร้าน'}
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

function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'px-3 py-1.5 rounded-full text-[11px] font-semibold border transition',
        selected ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-slate-200 text-slate-600'
      )}
    >
      {selected ? '✓ ' : ''}
      {children}
    </button>
  );
}

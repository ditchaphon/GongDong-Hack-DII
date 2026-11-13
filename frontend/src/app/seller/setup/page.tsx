'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, Toast } from '@/components/ui';
import { NicknameAvatarPicker } from '@/components/v4';
import { useSeller } from '@/hooks/useSeller';
import { useProfile } from '@/hooks/useProfile';
import { useLiff } from '@/hooks/useLiff';
import { useAppMode } from '@/hooks/useAppMode';
import { SELLER_MEETUP_ZONES } from '@/mocks/seller';
import { findContactLeaks } from '@/lib/masking';
import {
  detectPromptPay,
  formatThaiId,
  isValidPersonName,
  isValidThaiId,
  maskPromptPay,
  maskThaiId,
  onlyDigits,
} from '@/lib/kyc';
import {
  UserRound,
  Store,
  Truck,
  FileText,
  Check,
  MapPin,
  CalendarDays,
  ShieldCheck,
  Lock,
} from 'lucide-react';

const SHOP_AVATARS = [
  'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=120',
  'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=120',
  'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=120',
  'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=120',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=120',
];

const DEFAULT_PROFILE_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120';

const DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const SLOTS = ['เช้า 9–12 น.', 'บ่าย 12–16 น.', 'เย็น 16–20 น.'];

const STEPS = [
  { id: 1, title: 'ข้อมูลที่จำเป็น', icon: UserRound },
  { id: 2, title: 'ข้อมูลร้านค้า', icon: Store },
  { id: 3, title: 'ตารางจัดส่ง', icon: Truck },
  { id: 4, title: 'ข้อมูล KYC', icon: FileText },
];

const STEP_HEADINGS: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: 'ข้อมูลที่จำเป็น',
    subtitle: 'ชื่อเล่นและรูปที่ใช้ในกองดอง · ไม่มีเบอร์โทรให้ใครเห็น',
  },
  2: {
    title: 'ตั้งค่าร้านค้าของคุณ',
    subtitle: 'บอกเราเกี่ยวกับร้านของคุณเพื่อให้ผู้ซื้อค้นหาคุณได้',
  },
  3: {
    title: 'ตารางจัดส่ง',
    subtitle: 'วันเวลาที่สะดวกนัดรับหรือส่งพัสดุ ผู้ซื้อจะเห็นก่อนสั่ง',
  },
  4: {
    title: 'ยืนยันตัวตน (KYC)',
    subtitle: 'ใช้ยืนยันว่าเป็นเจ้าของบัญชีพร้อมเพย์ที่รับเงิน · แอดมินเห็นเท่านั้น',
  },
};

export default function ShopSetupWizardPage() {
  const router = useRouter();
  const { user } = useLiff();
  const { setMode } = useAppMode();
  const profile = useProfile();
  const { shop, saveShop, submitKyc } = useSeller();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Step 1 — required account info
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatar, setAvatar] = useState(profile.avatar || user.pictureUrl || DEFAULT_PROFILE_AVATAR);
  const [consent, setConsent] = useState(profile.consent);

  // Step 2 — shop info
  const [shopName, setShopName] = useState(shop?.shopName || '');
  const [description, setDescription] = useState(shop?.description || '');
  const [shopAvatar, setShopAvatar] = useState(shop?.avatar || SHOP_AVATARS[0]);

  // Step 3 — delivery schedule
  const [zones, setZones] = useState<string[]>(
    shop?.meetupZones?.length ? shop.meetupZones : [SELLER_MEETUP_ZONES[0]]
  );
  const [days, setDays] = useState<string[]>(shop?.availableDays ?? ['จ', 'อ', 'พ', 'พฤ', 'ศ']);
  const [slots, setSlots] = useState<string[]>(shop?.availableSlots ?? [SLOTS[1]]);
  const [supportsParcel, setSupportsParcel] = useState(shop?.supportsParcel ?? false);
  const [parcelFee, setParcelFee] = useState(shop?.parcelFee || 40);
  const [shipWithinDays, setShipWithinDays] = useState(shop?.shipWithinDays ?? 2);

  // Step 4 — KYC (raw values live only in this form)
  const [nationalId, setNationalId] = useState('');
  const [firstName, setFirstName] = useState(shop?.kyc?.firstName || '');
  const [lastName, setLastName] = useState(shop?.kyc?.lastName || '');
  const [promptPay, setPromptPay] = useState('');
  const [kycConsent, setKycConsent] = useState(false);
  const [editKyc, setEditKyc] = useState(!shop?.kyc);

  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get('step'));
    if (requested >= 1 && requested <= 4 && shop?.setupComplete) setStep(requested);
  }, [shop?.setupComplete]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const validateStep = (current: number): string | null => {
    if (current === 1) {
      const clean = nickname.trim();
      if (clean.length < 2) return 'ตั้งชื่อเล่นอย่างน้อย 2 ตัวอักษร';
      if (findContactLeaks(clean).length > 0) return 'ชื่อห้ามมีเบอร์โทร ไลน์ หรือช่องทางติดต่อ';
      if (!consent) return 'กรุณายอมรับนโยบาย PDPA ก่อนเปิดร้าน';
    }
    if (current === 2) {
      const clean = shopName.trim();
      if (clean.length < 2) return 'ตั้งชื่อร้านอย่างน้อย 2 ตัวอักษร';
      if (findContactLeaks(clean).length > 0) return 'ชื่อร้านห้ามมีเบอร์โทร ไลน์ หรือช่องทางติดต่อ';
      if (description.trim().length < 10) return 'เขียนรายละเอียดร้านอย่างน้อย 10 ตัวอักษร';
      if (findContactLeaks(description).length > 0)
        return 'รายละเอียดร้านห้ามมีเบอร์โทร ไลน์ หรือช่องทางติดต่อ';
    }
    if (current === 3) {
      if (zones.length === 0) return 'เลือกจุดนัดรับอย่างน้อย 1 จุด';
      if (days.length === 0) return 'เลือกวันที่สะดวกอย่างน้อย 1 วัน';
      if (slots.length === 0) return 'เลือกช่วงเวลาที่สะดวกอย่างน้อย 1 ช่วง';
    }
    if (current === 4 && editKyc) {
      if (!isValidThaiId(nationalId)) return 'เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก ตรวจหลักสุดท้ายไม่ผ่าน)';
      if (!isValidPersonName(firstName)) return 'กรอกชื่อจริงเป็นภาษาไทยหรืออังกฤษ';
      if (!isValidPersonName(lastName)) return 'กรอกนามสกุลเป็นภาษาไทยหรืออังกฤษ';
      if (!detectPromptPay(promptPay))
        return 'พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก';
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
    if (step === 1) {
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

  const finish = () => {
    profile.saveProfile({ nickname: nickname.trim(), avatar, consent });
    saveShop({
      shopName: shopName.trim(),
      description: description.trim(),
      avatar: shopAvatar,
      meetupZones: zones,
      availableDays: days,
      availableSlots: slots,
      supportsParcel,
      parcelFee: supportsParcel ? Number(parcelFee) || 40 : 0,
      shipWithinDays,
    });
    if (editKyc) {
      const type = detectPromptPay(promptPay)!;
      submitKyc({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nationalIdMasked: maskThaiId(nationalId),
        promptPayMasked: maskPromptPay(promptPay),
        promptPayType: type,
        verifiedAt: new Date().toISOString(),
      });
    }
    setNationalId('');
    setPromptPay('');
    setMode('SELLER');
    setToastMessage(shop?.setupComplete ? 'บันทึกข้อมูลร้านแล้ว' : 'เปิดร้านสำเร็จ · ยืนยันตัวตนแล้ว');
    setTimeout(() => router.push('/seller'), 600);
  };

  const heading = STEP_HEADINGS[step];
  const nationalIdDigits = onlyDigits(nationalId);
  const promptPayType = detectPromptPay(promptPay);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title={shop?.setupComplete ? 'แก้ไขข้อมูลร้าน' : 'เปิดร้าน'}
        onBack={goBack}
      />

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

          {step === 1 && (
            <NicknameAvatarPicker
              nickname={nickname}
              onNicknameChange={(value) => {
                setNickname(value);
                setError(null);
              }}
              avatar={avatar}
              onAvatarChange={setAvatar}
              consent={consent}
              onConsentChange={(value) => {
                setConsent(value);
                setError(null);
              }}
            />
          )}

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
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {SHOP_AVATARS.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setShopAvatar(url)}
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
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  จุดนัดรับใน มช. *
                </div>
                <div className="flex flex-wrap gap-2">
                  {SELLER_MEETUP_ZONES.map((zone) => (
                    <ChoiceChip
                      key={zone}
                      selected={zones.includes(zone)}
                      onClick={() => {
                        setZones((prev) => toggle(prev, zone));
                        setError(null);
                      }}
                    >
                      {zone}
                    </ChoiceChip>
                  ))}
                </div>
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
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label htmlFor="shop-parcel-fee" className="text-xs text-slate-600">
                        ค่าส่งเล่มแรก
                      </label>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-xs text-slate-400">฿</span>
                        <input
                          id="shop-parcel-fee"
                          type="number"
                          min={0}
                          value={parcelFee}
                          onChange={(event) => setParcelFee(Number(event.target.value) || 0)}
                          className="w-20 min-h-[38px] px-2 text-sm text-right bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">ส่งของภายใน</span>
                      <div className="flex gap-1.5 ml-auto">
                        {[1, 2, 3].map((n) => (
                          <ChoiceChip
                            key={n}
                            selected={shipWithinDays === n}
                            onClick={() => setShipWithinDays(n)}
                          >
                            {n} วัน
                          </ChoiceChip>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">เล่มถัดไปในร้านเดียวกัน +฿10 ต่อเล่ม</p>
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
                    <p>
                      พร้อมเพย์ ({shop.kyc.promptPayType === 'PHONE' ? 'เบอร์มือถือ' : 'เลขบัตร'}){' '}
                      {shop.kyc.promptPayMasked}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" fullWidth onClick={() => setEditKyc(true)}>
                  เปลี่ยนข้อมูลรับเงิน
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
                <Input
                  id="kyc-promptpay"
                  label="รหัสพร้อมเพย์ *"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="เบอร์มือถือ หรือ เลขบัตรประชาชน"
                  value={promptPay}
                  onChange={(event) => {
                    setPromptPay(onlyDigits(event.target.value).slice(0, 13));
                    setError(null);
                  }}
                  helperText={
                    promptPayType === 'PHONE'
                      ? '✓ พร้อมเพย์แบบเบอร์มือถือ'
                      : promptPayType === 'NATIONAL_ID'
                      ? '✓ พร้อมเพย์แบบเลขบัตรประชาชน'
                      : 'ชื่อบัญชีพร้อมเพย์ต้องตรงกับชื่อ-นามสกุลด้านบน'
                  }
                />
                {nationalIdDigits.length === 13 && (
                  <button
                    type="button"
                    onClick={() => setPromptPay(nationalIdDigits)}
                    className="text-[11px] font-semibold text-teal-700 underline"
                  >
                    ใช้เลขบัตรประชาชนเป็นพร้อมเพย์
                  </button>
                )}

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
                    ข้าพเจ้ายืนยันว่าข้อมูลเป็นของข้าพเจ้าจริง และยินยอมให้กองดองใช้เพื่อยืนยันตัวตนและโอนเงินค่าหนังสือ
                    ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)
                  </span>
                </label>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800 leading-relaxed">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  ผู้ซื้อเห็นแค่ป้าย “ยืนยันตัวตนแล้ว” · เราเก็บเลขบัตรแบบปิดบัง ไม่แสดงชื่อจริงหรือพร้อมเพย์บนหน้าร้าน
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
          {step > 1 && (
            <Button variant="outline" size="lg" onClick={goBack} className="shrink-0">
              ย้อนกลับ
            </Button>
          )}
          <Button fullWidth size="lg" onClick={goNext}>
            {step < 4
              ? 'ถัดไป'
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

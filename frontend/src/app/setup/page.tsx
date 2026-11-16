'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { NicknameAvatarPicker } from '@/components/v4';
import { useProfile } from '@/hooks/useProfile';
import { findContactLeaks } from '@/lib/masking';
import { UserRound, ShieldCheck } from 'lucide-react';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120';

export default function AccountSetupPage() {
  const router = useRouter();
  const { nickname, avatar, consent, isComplete, saveProfile } = useProfile();

  const [next, setNext] = useState<'buy' | 'sell'>('buy');
  const [localNickname, setLocalNickname] = useState(nickname);
  const [localAvatar, setLocalAvatar] = useState(avatar || DEFAULT_AVATAR);
  const [localConsent, setLocalConsent] = useState(consent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get('next') === 'sell' ? 'sell' : 'buy');
  }, []);

  useEffect(() => {
    if (nickname) setLocalNickname(nickname);
    if (avatar) setLocalAvatar(avatar);
    if (consent) setLocalConsent(consent);
  }, [nickname, avatar, consent]);

  const handleSave = async () => {
    const clean = localNickname.trim();
    if (clean.length < 2) {
      setError('ตั้งชื่อเล่นอย่างน้อย 2 ตัวอักษร');
      return;
    }
    const leaks = findContactLeaks(clean);
    if (leaks.length > 0) {
      setError('ชื่อห้ามมีเบอร์โทร ไลน์ หรือช่องทางติดต่อ');
      return;
    }
    if (!localConsent) {
      setError('กรุณายอมรับนโยบาย PDPA ก่อนเริ่มใช้งาน');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveProfile({ nickname: clean, avatar: localAvatar, consent: localConsent });
      setToastMessage('บันทึกโปรไฟล์แล้ว');
      setTimeout(() => {
        router.replace(next === 'sell' ? '/seller' : '/');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกโปรไฟล์ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title="ตั้งโปรไฟล์"
        showBack={isComplete}
        onBack={() => router.back()}
      />

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <UserRound className="w-5 h-5 text-[var(--color-primary-dark)]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              ตั้งชื่อเล่นและรูปก่อนเริ่มใช้
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              ผู้ซื้อและผู้ขายจะเห็นแค่ชื่อเล่นกับรูปนี้
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <NicknameAvatarPicker
            nickname={localNickname}
            onNicknameChange={(value) => {
              setLocalNickname(value);
              setError(null);
            }}
            avatar={localAvatar}
            onAvatarChange={setLocalAvatar}
            consent={localConsent}
            onConsentChange={(value) => {
              setLocalConsent(value);
              setError(null);
            }}
            error={error || undefined}
          />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 leading-relaxed">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            ใช้ชื่อเล่นได้ตามใจ · ถ้าเปิดร้านภายหลัง ชื่อร้านจะแสดงแยกจากชื่อเล่น
            และคุณเลือกเองได้ว่าจะให้ผู้ซื้อเห็นชื่อจริงหรือไม่
          </span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" isLoading={saving} onClick={handleSave}>
            {next === 'sell' ? 'บันทึกและไปเปิดร้าน' : 'บันทึกและเริ่มเลือกซื้อ'}
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

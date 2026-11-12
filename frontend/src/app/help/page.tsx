'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui';
import { useLiff } from '@/hooks/useLiff';
import {
  BookOpen,
  ShieldCheck,
  Coins,
  ChevronDown,
  MessageCircle,
  AlertTriangle,
  Store,
  Search,
} from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'ทำไมไม่เห็นเบอร์โทรผู้ขาย?',
    a: 'กองดองไม่แสดงเบอร์โทรหรือไลน์ของอีกฝ่าย ทุกอย่างคุยในแชทออเดอร์หลังผู้ขายรับคำขอ และระบบจะปิดข้อมูลติดต่อที่พิมพ์มาให้อัตโนมัติ',
  },
  {
    q: 'ขอซื้อแล้วหนังสือจะถูกจองไหม?',
    a: 'ยังไม่จองค่ะ ผู้ซื้อคนอื่นขอเล่มเดียวกันได้ แต่เมื่อผู้ขายกดรับคำขอใด หนังสือจะถูกล็อกและคำขออื่นถูกปฏิเสธอัตโนมัติ',
  },
  {
    q: 'จ่ายเงินอย่างไร ปลอดภัยไหม?',
    a: 'จ่ายผ่านคิวอาร์ในหน้าออเดอร์เท่านั้น เงินโอนตรงเข้าบัญชีผู้ขาย กองดองไม่พักเงิน จึงต้องตรวจชื่อผู้รับก่อนโอนทุกครั้ง และไม่โอนเข้าบัญชีที่ส่งมาทางแชท',
  },
  {
    q: 'รหัสรับของคืออะไร?',
    a: 'รหัส 6 หลักที่ผู้ซื้อเห็นในออเดอร์ ใช้บอกผู้ขายหลังตรวจหนังสือและจ่ายเงินแล้วเท่านั้น ผู้ขายกรอกรหัสเพื่อปิดออเดอร์',
  },
  {
    q: 'เครดิตหักตอนไหน?',
    a: 'ลงขายฟรี · หัก 1 เครดิตเมื่อผู้ขายกดรับออเดอร์ · ปฏิเสธไม่เสียเครดิต · ผู้ใช้ใหม่ได้ 1 เครดิตฟรี',
  },
];

const GRADES = [
  { label: 'เหมือนใหม่', percent: 75, detail: 'ไม่มีตำหนิเลยทั้ง 5 จุด' },
  { label: 'สภาพดีมาก', percent: 60, detail: 'ตำหนิ 1 จุด เล็กน้อย' },
  { label: 'อ่านทั่วไป', percent: 45, detail: 'ตำหนิ 2 จุด หรือมีรอยเปื้อน/รอยเขียน' },
  { label: 'เน้นอ่าน', percent: 30, detail: 'ตำหนิ 3 จุดขึ้นไป หรือหน้า/สันเสียหาย' },
];

const Accordion: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-4 text-left"
      >
        <span className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
          {icon}
        </span>
        <span className="flex-1 text-sm font-bold text-slate-900">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-4 space-y-2.5 text-xs text-slate-600">{children}</div>}
    </div>
  );
};

const Step: React.FC<{ n: number; title: string; detail: string }> = ({ n, title, detail }) => (
  <div className="flex gap-2.5">
    <span className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center justify-center shrink-0">
      {n}
    </span>
    <div>
      <div className="font-semibold text-slate-800">{title}</div>
      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{detail}</p>
    </div>
  </div>
);

export default function HelpPage() {
  const router = useRouter();
  const { openWindow } = useLiff();
  const [faqOpen, setFaqOpen] = useState<string | null>(null);
  const oaId = process.env.NEXT_PUBLIC_LINE_OA_ID || 'gongdong';
  const oaHandle = oaId.startsWith('@') ? oaId : `@${oaId}`;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-28">
      <TopBar title="วิธีใช้งาน & ช่วยเหลือ" />

      <div className="p-4 space-y-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <h1 className="text-base font-black text-slate-900">ยินดีต้อนรับสู่กองดอง</h1>
          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
            ตลาดหนังสือมือสองที่ซื้อขายกันใน LINE · ลงขายฟรี · ไม่มีระบบพักเงิน ·
            คุยและปิดออเดอร์ได้ในแอป
          </p>
        </div>

        <Accordion title="เริ่มต้นใช้งาน" icon={<BookOpen className="w-4 h-4" />}>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-bold text-slate-800 mb-2 inline-flex items-center gap-1">
                <Search className="w-3.5 h-3.5" /> วิธีซื้อ (4 ขั้น)
              </p>
              <div className="space-y-2.5">
                <Step n={1} title="ค้นหาหรือกดการ์ดหนังสือ" detail="ค้นด้วยชื่อ ISBN หรือรายวิชา แล้วดูเกรดและรูปจริง 4 ด้าน" />
                <Step n={2} title="เพิ่มลงตะกร้าและเลือกวิธีรับ" detail="นัดรับใน มช. ฟรี หรือส่งพัสดุ ฿40 + ฿10 ต่อเล่ม" />
                <Step n={3} title="ส่งคำขอซื้อ" detail="คำขอยังไม่ล็อกหนังสือ · ขอซื้อค้างได้สูงสุด 3 รายการ" />
                <Step n={4} title="รอผู้ขายรับ แล้วจ่ายในออเดอร์" detail="จ่ายผ่านคิวอาร์ + แนบสลิป หรือจ่ายหน้างานตอนนัดรับ" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-800 mb-2 inline-flex items-center gap-1">
                <Store className="w-3.5 h-3.5" /> วิธีขาย (4 ขั้น)
              </p>
              <div className="space-y-2.5">
                <Step n={1} title="เปิดร้านและตั้งจุดนัดรับ" detail="ใช้เวลาประมาณ 1 นาที · ได้ 1 เครดิตฟรี" />
                <Step n={2} title="ลงขาย: เล่มเดียวหรือยกชุด" detail="สแกน ISBN หรือกรอกเองถ้าไม่มีบาร์โค้ด" />
                <Step n={3} title="ถ่ายรูป 4 รูป + เช็กสภาพ 5 จุด" detail="ระบบเสนอเกรดและราคาแนะนำให้" />
                <Step n={4} title="รอคำขอ แล้วกดรับ" detail="รับออเดอร์ใช้ 1 เครดิต · ปฏิเสธไม่เสียเครดิต" />
              </div>
            </div>
          </div>
        </Accordion>

        <Accordion title="ซื้อขายอย่างปลอดภัย" icon={<ShieldCheck className="w-4 h-4" />}>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <span>จ่ายผ่านคิวอาร์ในหน้าออเดอร์เท่านั้น · ตรวจชื่อผู้รับให้ตรงกับร้านก่อนกดโอน</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <span>ห้ามโอนเข้าบัญชีที่ส่งมาทางแชท · ระบบปิดเบอร์โทร/ไลน์ที่พิมพ์ในแชทอัตโนมัติ</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <span>บอกรหัสรับของหลังได้หนังสือและจ่ายเงินแล้วเท่านั้น</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600 font-bold">•</span>
              <span>ถ้าของไม่ตรงเกรด ให้แจ้งปัญหาก่อนปิดออเดอร์ · แอดมินช่วยตรวจสอบ</span>
            </li>
          </ul>
          <div className="mt-1 flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            กองดองไม่พักเงินและไม่รับประกันการซื้อขาย · เงินโอนตรงผู้ขาย
            จึงต้องตรวจหนังสือก่อนจ่ายทุกครั้ง
          </div>
        </Accordion>

        <Accordion title="เกรดสภาพหนังสือ" icon={<BookOpen className="w-4 h-4" />}>
          <p className="text-[11px] text-slate-500">
            ผู้ขายตอบคำถาม 5 จุด (ปก · รอยขีดเขียน · คราบน้ำ · หน้าครบ · สันและขอบกระดาษ)
            ระบบคำนวณเกรดและราคาแนะนำจากราคาปก
          </p>
          <div className="space-y-1.5">
            {GRADES.map((grade) => (
              <div
                key={grade.label}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div>
                  <div className="font-semibold text-slate-800">{grade.label}</div>
                  <div className="text-[10px] text-slate-500">{grade.detail}</div>
                </div>
                <span className="text-xs font-bold text-emerald-700">{grade.percent}%</span>
              </div>
            ))}
          </div>
        </Accordion>

        <Accordion title="เครดิต" icon={<Coins className="w-4 h-4" />}>
          <p>ลงขายฟรีเสมอ · ใช้ 1 เครดิตเมื่อกดรับออเดอร์ · ปฏิเสธไม่เสียเครดิต</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: 'Starter', c: 3, p: 20 },
              { name: 'Bookworm', c: 10, p: 50 },
              { name: 'Merchant', c: 25, p: 100 },
            ].map((pack) => (
              <div
                key={pack.name}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center"
              >
                <div className="text-[10px] text-slate-500">{pack.name}</div>
                <div className="text-sm font-black text-slate-800">{pack.c}</div>
                <div className="text-[10px] text-slate-500">฿{pack.p}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">
            เติมเครดิตด้วยคิวอาร์ + สลิป · แอดมินตรวจและเติมให้ภายใน 30 นาที
          </p>
        </Accordion>

        <Accordion title="คำถามที่พบบ่อย" icon={<MessageCircle className="w-4 h-4" />}>
          <div className="space-y-1.5">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFaqOpen((prev) => (prev === faq.q ? null : faq.q))}
                  aria-expanded={faqOpen === faq.q}
                  className="w-full flex items-center justify-between gap-2 p-2.5 text-left"
                >
                  <span className="text-[11px] font-semibold text-slate-800">{faq.q}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                      faqOpen === faq.q ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {faqOpen === faq.q && (
                  <p className="px-2.5 pb-2.5 text-[11px] text-slate-500 leading-relaxed">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Accordion>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">ยังมีคำถาม?</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            แจ้งปัญหาจากออเดอร์เพื่อให้แอดมินเห็นข้อมูลครบ หรือทักทีมงานผ่าน LINE Official Account
          </p>
          <Button
            fullWidth
            variant="outline"
            onClick={() => router.push('/orders')}
            leftIcon={<AlertTriangle className="w-4 h-4" />}
          >
            แจ้งปัญหาจากออเดอร์
          </Button>
          <Button
            fullWidth
            onClick={() => openWindow(`https://line.me/R/ti/p/${oaHandle}`, true)}
            leftIcon={<MessageCircle className="w-4 h-4" />}
          >
            ติดต่อทีมงานทาง LINE
          </Button>
        </div>
      </div>
    </div>
  );
}

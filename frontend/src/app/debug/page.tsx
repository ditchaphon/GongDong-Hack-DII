'use client';

import React from 'react';
import { useLiff } from '@/hooks/useLiff';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Terminal, Shield, RefreshCw } from 'lucide-react';

export default function DebugPage() {
  const {
    isReady,
    isInClient,
    isLoggedIn,
    isMock,
    liffVersion,
    os,
    language,
    idToken,
    user,
    friendship,
    error,
    login,
    logout,
  } = useLiff();

  const maskedUserId = user.lineUserId
    ? `${user.lineUserId.slice(0, 4)}••••••••${user.lineUserId.slice(-4)}`
    : 'N/A';

  const maskedToken = idToken
    ? `${idToken.slice(0, 10)}••••••••${idToken.slice(-10)}`
    : 'None';

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 pb-12">
      <TopBar title="LIFF Diagnostics & Debug" subtitle="/debug (Dev/Staging Only)" />

      <div className="p-4 space-y-4 max-w-[430px] mx-auto w-full">
        {/* Status card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-600" />
              Runtime Environment
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                isMock
                  ? 'bg-amber-100 text-amber-800'
                  : isInClient
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-sky-100 text-sky-800'
              }`}
            >
              {isMock ? 'Mock Mode' : isInClient ? 'LINE Client' : 'External Web'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">LIFF Initialized:</span>
              <span className="font-mono font-semibold text-slate-800">
                {isReady ? 'true ✓' : 'false (loading)'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">isInClient():</span>
              <span className="font-mono font-semibold text-slate-800">
                {String(isInClient)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">isLoggedIn():</span>
              <span className="font-mono font-semibold text-slate-800">
                {String(isLoggedIn)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">OS / Device:</span>
              <span className="font-mono font-semibold text-slate-800">{os}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Language:</span>
              <span className="font-mono font-semibold text-slate-800">{language}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">LIFF SDK Version:</span>
              <span className="font-mono font-semibold text-slate-800">{liffVersion}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">OA Friend Status:</span>
              <span className="font-mono font-semibold text-slate-800">
                {friendship ? 'Friend ✓' : 'Not Friend ⚠️'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">User ID (masked):</span>
              <span className="font-mono font-semibold text-slate-800">{maskedUserId}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">ID Token:</span>
              <span className="font-mono text-[10px] text-slate-500 truncate max-w-[180px]">
                {maskedToken}
              </span>
            </div>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-600" />
            Active Session
          </span>

          <div className="flex items-center gap-3 pt-1">
            {user.pictureUrl && (
              <img
                src={user.pictureUrl}
                alt={user.displayName}
                className="w-12 h-12 rounded-full object-cover border border-slate-200"
              />
            )}
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{user.displayName}</h4>
              <p className="text-xs text-slate-500">
                เครดิต: <span className="font-bold text-[#06C755]">{user.credits} เครดิต</span>
              </p>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            {!isLoggedIn ? (
              <Button fullWidth size="sm" onClick={login}>
                เข้าสู่ระบบด้วย LINE
              </Button>
            ) : (
              <Button fullWidth size="sm" variant="outline" onClick={logout}>
                ออกจากระบบ
              </Button>
            )}
          </div>
        </div>

        {/* Navigation shortcut */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            ← กลับสู่หน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
}


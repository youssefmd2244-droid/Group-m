/**
 * clientZipComponents.tsx — React UI components for ZIP export
 */
// @ts-ignore
import React, { useState } from 'react';
// @ts-ignore
import { Archive, Loader2 } from 'lucide-react';
import type { UserRecord, InstallationRecord } from '../types';
import { downloadUserZip, downloadClientZip } from './clientZipExport';

export function DownloadUserZipButton({ user, systemTitle, logoBase64, size = 'sm' }: {
  user: UserRecord; systemTitle?: string; logoBase64?: string; size?: 'sm' | 'md';
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const isSm = size === 'sm';
  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await downloadUserZip(user, systemTitle, logoBase64);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ في توليد الـ ZIP. حاول مرة أخرى.');
    } finally { setLoading(false); }
  };
  return (
    <button onClick={handleClick} disabled={loading}
      className={`flex items-center gap-1.5 font-bold transition cursor-pointer border disabled:opacity-60
        ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'}
        ${isSm ? 'px-2.5 py-1.5 rounded-xl text-[10px]' : 'px-3 py-2 rounded-xl text-xs'}`}
      title="تحميل ملف العميل الشامل ZIP">
      {loading ? <><Loader2 size={isSm ? 11 : 13} className="animate-spin" /><span>جاري التجهيز...</span></>
        : done ? <><span>✓</span><span>تم!</span></>
        : <><Archive size={isSm ? 11 : 13} /><span>ZIP شامل</span></>}
    </button>
  );
}

interface DownloadZipButtonProps {
  record: InstallationRecord;
  systemTitle?: string;
  logoBase64?: string;
  size?: 'sm' | 'md';
}

export function DownloadZipButton({ record, systemTitle, logoBase64, size = 'md' }: DownloadZipButtonProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [done, setDone] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setDone(false);
    try {
      await downloadClientZip(record, {
        systemTitle,
        logoBase64,
        onProgress: setStep,
      });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error('ZIP export error:', err);
      alert('حدث خطأ أثناء توليد ملف الـ ZIP. يرجى المحاولة مجدداً.');
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  const isSm = size === 'sm';

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="تحميل ملف العميل الشامل (ZIP)"
      className={`
        flex items-center gap-1.5 font-bold transition cursor-pointer border
        disabled:opacity-60 disabled:cursor-wait
        ${done
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
        }
        ${isSm
          ? 'px-2.5 py-1.5 rounded-xl text-[10px]'
          : 'px-3 py-2 rounded-xl text-xs'
        }
      `}
    >
      {loading ? (
        <>
          <Loader2 size={isSm ? 11 : 13} className="animate-spin shrink-0" />
          <span className="truncate max-w-[120px]">{step || 'جاري التجهيز...'}</span>
        </>
      ) : done ? (
        <>
          <span>✓</span>
          <span>تم التحميل!</span>
        </>
      ) : (
        <>
          <Archive size={isSm ? 11 : 13} className="shrink-0" />
          <span>تحميل ملف ZIP الشامل</span>
        </>
      )}
    </button>
  );
}

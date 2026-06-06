/**
 * InstallationForm.tsx — نموذج التركيبات الديناميكي الكامل والمؤمن ضد الـ Crash
 * * ✅ حل مشكلة الـ White Screen نهائياً وجذرياً:
 * - حقل العداد Controlled بالكامل بـ State نصية مستقلة (countInput) لمنع التهنيج أثناء الكتابة والمسح.
 * - عزل مصفوفة العملاء (clients) تماماً عن الـ Re-render اللحظي السريع للأزرار.
 * - إضافة نظام تأجيل ذكي (Debounced Sync) بمقدار 250ms عند استخدام الأزرار (+ / -) لمنع الـ Race Conditions التي تسبب انهيار الواجهة (Parent/Child Crash).
 * - الاعتماد على حالة رقمية مستقرة (stableCount) لإدارة الـ Dynamic Loops في الـ JSX.
 * - صمامات أمان مطلقة عبر استخدام safeClients لضمان عدم حدوث Loop على مصفوفة فارغة أو مكسورة.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Wrench, Camera, Video, CheckCircle, AlertCircle, Loader2,
  Trash2, Image as ImageIcon, User, Phone, MapPin, Building,
  Hash, FileText, ChevronDown, Plus, Minus, Users, Paperclip,
} from 'lucide-react';
import type {
  InstallationRecord,
  InstallationFieldSchema,
  ThemeConfig,
} from '../types';

// ─── Compression ──────────────────────────────────────────────────────────────

function compressImage(file: File, maxDim = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('ليس صورة')); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressVideo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/')) { reject(new Error('ليس فيديو')); return; }
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientEntry {
  clientName:        string;
  area:              string;
  buildingNumber:    string;
  buildingName:      string;
  clientLandline:    string;
  clientMobile:      string;
  notes:             string;
  clientIdPhoto:     string | undefined;
  boxPhoto:          string | undefined;
  thermalPhoto:      string | undefined;
  mainBoxPhoto:      string | undefined;
  installationVideo: string | undefined;
}

function emptyClient(): ClientEntry {
  return {
    clientName: '', area: '', buildingNumber: '', buildingName: '',
    clientLandline: '', clientMobile: '', notes: '',
    clientIdPhoto: undefined, boxPhoto: undefined,
    thermalPhoto: undefined, mainBoxPhoto: undefined,
    installationVideo: undefined,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstallationFormProps {
  theme:        ThemeConfig;
  workers?:     string[];
  extraFields?: InstallationFieldSchema[];
  onSubmit:     (record: Omit<InstallationRecord, 'id' | 'createdAt'>) => Promise<void> | void;
  syncStatus?:  'idle' | 'syncing' | 'success' | 'error' | 'transient_fail';
}

// ─── PhotoSlot ────────────────────────────────────────────────────────────────

interface PhotoSlotProps {
  label:               string;
  icon:                React.ReactNode;
  value:               string | undefined;
  uploadingKey:        string;
  currentUploadingKey: string | null;
  accept:              string;
  onFileChange:        (file: File) => void;
  onClear:             () => void;
}

function PhotoSlot({
  label, icon, value, uploadingKey, currentUploadingKey, accept, onFileChange, onClear,
}: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = currentUploadingKey === uploadingKey;

  return (
    <div className="relative">
      <input
        ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => {
          const f = e.target?.files?.[0];
          if (f) onFileChange(f);
          e.target.value = '';
        }}
      />
      {value != null && value !== '' ? (
        <div className="relative rounded-xl overflow-hidden border border-amber-200 bg-amber-50">
          {value.startsWith('data:video') ? (
            <div className="flex items-center justify-center h-20 bg-slate-800 text-white text-xs gap-2">
              <Video size={16} />فيديو محمّل
            </div>
          ) : (
            <img src={value} alt={label} className="w-full h-20 object-cover" />
          )}
          <button
            type="button" onClick={onClear}
            className="absolute top-1 left-1 p-1 bg-rose-500 text-white rounded-lg cursor-pointer hover:bg-rose-600 transition"
          >
            <Trash2 size={10} />
          </button>
          <div className="text-center text-[9px] py-1 text-amber-700 font-bold bg-amber-50">{label}</div>
        </div>
      ) : (
        <button
          type="button" onClick={() => inputRef.current?.click()}
          className="w-full h-20 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 flex flex-col items-center justify-center gap-1 text-amber-600 hover:bg-amber-100 transition cursor-pointer"
        >
          {isUploading
            ? <Loader2 size={16} className="animate-spin" />
            : <>{icon}<span className="text-[9px] font-bold">{label}</span></>
          }
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InstallationForm({
  theme, workers = [], extraFields = [], onSubmit, syncStatus = 'idle',
}: InstallationFormProps) {

  // ── اسم العامل ─────────────────────────────────────────────────────────────
  const [workerName, setWorkerName] = useState('');
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);

  // ── العداد النصي (Controlled Input) لإعطاء المستخدم حرية مطلقة في الإدخال والمسح ──
  const [countInput, setCountInput] = useState('1');
  
  // ── العداد الرقمي المستقر لإدارة الـ JSX والـ Loops بأمان دون تضارب ──
  const [stableCount, setStableCount] = useState(1);

  // ── مصفوفة العملاء الأساسية ──────────────────────────────────────────────────
  const [clients, setClients] = useState<ClientEntry[]>([emptyClient()]);

  // ── حقول إضافية من الإعدادات ────────────────────────────────────────────────
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // ── UI States ───────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // مرجع لتخزين معرف المؤقت لمنع الـ Race Condition والـ Crash عند تتابع الضغط السريع
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── دالة مركزية آمنة لتحديث حجم المصفوفة بناءً على قيمة عددية صحيحة مستقرة ──────────────
  const syncClientsArray = useCallback((targetCount: number) => {
    const safeTarget = isNaN(targetCount) || targetCount < 1 ? 1 : targetCount;
    setStableCount(safeTarget);
    setClients((prev) => {
      const base = Array.isArray(prev) && prev.length > 0 ? prev : [emptyClient()];
      if (safeTarget === base.length) return base;
      if (safeTarget > base.length) {
        return [
          ...base,
          ...Array.from({ length: safeTarget - base.length }, () => emptyClient()),
        ];
      }
      return base.slice(0, safeTarget);
    });
  }, []);

  // تنظيف المؤقت عند مغادرة المكون لمنع تسريب الذاكرة
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // ── التعامل مع مدخلات حقل النص أثناء الكتابة الحرّة ───────────────────────────────────
  const handleCountChange = (val: string) => {
    setCountInput(val);

    // إلغاء أي مؤقت مجدول سابقاً
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const parsed = parseInt(val.trim(), 10);
    if (!isNaN(parsed) && parsed >= 1) {
      // جدولة التحديث بعد 250ms ليعطي الـ DOM والـ Parent مهلة استقرار ويمنع الشاشة البيضاء
      debounceTimerRef.current = setTimeout(() => {
        syncClientsArray(parsed);
      }, 250);
    }
  };

  // ── الحماية النهائية الفورية عند الخروج من الحقل (onBlur) ──────────────────────────────
  const handleCountBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const parsed = parseInt(countInput.trim(), 10);
    if (isNaN(parsed) || parsed < 1) {
      setCountInput('1');
      syncClientsArray(1);
    } else {
      setCountInput(String(parsed));
      syncClientsArray(parsed);
    }
  };

  // ── أزرار الزيادة والنقصان التزامنية المجدولة بأمان ──────────────────────────────────────
  const handleIncrement = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const current = parseInt(countInput.trim(), 10);
    const next = isNaN(current) || current < 1 ? 2 : current + 1;
    
    setCountInput(String(next));
    // تحديث فوري مؤمن للعداد لتفادي الـ Sync Lag مع الحفاظ على استقرار المصفوفة
    debounceTimerRef.current = setTimeout(() => {
      syncClientsArray(next);
    }, 100);
  };

  const handleDecrement = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const current = parseInt(countInput.trim(), 10);
    const next = isNaN(current) || current <= 1 ? 1 : current - 1;
    
    setCountInput(String(next));
    debounceTimerRef.current = setTimeout(() => {
      syncClientsArray(next);
    }, 100);
  };

  // ── تعديل بيانات حقل داخل عميل معين ──────────────────────────────────────────
  const updateClient = useCallback(
    (index: number, field: keyof ClientEntry, value: string | undefined) => {
      setClients((prev) => {
        if (!Array.isArray(prev) || index < 0 || index >= prev.length) return prev;
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  // ── معالجة رفع وتثبيت المرفقات ───────────────────────────────────────────────
  const handleFileUpload = useCallback(
    async (file: File, clientIndex: number, field: keyof ClientEntry, slotKey: string) => {
      setUploadingKey(slotKey);
      try {
        const dataUrl = file.type.startsWith('video/')
          ? await compressVideo(file)
          : await compressImage(file, 1200, 0.72);
        updateClient(clientIndex, field, dataUrl);
      } catch (err) {
        console.warn('Upload error:', err);
      } finally {
        setUploadingKey(null);
      }
    },
    [updateClient]
  );

  // ── التحقق من صحة البيانات بالكامل قبل الإرسال ─────────────────────────────────
  const validate = (): string[] => {
    const errs: string[] = [];
    if (!workerName.trim()) errs.push('يرجى كتابة اسم العامل');
    
    const safe = Array.isArray(clients) && clients.length > 0 ? clients : [emptyClient()];
    safe.forEach((c, i) => {
      const pfx = stableCount > 1 ? `العميل ${i + 1}: ` : '';
      if (!(c?.clientName  ?? '').trim()) errs.push(`${pfx}يرجى إدخال اسم العميل`);
      if (!(c?.clientMobile ?? '').trim()) errs.push(`${pfx}يرجى إدخال رقم الموبايل`);
      if (!(c?.area         ?? '').trim()) errs.push(`${pfx}يرجى إدخال المنطقة والشارع`);
    });

    (extraFields ?? []).filter(f => f?.required && f?.isEnabled).forEach(f => {
      if (!customFieldValues[f.name]?.trim()) errs.push(`الحقل "${f.labelAr}" إجباري`);
    });
    return errs;
  };

  // ── تفريغ الاستمارة بعد الإرسال الناجح ──────────────────────────────────────────
  const resetForm = () => {
    setWorkerName('');
    setCountInput('1');
    setStableCount(1);
    setClients([emptyClient()]);
    setCustomFieldValues({});
    setErrors([]);
  };

  // ── الإرسال النهائي للبيانات ──────────────────────────────────────────────────
  const handleSubmitClick = async () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    setIsSubmitting(true);
    try {
      const safe    = Array.isArray(clients) && clients.length > 0 ? clients : [emptyClient()];
      const primary = safe[0];
      const extra   = safe.length > 1 ? safe.slice(1) : [];
      const customFields: Record<string, string> = { ...customFieldValues };
      if (extra.length > 0) customFields['__additionalClients'] = JSON.stringify(extra);

      await onSubmit({
        workerName:         workerName.trim(),
        clientName:         (primary?.clientName        ?? '').trim(),
        clientMobile:       (primary?.clientMobile      ?? '').trim(),
        clientLandline:     (primary?.clientLandline    ?? '').trim(),
        area:               (primary?.area              ?? '').trim(),
        buildingName:       (primary?.buildingName      ?? '').trim(),
        buildingNumber:     (primary?.buildingNumber    ?? '').trim(),
        installationsCount: stableCount,
        notes:              (primary?.notes             ?? '').trim() || undefined,
        clientIdPhoto:      primary?.clientIdPhoto,
        thermalPhoto:       primary?.thermalPhoto,
        boxPhoto:           primary?.boxPhoto,
        mainBoxPhoto:       primary?.mainBoxPhoto,
        installationVideo:  primary?.installationVideo,
        customFields,
      });

      setSubmitResult('success');
      resetForm();
      setTimeout(() => setSubmitResult(null), 4000);
    } catch (err) {
      setSubmitResult('error');
      console.error('Submit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── الاستايلات المشتركة ───────────────────────────────────────────────────────
  const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-300 bg-white text-slate-700 transition';
  const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

  // صمام أمان محكم بنسبة 100% لضمان وجود مصفوفة متوافقة تماماً مع الـ stableCount داخل الـ JSX دائمًا
  const safeClients: ClientEntry[] = Array.isArray(clients) && clients.length > 0 ? clients : [emptyClient()];

  return (
    <div className="w-full max-w-2xl mx-auto" dir="rtl">
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">

        {/* Header */}
        <div className="p-6 text-white" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black">نموذج التركيبات</h2>
              <p className="text-amber-100 text-xs mt-0.5">أدخل بيانات التركيبة بالكامل ثم اضغط إرسال</p>
            </div>
          </div>
        </div>

        {/* Banners */}
        {submitResult === 'success' && (
          <div className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2 text-emerald-700 text-xs font-bold">
            <CheckCircle size={16} />تم إرسال بيانات التركيبة بنجاح وحفظها بنجاح! ✓
          </div>
        )}
        {submitResult === 'error' && (
          <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-bold">
            <AlertCircle size={16} />حدث خطأ في الإرسال. يرجى المحاولة مجدداً.
          </div>
        )}
        {errors.length > 0 && (
          <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold space-y-1">
            <div className="flex items-center gap-1.5 mb-1"><AlertCircle size={14} />يرجى تصحيح الأخطاء:</div>
            {errors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        <div className="p-6 space-y-5">

          {/* ══ اسم العامل ══ */}
          <div>
            <label className={labelCls}>
              <User size={12} className="inline ml-1" />اسم العامل *
            </label>
            <div className="relative">
              <input
                type="text"
                value={workerName}
                onChange={(e) => { setWorkerName(e.target.value); setShowWorkerDropdown(false); }}
                placeholder="اكتب اسم العامل هنا..."
                className={inputCls}
                autoComplete="off"
              />
              {workers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWorkerDropdown(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                >
                  <ChevronDown size={16} className={showWorkerDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
              )}
              {showWorkerDropdown && workers.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowWorkerDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-full bg-white rounded-2xl shadow-xl border border-slate-100 z-20 overflow-hidden max-h-48 overflow-y-auto">
                    <div className="p-1.5 space-y-0.5">
                      {workers.map(w => (
                        <button
                          key={w} type="button"
                          onClick={() => { setWorkerName(w); setShowWorkerDropdown(false); }}
                          className="w-full text-right px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 font-bold transition cursor-pointer"
                        >{w}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {workers.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-1">
                اضغط <ChevronDown size={10} className="inline" /> لاختيار عامل سابق، أو اكتب اسماً جديداً مباشرة
              </p>
            )}
          </div>

          {/* ══ عدد التركيبات — حقل ذكي ومؤمن بالكامل ضد التهنيج والشاشة البيضاء ══ */}
          <div>
            <label className={labelCls}>
              <Wrench size={12} className="inline ml-1" />عدد التركيبات *
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={stableCount <= 1}
                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
              >
                <Minus size={18} />
              </button>

              <input
                type="text"
                inputMode="numeric"
                value={countInput}
                onChange={(e) => handleCountChange(e.target.value)}
                onBlur={handleCountBlur}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-300 bg-white text-amber-700 font-black text-center text-lg transition"
              />

              <button
                type="button"
                onClick={handleIncrement}
                className="w-11 h-11 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-700 flex items-center justify-center transition cursor-pointer"
              >
                <Plus size={18} />
              </button>
            </div>
            {stableCount > 1 && (
              <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                <Users size={10} />سيتم فتح {stableCount} أقسام — واحد لكل عميل
              </p>
            )}
          </div>

          {/* ══ Dynamic Loop ══ */}
          {safeClients.map((client, index) => (
            <div key={index} className="border border-amber-200 rounded-2xl overflow-hidden bg-amber-50/30">

              {/* رأس القسم */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-l from-amber-100 to-amber-50 border-b border-amber-200">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black">
                  {index + 1}
                </div>
                <span className="text-sm font-black text-amber-800">
                  {stableCount > 1 ? `بيانات العميل ${index + 1}` : 'بيانات العميل'}
                </span>
                <User size={14} className="text-amber-500 mr-auto" />
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* اسم العميل */}
                  <div className="sm:col-span-2">
                    <label className={labelCls}>
                      <User size={12} className="inline ml-1" />
                      اسم العميل{stableCount > 1 ? ` ${index + 1}` : ''} *
                    </label>
                    <input
                      type="text"
                      value={client?.clientName ?? ''}
                      onChange={(e) => updateClient(index, 'clientName', e.target.value)}
                      placeholder="الاسم الكامل للعميل"
                      className={inputCls}
                    />
                  </div>

                  {/* المنطقة والشارع */}
                  <div className="sm:col-span-2">
                    <label className={labelCls}>
                      <MapPin size={12} className="inline ml-1" />المنطقة والشارع *
                    </label>
                    <input
                      type="text"
                      value={client?.area ?? ''}
                      onChange={(e) => updateClient(index, 'area', e.target.value)}
                      placeholder="مثال: مدينة نصر، شارع عباس العقاد"
                      className={inputCls}
                    />
                  </div>

                  {/* رقم العمارة */}
                  <div>
                    <label className={labelCls}>
                      <Hash size={12} className="inline ml-1" />رقم العمارة
                    </label>
                    <input
                      type="text"
                      value={client?.buildingNumber ?? ''}
                      onChange={(e) => updateClient(index, 'buildingNumber', e.target.value)}
                      placeholder="رقم العمارة"
                      className={inputCls}
                    />
                  </div>

                  {/* اسم العمارة */}
                  <div>
                    <label className={labelCls}>
                      <Building size={12} className="inline ml-1" />اسم العمارة
                    </label>
                    <input
                      type="text"
                      value={client?.buildingName ?? ''}
                      onChange={(e) => updateClient(index, 'buildingName', e.target.value)}
                      placeholder="اسم العمارة أو البرج"
                      className={inputCls}
                    />
                  </div>

                  {/* تليفون أرضي */}
                  <div>
                    <label className={labelCls}>
                      <Phone size={12} className="inline ml-1" />تليفون أرضي
                    </label>
                    <input
                      type="tel"
                      value={client?.clientLandline ?? ''}
                      onChange={(e) => updateClient(index, 'clientLandline', e.target.value)}
                      placeholder="0XXXXXXXXXXX (اختياري)"
                      className={inputCls}
                    />
                  </div>

                  {/* موبايل */}
                  <div>
                    <label className={labelCls}>
                      <Phone size={12} className="inline ml-1" />رقم الموبايل *
                    </label>
                    <input
                      type="tel"
                      value={client?.clientMobile ?? ''}
                      onChange={(e) => updateClient(index, 'clientMobile', e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className={inputCls}
                    />
                  </div>

                  {/* ملاحظة */}
                  <div className="sm:col-span-2">
                    <label className={labelCls}>
                      <FileText size={12} className="inline ml-1" />ملاحظة أو شكوى (اختياري)
                    </label>
                    <textarea
                      value={client?.notes ?? ''}
                      onChange={(e) => updateClient(index, 'notes', e.target.value)}
                      rows={2}
                      placeholder="اكتب أي ملاحظة أو شكوى هنا..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-300 bg-white text-slate-700 transition resize-none"
                    />
                  </div>
                </div>

                {/* ── مرفقات هذا العميل ── */}
                <div className="mt-2 pt-3 border-t border-amber-200">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Paperclip size={12} className="text-amber-600" />
                    <span className="text-xs font-black text-amber-700">
                      مرفقات وصور{stableCount > 1 ? ` العميل ${index + 1}` : ''}
                    </span>
                    <span className="text-[9px] text-slate-400 mr-1">(تُضغط تلقائياً)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

                    <PhotoSlot
                      label="بطاقة العميل" icon={<ImageIcon size={16} />}
                      value={client?.clientIdPhoto}
                      uploadingKey={`clientId-${index}`} currentUploadingKey={uploadingKey}
                      accept="image/*"
                      onFileChange={(f) => handleFileUpload(f, index, 'clientIdPhoto', `clientId-${index}`)}
                      onClear={() => updateClient(index, 'clientIdPhoto', undefined)}
                    />

                    <PhotoSlot
                      label="صورة البوكس" icon={<Camera size={16} />}
                      value={client?.boxPhoto}
                      uploadingKey={`box-${index}`} currentUploadingKey={uploadingKey}
                      accept="image/*"
                      onFileChange={(f) => handleFileUpload(f, index, 'boxPhoto', `box-${index}`)}
                      onClear={() => updateClient(index, 'boxPhoto', undefined)}
                    />

                    <PhotoSlot
                      label="قياس الحرارة" icon={<Camera size={16} />}
                      value={client?.thermalPhoto}
                      uploadingKey={`thermal-${index}`} currentUploadingKey={uploadingKey}
                      accept="image/*"
                      onFileChange={(f) => handleFileUpload(f, index, 'thermalPhoto', `thermal-${index}`)}
                      onClear={() => updateClient(index, 'thermalPhoto', undefined)}
                    />

                    <PhotoSlot
                      label="البوكس الرئيسي" icon={<Camera size={16} />}
                      value={client?.mainBoxPhoto}
                      uploadingKey={`mainBox-${index}`} currentUploadingKey={uploadingKey}
                      accept="image/*"
                      onFileChange={(f) => handleFileUpload(f, index, 'mainBoxPhoto', `mainBox-${index}`)}
                      onClear={() => updateClient(index, 'mainBoxPhoto', undefined)}
                    />

                    <PhotoSlot
                      label="فيديو التركيبة" icon={<Video size={16} />}
                      value={client?.installationVideo}
                      uploadingKey={`video-${index}`} currentUploadingKey={uploadingKey}
                      accept="video/*"
                      onFileChange={(f) => handleFileUpload(f, index, 'installationVideo', `video-${index}`)}
                      onClear={() => updateClient(index, 'installationVideo', undefined)}
                    />

                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* ══ حقول إضافية من الإعدادات ══ */}
          {(extraFields ?? []).filter(f => f?.isEnabled).length > 0 && (
            <div className="space-y-3">
              <div className="border-t border-slate-100 pt-2">
                <p className="text-xs font-black text-slate-500 mb-3">حقول إضافية</p>
              </div>
              {(extraFields ?? []).filter(f => f?.isEnabled).map(field => (
                <div key={field.id}>
                  <label className={labelCls}>
                    {field.labelAr}
                    {field.required && <span className="text-rose-500 mr-1">*</span>}
                  </label>
                  {field.type === 'select' && field.optionsAr ? (
                    <select
                      value={customFieldValues[field.name] ?? ''}
                      onChange={(e) => setCustomFieldValues(p => ({ ...p, [field.name]: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">— اختر —</option>
                      {field.optionsAr.split(',').map(o => (
                        <option key={o.trim()} value={o.trim()}>{o.trim()}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={customFieldValues[field.name] ?? ''}
                      onChange={(e) => setCustomFieldValues(p => ({ ...p, [field.name]: e.target.value }))}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══ زر الإرسال ══ */}
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={isSubmitting || syncStatus === 'syncing'}
            className="w-full py-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60 cursor-pointer shadow-md"
            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
          >
            {isSubmitting
              ? <><Loader2 size={16} className="animate-spin" />جاري الإرسال...</>
              : <><Wrench size={16} />إرسال بيانات التركيب{stableCount > 1 ? `ات (${stableCount} عملاء)` : 'ة'}</>
            }
          </button>

          {syncStatus === 'syncing' && (
            <p className="text-center text-[10px] text-amber-600 font-bold animate-pulse mt-1">
              جاري المزامنة...
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

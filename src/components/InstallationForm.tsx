/**
 * InstallationForm.tsx — نموذج التركيبات العلني الكامل (النسخة المدمجة)
 *
 * ✅ بيانات العامل (قائمة + كتابة حرة)
 * ✅ بيانات العميل الكاملة (6 حقول)
 * ✅ عداد التركيبات
 * ✅ حقول ديناميكية إضافية
 * ✅ 5 مرفقات (4 صور + فيديو) مع ضغط تلقائي بـ Canvas
 * ✅ ملحوظة / شكوى اختيارية
 * ✅ بدون <form> — onClick فقط لمنع الشاشة البيضاء
 * ✅ مربوط بـ GitHub src/data.json عبر onSubmit في App.tsx
 */

import React, { useState, useRef } from 'react';
import {
  Wrench, Camera, Video, CheckCircle, AlertCircle, Loader2,
  Trash2, Image as ImageIcon, User, Phone, MapPin, Building,
  Hash, FileText, X, Plus
} from 'lucide-react';
import type { InstallationRecord, InstallationFieldSchema, ThemeConfig } from './SettingsDashboard';

// ─── Image / Video Compression ───────────────────────────────────────────────

function compressImage(file: File, maxDim = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('ليس صورة')); return; }
    const reader = new FileReader();
    reader.onload = ev => {
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
    reader.onload = ev => resolve(ev.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstallationFormProps {
  theme: ThemeConfig;
  workers?: string[];
  extraFields?: InstallationFieldSchema[];
  onSubmit: (record: Omit<InstallationRecord, 'id' | 'createdAt'>) => Promise<void> | void;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InstallationForm({
  theme,
  workers = [],
  extraFields = [],
  onSubmit,
  syncStatus = 'idle',
}: InstallationFormProps) {

  // ── Worker ─────────────────────────────────────────────────────────────────
  const [workerName,      setWorkerName]      = useState('');
  const [customWorker,    setCustomWorker]    = useState('');
  const [useCustomWorker, setUseCustomWorker] = useState(false);

  // ── Client fields ──────────────────────────────────────────────────────────
  const [clientName,          setClientName]          = useState('');
  const [clientMobile,        setClientMobile]        = useState('');
  const [clientLandline,      setClientLandline]      = useState('');
  const [area,                setArea]                = useState('');
  const [buildingName,        setBuildingName]        = useState('');
  const [buildingNumber,      setBuildingNumber]      = useState('');
  const [installationsCount,  setInstallationsCount]  = useState(1);
  const [notes,               setNotes]               = useState('');
  const [customFieldValues,   setCustomFieldValues]   = useState<{ [k: string]: string }>({});

  // ── Attachments ────────────────────────────────────────────────────────────
  const [clientIdPhoto,     setClientIdPhoto]     = useState<string | undefined>();
  const [thermalPhoto,      setThermalPhoto]      = useState<string | undefined>();
  const [boxPhoto,          setBoxPhoto]          = useState<string | undefined>();
  const [mainBoxPhoto,      setMainBoxPhoto]      = useState<string | undefined>();
  const [installationVideo, setInstallationVideo] = useState<string | undefined>();

  // ── UI State ───────────────────────────────────────────────────────────────
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitResult,  setSubmitResult]  = useState<'success' | 'error' | null>(null);
  const [errors,        setErrors]        = useState<string[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const fileRefs = {
    clientId: useRef<HTMLInputElement>(null),
    thermal:  useRef<HTMLInputElement>(null),
    box:      useRef<HTMLInputElement>(null),
    mainBox:  useRef<HTMLInputElement>(null),
    video:    useRef<HTMLInputElement>(null),
  };

  // ── File upload handler ────────────────────────────────────────────────────

  const handleFileUpload = async (
    file: File,
    slot: keyof typeof fileRefs,
    setter: (v: string) => void
  ) => {
    setUploadingSlot(slot);
    try {
      if (file.type.startsWith('video/')) {
        setter(await compressVideo(file));
      } else {
        setter(await compressImage(file, 1200, 0.72));
      }
    } catch (err) {
      console.warn('Upload error:', err);
    } finally {
      setUploadingSlot(null);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): string[] => {
    const errs: string[] = [];
    const finalWorker = useCustomWorker ? customWorker.trim() : workerName;
    if (!finalWorker)           errs.push('يرجى اختيار اسم العامل أو كتابته');
    if (!clientName.trim())     errs.push('يرجى إدخال اسم العميل');
    if (!clientMobile.trim())   errs.push('يرجى إدخال رقم الموبايل');
    if (!area.trim())           errs.push('يرجى إدخال المنطقة والشارع');
    if (installationsCount < 1) errs.push('عدد التركيبات يجب أن يكون 1 على الأقل');
    extraFields.filter(f => f.required && f.isEnabled).forEach(f => {
      if (!customFieldValues[f.name]?.trim()) errs.push(`الحقل "${f.labelAr}" إجباري`);
    });
    return errs;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmitClick = async () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    const finalWorker = useCustomWorker ? customWorker.trim() : workerName;
    setIsSubmitting(true);
    try {
      await onSubmit({
        workerName:         finalWorker,
        clientName:         clientName.trim(),
        clientMobile:       clientMobile.trim(),
        clientLandline:     clientLandline.trim(),
        area:               area.trim(),
        buildingName:       buildingName.trim(),
        buildingNumber:     buildingNumber.trim(),
        installationsCount,
        notes:              notes.trim() || undefined,
        clientIdPhoto,
        thermalPhoto,
        boxPhoto,
        mainBoxPhoto,
        installationVideo,
        customFields:       customFieldValues,
      });
      setSubmitResult('success');
      // Reset
      setWorkerName(''); setCustomWorker(''); setClientName(''); setClientMobile('');
      setClientLandline(''); setArea(''); setBuildingName(''); setBuildingNumber('');
      setInstallationsCount(1); setNotes(''); setCustomFieldValues({});
      setClientIdPhoto(undefined); setThermalPhoto(undefined); setBoxPhoto(undefined);
      setMainBoxPhoto(undefined); setInstallationVideo(undefined);
      setErrors([]);
      setTimeout(() => setSubmitResult(null), 4000);
    } catch (err) {
      setSubmitResult('error');
      console.error('Submit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-300 bg-white text-slate-700 transition";
  const labelCls = "block text-xs font-bold text-slate-600 mb-1.5";

  // ── PhotoSlot ─────────────────────────────────────────────────────────────

  const PhotoSlot = ({
    label, icon, value, slotKey, refKey, accept, setter, onClear,
  }: {
    label: string; icon: React.ReactNode; value?: string;
    slotKey: string; refKey: keyof typeof fileRefs;
    accept: string; setter: (v: string) => void; onClear: () => void;
  }) => (
    <div className="relative">
      <input
        ref={fileRefs[refKey]}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => {
          const f = e.target?.files?.[0];
          if (f) handleFileUpload(f, refKey, setter);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-amber-200 bg-amber-50">
          {value.startsWith('data:video') ? (
            <div className="flex items-center justify-center h-20 bg-slate-800 text-white text-xs gap-2">
              <Video size={16} />فيديو محمّل
            </div>
          ) : (
            <img src={value} alt={label} className="w-full h-20 object-cover" />
          )}
          <button type="button" onClick={onClear}
            className="absolute top-1 left-1 p-1 bg-rose-500 text-white rounded-lg cursor-pointer hover:bg-rose-600 transition">
            <Trash2 size={10} />
          </button>
          <div className="text-center text-[9px] py-1 text-amber-700 font-bold bg-amber-50">{label}</div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRefs[refKey].current?.click()}
          className="w-full h-20 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 flex flex-col items-center justify-center gap-1 text-amber-600 hover:bg-amber-100 transition cursor-pointer">
          {uploadingSlot === slotKey
            ? <Loader2 size={16} className="animate-spin" />
            : <>{icon}<span className="text-[9px] font-bold">{label}</span></>
          }
        </button>
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

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
            <CheckCircle size={16} />تم إرسال بيانات التركيبة بنجاح وحفظها في GitHub! ✓
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

          {/* Worker Name */}
          <div>
            <label className={labelCls}><User size={12} className="inline ml-1" />اسم العامل *</label>
            {workers.length > 0 && !useCustomWorker ? (
              <div className="flex gap-2">
                <select value={workerName} onChange={e => setWorkerName(e.target.value)} className={`${inputCls} flex-1`}>
                  <option value="">— اختر العامل —</option>
                  {workers.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
                <button type="button" onClick={() => setUseCustomWorker(true)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs cursor-pointer flex items-center gap-1 transition">
                  <Plus size={12} />اسم آخر
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={customWorker} onChange={e => setCustomWorker(e.target.value)}
                  placeholder="اكتب اسم العامل" className={`${inputCls} flex-1`} />
                {workers.length > 0 && (
                  <button type="button" onClick={() => { setUseCustomWorker(false); setCustomWorker(''); }}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs cursor-pointer transition">
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Client section */}
          <div className="border-t border-slate-100 pt-2">
            <p className="text-xs font-black text-slate-500 mb-3">بيانات العميل</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}><User size={12} className="inline ml-1" />اسم العميل *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="الاسم الكامل للعميل" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}><Phone size={12} className="inline ml-1" />موبايل *</label>
              <input value={clientMobile} onChange={e => setClientMobile(e.target.value)} placeholder="01XXXXXXXXX" className={inputCls} type="tel" />
            </div>
            <div>
              <label className={labelCls}><Phone size={12} className="inline ml-1" />تليفون أرضي</label>
              <input value={clientLandline} onChange={e => setClientLandline(e.target.value)} placeholder="0XXXXXXXXXXX (اختياري)" className={inputCls} type="tel" />
            </div>
            <div>
              <label className={labelCls}><MapPin size={12} className="inline ml-1" />المنطقة والشارع *</label>
              <input value={area} onChange={e => setArea(e.target.value)} placeholder="مثال: مدينة نصر، شارع عباس العقاد" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}><Building size={12} className="inline ml-1" />اسم العمارة</label>
              <input value={buildingName} onChange={e => setBuildingName(e.target.value)} placeholder="اسم العمارة أو البرج" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}><Hash size={12} className="inline ml-1" />رقم العمارة</label>
              <input value={buildingNumber} onChange={e => setBuildingNumber(e.target.value)} placeholder="رقم العمارة" className={inputCls} />
            </div>
          </div>

          {/* Installations count */}
          <div>
            <label className={labelCls}><Wrench size={12} className="inline ml-1" />عدد التركيبات *</label>
            <input type="number" value={installationsCount}
              onChange={e => setInstallationsCount(Math.max(0, Number(e.target.value)))}
              min={0} className={`${inputCls} text-center font-black text-lg text-amber-700`} />
          </div>

          {/* Dynamic extra fields */}
          {extraFields.filter(f => f.isEnabled).length > 0 && (
            <div className="space-y-3">
              <div className="border-t border-slate-100 pt-2">
                <p className="text-xs font-black text-slate-500 mb-3">حقول إضافية</p>
              </div>
              {extraFields.filter(f => f.isEnabled).map(field => (
                <div key={field.id}>
                  <label className={labelCls}>
                    {field.labelAr}
                    {field.required && <span className="text-rose-500 mr-1">*</span>}
                  </label>
                  {field.type === 'select' && field.optionsAr ? (
                    <select value={customFieldValues[field.name] || ''}
                      onChange={e => setCustomFieldValues(p => ({ ...p, [field.name]: e.target.value }))}
                      className={inputCls}>
                      <option value="">— اختر —</option>
                      {field.optionsAr.split(',').map(o => (
                        <option key={o.trim()} value={o.trim()}>{o.trim()}</option>
                      ))}
                    </select>
                  ) : (
                    <input type={field.type} value={customFieldValues[field.name] || ''}
                      onChange={e => setCustomFieldValues(p => ({ ...p, [field.name]: e.target.value }))}
                      className={inputCls} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Attachments — 5 slots */}
          <div>
            <div className="border-t border-slate-100 pt-2 mb-3">
              <p className="text-xs font-black text-slate-500">المرفقات والصور</p>
              <p className="text-[10px] text-slate-400 mt-0.5">الصور تُضغط تلقائياً بـ Canvas قبل الحفظ لتقليل حجم الـ Base64</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <PhotoSlot label="بطاقة العميل" icon={<ImageIcon size={16} />} value={clientIdPhoto}
                slotKey="clientId" refKey="clientId" accept="image/*"
                setter={setClientIdPhoto} onClear={() => setClientIdPhoto(undefined)} />
              <PhotoSlot label="قياس الحرارة" icon={<Camera size={16} />} value={thermalPhoto}
                slotKey="thermal" refKey="thermal" accept="image/*"
                setter={setThermalPhoto} onClear={() => setThermalPhoto(undefined)} />
              <PhotoSlot label="صورة البوكس" icon={<Camera size={16} />} value={boxPhoto}
                slotKey="box" refKey="box" accept="image/*"
                setter={setBoxPhoto} onClear={() => setBoxPhoto(undefined)} />
              <PhotoSlot label="البوكس الرئيسي" icon={<Camera size={16} />} value={mainBoxPhoto}
                slotKey="mainBox" refKey="mainBox" accept="image/*"
                setter={setMainBoxPhoto} onClear={() => setMainBoxPhoto(undefined)} />
              <PhotoSlot label="فيديو التركيبة" icon={<Video size={16} />} value={installationVideo}
                slotKey="video" refKey="video" accept="video/*"
                setter={setInstallationVideo} onClear={() => setInstallationVideo(undefined)} />
            </div>
          </div>

          {/* Notes / Complaint */}
          <div>
            <label className={labelCls}><FileText size={12} className="inline ml-1" />ملحوظة أو شكوى (اختياري)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="اكتب أي ملاحظة أو شكوى هنا..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-300 bg-white text-slate-700 transition resize-none" />
          </div>

          {/* Submit — type="button" ONLY, NO <form> */}
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={isSubmitting || syncStatus === 'syncing'}
            className="w-full py-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60 cursor-pointer shadow-md"
            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
          >
            {isSubmitting
              ? <><Loader2 size={16} className="animate-spin" />جاري الإرسال...</>
              : <><Wrench size={16} />إرسال بيانات التركيبة</>
            }
          </button>

          {syncStatus === 'syncing' && (
            <p className="text-center text-[10px] text-amber-600 font-bold animate-pulse mt-1">
              جاري المزامنة مع GitHub...
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

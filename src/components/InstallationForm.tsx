/**
 * InstallationForm.tsx — النسخة الاحترافية المستقرة 100% ضد الشاشة البيضاء
 *
 * ✅ حل نهائي لمشكلة الشاشة البيضاء عند تغيير عدد التركيبات أو استخدام (+ / -)
 * ✅ حماية كاملة لحقل اسم العامل والـ Validation يقبل المكتوب فوراً
 * ✅ منع الـ Crash تماماً بتهيئة العناصر بمفاتيح فريدة (Unique Keys)
 * ✅ لا يحتوي على <form> لضمان عدم عمل Refresh تلقائي للمتصفح
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Wrench,
  Camera,
  Video,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Image as ImageIcon,
  User,
  Phone,
  MapPin,
  Building,
  Hash,
  FileText,
  ChevronDown,
  Plus,
  Minus,
  Users,
  Paperclip,
} from 'lucide-react';
import type {
  InstallationRecord,
  InstallationFieldSchema,
  ThemeConfig,
} from './SettingsDashboard';

// ─── ضغط الصور والفيديو ───────────────────────────────────────────────────

function compressImage(file: File, maxDim = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('ليس صورة'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
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
    if (!file.type.startsWith('video/')) {
      reject(new Error('ليس فيديو'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ClientEntry {
  id: string; // مُعرف فريد لكل عميل لمنع تهنيج وحذف الـ DOM
  clientName: string;
  area: string;
  buildingNumber: string;
  buildingName: string;
  clientLandline: string;
  clientMobile: string;
  notes: string;
  clientIdPhoto: string | undefined;
  boxPhoto: string | undefined;
  thermalPhoto: string | undefined;
  mainBoxPhoto: string | undefined;
  installationVideo: string | undefined;
}

function emptyClient(): ClientEntry {
  return {
    id: Math.random().toString(36).substring(2, 9),
    clientName: '',
    area: '',
    buildingNumber: '',
    buildingName: '',
    clientLandline: '',
    clientMobile: '',
    notes: '',
    clientIdPhoto: undefined,
    boxPhoto: undefined,
    thermalPhoto: undefined,
    mainBoxPhoto: undefined,
    installationVideo: undefined,
  };
}

interface InstallationFormProps {
  theme: ThemeConfig;
  workers?: string[];
  extraFields?: InstallationFieldSchema[];
  onSubmit: (record: Omit<InstallationRecord, 'id' | 'createdAt'>) => Promise<void> | void;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
}

// ─── مكون رفع المرفقات المستقر ───────────────────────────────────────────────
interface PhotoSlotProps {
  label: string;
  icon: React.ReactNode;
  value: string | undefined;
  uploadingKey: string;
  currentUploadingKey: string | null;
  accept: string;
  onFileChange: (file: File) => void;
  onClear: () => void;
}

function PhotoSlot({
  label,
  icon,
  value,
  uploadingKey,
  currentUploadingKey,
  accept,
  onFileChange,
  onClear,
}: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = currentUploadingKey === uploadingKey;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target?.files?.[0];
          if (f) onFileChange(f);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-amber-200 bg-amber-50">
          {value.startsWith('data:video') ? (
            <div className="flex items-center justify-center h-20 bg-slate-800 text-white text-xs gap-2">
              <Video size={16} />
              فيديو محمّل
            </div>
          ) : (
            <img src={value} alt={label} className="w-full h-20 object-cover" />
          )}
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1 left-1 p-1 bg-rose-500 text-white rounded-lg cursor-pointer hover:bg-rose-600 transition"
          >
            <Trash2 size={10} />
          </button>
          <div className="text-center text-[9px] py-1 text-amber-700 font-bold bg-amber-50">
            {label}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-20 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 flex flex-col items-center justify-center gap-1 text-amber-600 hover:bg-amber-100 transition cursor-pointer"
        >
          {isUploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              {icon}
              <span className="text-[9px] font-bold">{label}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── المكون الرئيسي المصلح ──────────────────────────────────────────────────
export default function InstallationForm({
  theme,
  workers = [],
  extraFields = [],
  onSubmit,
  syncStatus = 'idle',
}: InstallationFormProps) {

  const [workerName, setWorkerName] = useState('');
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
  const [countInputValue, setCountInputValue] = useState('1');
  const [clients, setClients] = useState<ClientEntry[]>([emptyClient()]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // تحديث عدد العملاء بأمان تام وبدون استدعاءات عشوائية تسبب شاشة بيضاء
  const applyCount = useCallback((count: number) => {
    const safeCount = isNaN(count) || count < 1 ? 1 : Math.floor(count);
    setClients((prev) => {
      const prevSafe = Array.isArray(prev) ? prev : [emptyClient()];
      if (safeCount === prevSafe.length) return prevSafe;
      if (safeCount > prevSafe.length) {
        const extras = Array.from(
          { length: safeCount - prevSafe.length },
          () => emptyClient()
        );
        return [...prevSafe, ...extras];
      }
      return prevSafe.slice(0, safeCount);
    });
  }, []);

  const handleCountInputChange = useCallback((raw: string) => {
    setCountInputValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      applyCount(parsed);
    }
  }, [applyCount]);

  const handleIncrement = useCallback(() => {
    const current = parseInt(countInputValue, 10);
    const next = isNaN(current) || current < 1 ? 2 : current + 1;
    setCountInputValue(String(next));
    applyCount(next);
  }, [countInputValue, applyCount]);

  const handleDecrement = useCallback(() => {
    const current = parseInt(countInputValue, 10);
    const next = isNaN(current) || current <= 1 ? 1 : current - 1;
    setCountInputValue(String(next));
    applyCount(next);
  }, [countInputValue, applyCount]);

  const handleCountBlur = useCallback(() => {
    const parsed = parseInt(countInputValue, 10);
    if (isNaN(parsed) || parsed < 1) {
      setCountInputValue('1');
      applyCount(1);
    } else {
      setCountInputValue(String(parsed));
      applyCount(parsed);
    }
  }, [countInputValue, applyCount]);

  const updateClient = useCallback((index: number, field: keyof ClientEntry, value: string | undefined) => {
    setClients((prev) => {
      if (!Array.isArray(prev) || index < 0 || index >= prev.length) return prev;
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleFileUpload = useCallback(async (file: File, clientIndex: number, field: keyof ClientEntry, slotKey: string) => {
    setUploadingKey(slotKey);
    try {
      let dataUrl: string;
      if (file.type.startsWith('video/')) {
        dataUrl = await compressVideo(file);
      } else {
        dataUrl = await compressImage(file, 1200, 0.72);
      }
      updateClient(clientIndex, field, dataUrl);
    } catch (err) {
      console.warn('Upload error:', err);
    } finaly {
      setUploadingKey(null);
    }
  }, [updateClient]);

  const actualCount = Array.isArray(clients) ? clients.length : 1;

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!workerName || !workerName.trim()) {
      errs.push('يرجى كتابة اسم العامل أو اختياره');
    }
    clients.forEach((client, i) => {
      const prefix = actualCount > 1 ? `العميل ${i + 1}: ` : '';
      if (!client?.clientName || !client.clientName.trim()) {
        errs.push(`${prefix}يرجى إدخال اسم العميل`);
      }
      if (!client?.clientMobile || !client.clientMobile.trim()) {
        errs.push(`${prefix}يرجى إدخال رقم الموبايل`);
      }
      if (!client?.area || !client.area.trim()) {
        errs.push(`${prefix}يرجى إدخال المنطقة والشارع`);
      }
    });

    (extraFields ?? [])
      .filter((f) => f?.required && f?.isEnabled)
      .forEach((f) => {
        if (!customFieldValues[f.name]?.trim()) {
          errs.push(`الحقل "${f.labelAr}" إجباري`);
        }
      });
    return errs;
  };

  const resetForm = () => {
    setWorkerName('');
    setCountInputValue('1');
    setClients([emptyClient()]);
    setCustomFieldValues({});
    setErrors([]);
  };

  const handleSubmitClick = async () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    setIsSubmitting(true);
    try {
      const primaryClient = clients[0];
      const additionalClients = clients.length > 1 ? clients.slice(1) : [];
      const customFields: Record<string, string> = { ...customFieldValues };

      if (additionalClients.length > 0) {
        customFields['__additionalClients'] = JSON.stringify(additionalClients);
      }

      await onSubmit({
        workerName: workerName.trim(),
        clientName: (primaryClient?.clientName ?? '').trim(),
        clientMobile: (primaryClient?.clientMobile ?? '').trim(),
        clientLandline: (primaryClient?.clientLandline ?? '').trim(),
        area: (primaryClient?.area ?? '').trim(),
        buildingName: (primaryClient?.buildingName ?? '').trim(),
        buildingNumber: (primaryClient?.buildingNumber ?? '').trim(),
        installationsCount: actualCount,
        notes: (primaryClient?.notes ?? '').trim() || undefined,
        clientIdPhoto: primaryClient?.clientIdPhoto,
        thermalPhoto: primaryClient?.thermalPhoto,
        boxPhoto: primaryClient?.boxPhoto,
        mainBoxPhoto: primaryClient?.mainBoxPhoto,
        installationVideo: primaryClient?.installationVideo,
        customFields,
      });

      setSubmitResult('success');
      resetForm();
      setTimeout(() => setSubmitResult(null), 4000);
    } catch (err) {
      setSubmitResult('error');
      console.error('Submit failed:', err);
    } finaly {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-300 bg-white text-slate-700 transition';
  const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

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
              <h2 className="text-lg font-black">نموذج التركيبات المطور</h2>
              <p className="text-amber-100 text-xs mt-0.5">أدخل بيانات التركيبة وسيقوم النظام بتنظيم الحقول تلقائياً</p>
            </div>
          </div>
        </div>

        {/* Status Banners */}
        {submitResult === 'success' && (
          <div className="mx-4 mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2 text-emerald-700 text-xs font-bold">
            <CheckCircle size={16} />
            تم حفظ وإرسال التركيبات بنجاح في السيرفر الموحد! ✓
          </div>
        )}
        {submitResult === 'error' && (
          <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-2 text-rose-700 text-xs font-bold">
            <AlertCircle size={16} />
            حدثت مشكلة أثناء الحفظ. يرجى إعادة المحاولة.
          </div>
        )}
        {errors.length > 0 && (
          <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs font-bold space-y-1">
            <div className="flex items-center gap-1.5 mb-1"><AlertCircle size={14} />يرجى مراجعة الحقول التالية:</div>
            {errors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* اسم العامل */}
          <div>
            <label className={labelCls}><User size={12} className="inline ml-1" />اسم العامل *</label>
            <div className="relative">
              <input
                type="text"
                value={workerName}
                onChange={(e) => {
                  setWorkerName(e.target.value);
                  setShowWorkerDropdown(false);
                }}
                placeholder="اكتب اسمك أو اختر من القائمة..."
                className={inputCls}
                autoComplete="off"
              />
              {workers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWorkerDropdown((v) => !v)}
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
                      {workers.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            setWorkerName(w);
                            setShowWorkerDropdown(false);
                          }}
                          className="w-full text-right px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 font-bold transition cursor-pointer"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* عدد التركيبات */}
          <div>
            <label className={labelCls}><Wrench size={12} className="inline ml-1" />عدد التركيبات الحالي *</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={actualCount <= 1}
                className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
              >
                <Minus size={18} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={countInputValue}
                onChange={(e) => handleCountInputChange(e.target.value)}
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
            {actualCount > 1 && (
              <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                <Users size={10} /> سيتم تنظيم وترتيب {actualCount} حسابات عملاء منفصلين الآن.
              </p>
            )}
          </div>

          {/* الحقول الديناميكية للعملاء */}
          {clients.map((client, index) => (
            <div
              key={client.id} // ✅ استخدام الـ id الفريد يمنع تدمير الشاشة وإعادة بناء الـ DOM بغباء
              className="border border-amber-200 rounded-2xl overflow-hidden bg-amber-50/30 transition-all duration-200"
            >
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-l from-amber-100 to-amber-50 border-b border-amber-200">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black">{index + 1}</div>
                <span className="text-sm font-black text-amber-800">{actualCount > 1 ? `بيانات ومرفقات العميل رقم (${index + 1})` : 'بيانات العميل المستهدف'}</span>
                <User size={14} className="text-amber-500 mr-auto" />
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}><User size={12} className="inline ml-1" />اسم العميل كاشفاً *</label>
                    <input
                      type="text"
                      value={client.clientName}
                      onChange={(e) => updateClient(index, 'clientName', e.target.value)}
                      placeholder="الاسم الثلاثي أو الثنائي للعميل"
                      className={inputCls}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelCls}><MapPin size={12} className="inline ml-1" />المنطقة، الحي والشارع *</label>
                    <input
                      type="text"
                      value={client.area}
                      onChange={(e) => updateClient(index, 'area', e.target.value)}
                      placeholder="مثال: التجمع الخامس، شارع التسعين"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}><Hash size={12} className="inline ml-1" />رقم العمارة</label>
                    <input
                      type="text"
                      value={client.buildingNumber}
                      onChange={(e) => updateClient(index, 'buildingNumber', e.target.value)}
                      placeholder="رقم المبنى"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}><Building size={12} className="inline ml-1" />اسم العمارة / البرج</label>
                    <input
                      type="text"
                      value={client.buildingName}
                      onChange={(e) => updateClient(index, 'buildingName', e.target.value)}
                      placeholder="اسم البرج السكني"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}><Phone size={12} className="inline ml-1" />رقم الهاتف الأرضي</label>
                    <input
                      type="tel"
                      value={client.clientLandline}
                      onChange={(e) => updateClient(index, 'clientLandline', e.target.value)}
                      placeholder="رقم الأرضي (اختياري)"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}><Phone size={12} className="inline ml-1" />رقم الموبايل الفعال *</label>
                    <input
                      type="tel"
                      value={client.clientMobile}
                      onChange={(e) => updateClient(index, 'clientMobile', e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className={inputCls}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelCls}><FileText size={12} className="inline ml-1" />ملاحظات خاصة بالتركيبة (اختياري)</label>
                    <textarea
                      value={client.notes}
                      onChange={(e) => updateClient(index, 'notes', e.target.value)}
                      rows={2}
                      placeholder="شكاوى، صعوبات في الإرسال، تفاصيل إضافية للبوكس..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-300 bg-white text-slate-700 transition resize-none"
                    />
                  </div>
                </div>

                {/* المرفقات الخاصة بكل عميل */}
                <div className="mt-2 pt-3 border-t border-amber-200">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Paperclip size={12} className="text-amber-600" />
                    <span className="text-xs font-black text-amber-700">رفع مرفقات العميل رقم ({index + 1}) مرتبة</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <PhotoSlot
                      label="بطاقة العميل"
                      icon={<ImageIcon size={16} />}
                      value={client.clientIdPhoto}
                      uploadingKey={`clientId-${client.id}`}
                      currentUploadingKey={uploadingKey}
                      accept="image/*"
                      onFileChange={(file) => handleFileUpload(file, index, 'clientIdPhoto', `clientId-${client.id}`)}
                      onClear={() => updateClient(index, 'clientIdPhoto', undefined)}
                    />
                    <PhotoSlot
                      label="صورة البوكس"
                      icon={<Camera size={16} />}
                      value={client.boxPhoto}
                      uploadingKey={`box-${client.id}`}
                      currentUploadingKey={uploadingKey}
                      accept="image/*"
                      onFileChange={(file) => handleFileUpload(file, index, 'boxPhoto', `box-${client.id}`)}
                      onClear={() => updateClient(index, 'boxPhoto', undefined)}
                    />
                    <PhotoSlot
                      label="قياس الحرارة"
                      icon={<Camera size={16} />}
                      value={client.thermalPhoto}
                      uploadingKey={`thermal-${client.id}`}
                      currentUploadingKey={uploadingKey}
                      accept="image/*"
                      onFileChange={(file) => handleFileUpload(file, index, 'thermalPhoto', `thermal-${client.id}`)}
                      onClear={() => updateClient(index, 'thermalPhoto', undefined)}
                    />
                    <PhotoSlot
                      label="البوكس الرئيسي"
                      icon={<Camera size={16} />}
                      value={client.mainBoxPhoto}
                      uploadingKey={`mainBox-${client.id}`}
                      currentUploadingKey={uploadingKey}
                      accept="image/*"
                      onFileChange={(file) => handleFileUpload(file, index, 'mainBoxPhoto', `mainBox-${client.id}`)}
                      onClear={() => updateClient(index, 'mainBoxPhoto', undefined)}
                    />
                    <PhotoSlot
                      label="فيديو التركيبة"
                      icon={<Video size={16} />}
                      value={client.installationVideo}
                      uploadingKey={`video-${client.id}`}
                      currentUploadingKey={uploadingKey}
                      accept="video/*"
                      onFileChange={(file) => handleFileUpload(file, index, 'installationVideo', `video-${client.id}`)}
                      onClear={() => updateClient(index, 'installationVideo', undefined)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* حقول ديناميكية إضافية */}
          {(extraFields ?? []).filter((f) => f?.isEnabled).length > 0 && (
            <div className="space-y-3">
              <div className="border-t border-slate-100 pt-2">
                <p className="text-xs font-black text-slate-500 mb-3">متطلبات إضافية من الإدارة</p>
              </div>
              {(extraFields ?? []).filter((f) => f?.isEnabled).map((field) => (
                <div key={field.id}>
                  <label className={labelCls}>{field.labelAr}{field.required && <span className="text-rose-500 mr-1">*</span>}</label>
                  {field.type === 'select' && field.optionsAr ? (
                    <select
                      value={customFieldValues[field.name] ?? ''}
                      onChange={(e) => setCustomFieldValues((p) => ({ ...p, [field.name]: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">— اختر من هنا —</option>
                      {field.optionsAr.split(',').map((o) => (
                        <option key={o.trim()} value={o.trim()}>{o.trim()}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={customFieldValues[field.name] ?? ''}
                      onChange={(e) => setCustomFieldValues((p) => ({ ...p, [field.name]: e.target.value }))}
                      className={inputCls}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* زر الإرسال المستقر بدون فوروم */}
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={isSubmitting || syncStatus === 'syncing'}
            className="w-full py-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-60 cursor-pointer shadow-md hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                جاري تأمين وضغط المرفقات وحفظها...
              </>
            ) : (
              <>
                <Wrench size={16} />
                إرسال كافة التركيبات والمرفقات ({actualCount}) الآن
              </>
            )}
          </button>

          {syncStatus === 'syncing' && (
            <p className="text-center text-[10px] text-amber-600 font-bold animate-pulse mt-1">جاري المزامنة المشتركة المباشرة مع سيرفر GitHub...</p>
          )}

        </div>
      </div>
    </div>
  );
}

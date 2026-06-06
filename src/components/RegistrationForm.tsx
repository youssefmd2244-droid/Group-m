import React, { useState, useRef } from 'react';
import { UserPlus, Image as ImageIcon, CheckCircle, AlertCircle, Upload, Trash2, Loader2 } from 'lucide-react';
import { UserRecord, ThemeConfig, FormFieldSchema } from '../types';

interface RegistrationFormProps {
  theme: ThemeConfig;
  fieldsSchema?: FormFieldSchema[];
  localizationOverrides?: { [key: string]: string };
  onSubmit: (record: Omit<UserRecord, 'id' | 'createdAt'>) => void;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error' | 'transient_fail';
}

type PhotoSlot = 'personalPhoto' | 'nationalIdFront' | 'nationalIdBack' | 'birthCertificate';

/**
 * Clean helper to compress uploaded image programmatically using a Canvas.
 * Converts to JPEG base64 string at reduced quality (~40-60KB weight) to avoid bloating git histories.
 */
function compressAndConvertImage(file: File, width = 450): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Invalid file type. Please upload images only.'));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = width / img.width;
        canvas.width = width;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Compress with 0.65 JPEG quality
          resolve(canvas.toDataURL('image/jpeg', 0.68));
        } else {
          reject(new Error('Failed to capture canvas 2D contexts'));
        }
      };
      img.onerror = () => reject(new Error('Image decoding crashed'));
    };
    reader.onerror = () => reject(new Error('FileReader stream failed'));
  });
}

export default function RegistrationForm({ 
  theme, 
  fieldsSchema = [],
  localizationOverrides = {},
  onSubmit, 
  syncStatus 
}: RegistrationFormProps) {
  
  // Dynamic Localization text picker
  const getText = (key: string, fallback: string): string => {
    return localizationOverrides?.[key] || fallback;
  };

  // Main UI State managers: holds all input values dynamically
  const [formData, setFormData] = useState<{ [key: string]: string }>(() => {
    const initial: { [key: string]: string } = {
      fullName: '',
      phone: '',
      age: '',
      dob: '',
      streetAddress: '',
      fatherName: '',
      lastName: '',
      schoolOrUniversity: '',
      gender: '',
      nationality: 'مصري / Egyptian',
      maritalStatus: 'أعزب / Single',
      equipmentUsed: '',
      equipmentQuantity: '',
    };
    if (fieldsSchema) {
      fieldsSchema.forEach((f) => {
        if (initial[f.name] === undefined) {
          initial[f.name] = '';
        }
      });
    }
    return initial;
  });

  // Sync state attributes dynamically when schema changes
  React.useEffect(() => {
    setFormData((prev) => {
      const next = { ...prev };
      fieldsSchema.forEach((f) => {
        if (next[f.name] === undefined) {
          let defaultValue = '';
          if (f.name === 'nationality') defaultValue = 'مصري / Egyptian';
          if (f.name === 'maritalStatus') defaultValue = 'أعزب / Single';
          next[f.name] = defaultValue;
        }
      });
      return next;
    });
  }, [fieldsSchema]);

  // Manage individual photo upload slots
  const [photos, setPhotos] = useState<{
    personalPhoto?: string;
    nationalIdFront?: string;
    nationalIdBack?: string;
    birthCertificate?: string;
  }>({});

  const [compressingSlot, setCompressingSlot] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // File Inputs references
  const personalPhotoRef = useRef<HTMLInputElement>(null);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const birthCertRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const processPhotoSlot = async (file: File, slotKey: PhotoSlot) => {
    setCompressingSlot(slotKey);
    setError('');
    try {
      const optimizedBase64 = await compressAndConvertImage(file, 450);
      setPhotos((prev) => ({ ...prev, [slotKey]: optimizedBase64 }));
    } catch (err: any) {
      setError(err?.message || 'فشلت عملية تهيئة الملف وضغط الصورة.');
    } finally {
      setCompressingSlot(null);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, slotKey: PhotoSlot) => {
    if (e.target.files && e.target.files[0]) {
      processPhotoSlot(e.target.files[0], slotKey);
    }
  };

  const handlePhotoDrop = (e: React.DragEvent<HTMLDivElement>, slotKey: PhotoSlot) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processPhotoSlot(e.dataTransfer.files[0], slotKey);
    }
  };

  const removePhotoSlot = (slotKey: PhotoSlot) => {
    setPhotos((prev) => ({ ...prev, [slotKey]: undefined }));
  };

  const validatePhone = (num: string) => {
    const clean = num.replace(/\s+/g, '');
    return clean.length >= 8 && /^[0-9+]+$/.test(clean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Unified dynamic, schema-driven validations
    const activeFields = fieldsSchema.filter(f => f.isEnabled);
    for (const field of activeFields) {
      const val = (formData[field.name] || '').trim();

      // Check if required by the admin config
      if (field.required && !val) {
        setError(`يرجى تعبئة الحقل المطلوب: ${field.labelAr}`);
        return;
      }

      // Format validations
      if (val) {
        if (field.type === 'number') {
          const numVal = parseInt(val);
          if (isNaN(numVal) || numVal < 0) {
            setError(`يرجى إدخال قيمة رقمية صحيحة لحقل: ${field.labelAr}`);
            return;
          }
        }
        if (field.type === 'tel') {
          if (!validatePhone(val)) {
            setError(`يرجى إدخال رقم هاتف صالح لحقل: ${field.labelAr}`);
            return;
          }
        }
      }
    }

    // 2. Strict validations for required photos
    if (!photos.personalPhoto) {
      setError('يرجى إرفاق الصورة الشخصية الرسمية (صورة شخصية)');
      return;
    }
    if (!photos.nationalIdFront) {
      setError('يرجى إرفاق وجه بطاقة الرقم القومي (صورة بطاقة وجه)');
      return;
    }
    if (!photos.nationalIdBack) {
      setError('يرجى إرفاق ظهر بطاقة الرقم القومي (صورة بطاقة ظهر)');
      return;
    }

    try {
      // 3. Map dynamic fields into a structured user record compliant with UserRecord interfaces
      const recordSubmitPayload: Omit<UserRecord, 'id' | 'createdAt'> = {
        fullName: formData.fullName || '',
        phone: formData.phone || '',
        age: parseInt(formData.age) || 0,
        dob: formData.dob || '',
        streetAddress: formData.streetAddress || '',
        fatherName: formData.fatherName || '',
        lastName: formData.lastName || '',
        schoolOrUniversity: formData.schoolOrUniversity || '',
        gender: (formData.gender as 'Male' | 'Female' | '') || '',
        nationality: formData.nationality || '',
        maritalStatus: formData.maritalStatus || '',
        equipmentUsed: formData.equipmentUsed || '',
        equipmentQuantity: formData.equipmentQuantity ? parseInt(formData.equipmentQuantity) : undefined,
        
        idPhoto: photos.personalPhoto || '',
        personalPhoto: photos.personalPhoto,
        nationalIdFront: photos.nationalIdFront,
        nationalIdBack: photos.nationalIdBack,
        birthCertificate: photos.birthCertificate || '',
        
        customFields: {}
      };

      // Populate customFields with any additional admin custom injected fields
      const coreKeys = [
        'fullName', 'phone', 'age', 'dob', 'streetAddress', 'fatherName', 'lastName', 
        'schoolOrUniversity', 'gender', 'nationality', 'maritalStatus', 'equipmentUsed', 'equipmentQuantity'
      ];
      Object.keys(formData).forEach((key) => {
        if (!coreKeys.includes(key)) {
          if (recordSubmitPayload.customFields) {
            recordSubmitPayload.customFields[key] = formData[key] || '';
          }
        }
      });

      // Submit record
      onSubmit(recordSubmitPayload);

      // Show success states & flush local memory inputs
      setSuccess(true);
      
      const resetForm: { [key: string]: string } = {
        fullName: '',
        phone: '',
        age: '',
        dob: '',
        streetAddress: '',
        fatherName: '',
        lastName: '',
        schoolOrUniversity: '',
        gender: '',
        nationality: 'مصري / Egyptian',
        maritalStatus: 'أعزب / Single',
        equipmentUsed: '',
        equipmentQuantity: '',
      };
      
      // Preserve any custom fields with blank value
      fieldsSchema.forEach((f) => {
        if (resetForm[f.name] === undefined) {
          resetForm[f.name] = '';
        }
      });
      
      setFormData(resetForm);
      setPhotos({});

      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (e: any) {
      setError(e.message || 'حدث خطأ غير متوقع أثناء إرسال البيانات.');
    }
  };

  // Helper template for photo drag-box UI
  const renderPhotoUploader = (
    titleAr: string,
    titleEn: string,
    slotKey: PhotoSlot,
    fileInputRef: React.RefObject<HTMLInputElement | null>,
    _isRequired = true
  ) => {
    const photoValue = photos[slotKey];
    const isThisSlotCompressing = compressingSlot === slotKey;

    return (
      <div className="flex flex-col gap-1 text-right" id={`photo-slot-grid-${slotKey}`}>
        <label className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
          <span>{titleAr}</span>
          <span className="text-[9px] font-mono font-normal uppercase text-slate-400">{titleEn}</span>
        </label>
        
        <div
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => handlePhotoDrop(e, slotKey)}
          onClick={() => fileInputRef.current?.click()}
          className={`h-36 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition cursor-pointer relative overflow-hidden bg-slate-50 border-slate-200 hover:bg-slate-100/50 hover:border-slate-300 ${
            photoValue ? 'border-teal-200 bg-teal-50/10' : ''
          }`}
          id={`drop-zone-${slotKey}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handlePhotoSelect(e, slotKey)}
            accept="image/*"
            className="hidden"
            id={`file-input-${slotKey}`}
          />

          {isThisSlotCompressing ? (
            <div className="flex flex-col items-center gap-1.5" id={`loader-${slotKey}`}>
              <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
              <p className="text-[9px] text-slate-500 font-bold">جاري ضغط الصور...</p>
            </div>
          ) : photoValue ? (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-1.5" id={`preview-${slotKey}`}>
              <img
                src={photoValue}
                alt={titleAr}
                className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePhotoSlot(slotKey);
                }}
                className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 p-1.5 rounded-lg text-white shadow-md transition duration-150 cursor-pointer"
                title="حذف الصورة"
                id={`delete-preview-btn-${slotKey}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-2 text-slate-400" id={`placeholder-${slotKey}`}>
              <Upload size={16} className="text-slate-400 mb-1" />
              <p className="text-[10px] font-bold text-slate-600">اسحب أو انقر للرفع</p>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">Drag / Upload</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="w-full rounded-2xl border border-slate-200 shadow-xl overflow-hidden bg-white hover:shadow-2xl transition duration-300"
      id="registration-card"
    >
      {/* Visual Top Custom Header */}
      <div 
        className="px-5 py-4 text-white flex items-center justify-between relative border-b border-slate-100"
        style={{ backgroundColor: theme.primary }}
        id="registration-header-banner"
      >
        <div className="flex flex-col text-right">
          <h2 className="text-sm sm:text-base font-bold font-sans text-white">
            {getText('registrationFormTitle', 'استمارة تسجيل عضوية جديدة')}
          </h2>
          <p className="text-slate-300 text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5">
            Member Enrollment Workspace
          </p>
        </div>
        <span className="bg-white/10 text-white text-[9px] px-2 py-0.5 rounded-lg font-bold border border-white/20">
          OFFLINE-SECURE-SYNC
        </span>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4" dir="rtl" id="registration-form">
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs text-right leading-relaxed" id="form-error-alert">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div>
              <span className="font-bold">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs text-right animate-pulse" id="form-success-alert">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
            <div>
              <span className="font-bold">
                {getText('successMessageAr', 'تم حفظ استمارة التسجيل بنجاح في قاعدة البيانات المحلية!')}
              </span>
              {syncStatus === 'syncing' && <p className="text-[10px] text-emerald-600 mt-0.5 font-sans">جاري المزامنة التلقائية مع مستودع GitHub في الخلفية...</p>}
              {syncStatus === 'success' && <p className="text-[10px] text-emerald-600 mt-0.5 font-sans">تمت المزامنة بنجاح مع السيرفر السحابي!</p>}
              {(syncStatus === 'error' || syncStatus === 'transient_fail') && <p className="text-[10px] text-amber-600 mt-0.5 font-sans">تم الحفظ محلياً بنجاح (فشلت مزامنة GitHub المؤقتة، يمكنك تعديلها من الإعدادات).</p>}
            </div>
          </div>
        )}

        {/* --- Phase 1: High Density Main Text Fields --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="main-inputs-block">
          
          {fieldsSchema.filter(field => field.isEnabled).map((field) => {
            const isFullWidth = field.name === 'streetAddress';
            return (
              <div 
                key={field.id} 
                className={`flex flex-col gap-1 ${isFullWidth ? 'sm:col-span-2' : 'sm:col-span-1'}`} 
                id={`input-group-${field.name}`}
              >
                <label className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
                  <span>{field.labelAr}</span>
                  <span className="text-[9px] font-mono font-normal uppercase text-slate-400">{field.labelEn}</span>
                </label>

                {field.type === 'select' ? (
                  <select
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none text-xs focus:bg-white focus:border-slate-800 transition text-slate-800 bg-white"
                    id={`input-${field.name}`}
                  >
                    <option value="">اختر...</option>
                    {(field.optionsAr || '').split(',').map((opt, idx) => {
                      const trimmed = opt.trim();
                      return <option key={idx} value={trimmed}>{trimmed}</option>;
                    })}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleInputChange}
                    placeholder={field.placeholderAr || ''}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none text-xs focus:bg-white focus:border-slate-800 transition text-slate-800"
                    id={`input-${field.name}`}
                    style={field.type === 'tel' ? { direction: 'ltr' } : undefined}
                  />
                )}
              </div>
            );
          })}

        </div>

        {/* --- Phase 2: Beautiful Multi-Photo Upload Interface (2x2 Grid) --- */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-black text-slate-700 mb-3 text-right">المرفقات والوثائق المطلوبة (الحد الأقصى 4 صور):</h3>
          
          <div className="grid grid-cols-2 gap-4" id="photo-upload-grid">
            {renderPhotoUploader('1. صورة شخصية', 'Personal Photo', 'personalPhoto', personalPhotoRef, true)}
            {renderPhotoUploader('2. بطاقة الهوية (وجه)', 'National ID Front', 'nationalIdFront', idFrontRef, true)}
            {renderPhotoUploader('3. بطاقة الهوية (ظهر)', 'National ID Back', 'nationalIdBack', idBackRef, true)}
            {renderPhotoUploader('4. شهادة الميلاد/أخرى', 'Birth Cert', 'birthCertificate', birthCertRef, false)}
          </div>
        </div>

        {/* Submit action */}
        <div className="pt-4" id="submit-btn-container">
          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl text-white text-xs font-bold transition-all duration-200 shadow-md flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 text-center cursor-pointer uppercase tracking-wider hover:shadow-lg animate-pulse"
            style={{ backgroundColor: theme.accent || '#14b8a6' }}
            id="register-submit-btn"
          >
            <UserPlus size={15} />
            <span>{getText('submitButtonText', 'إرسال استمارة التسجيل والمزامنة | SUBMIT REGISTRATION')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

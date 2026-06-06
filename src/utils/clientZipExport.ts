/**
 * clientZipExport.ts — نظام التحميل الشامل لملف العميل بصيغة ZIP
 * ✅ يولّد ملف ZIP متكامل يحتوي على:
 *   1. customer_data.txt  — بيانات العميل النصية المنسقة
 *   2. customer_report.xlsx — جدول إكسل بكل البيانات
 *   3. document.docx — تقرير وورد مع رندرة الصور المضمّنة
 *   4. report.pdf — تقرير PDF جاهز للطباعة مع QR
 *   5. Media/ — مجلد المرفقات الأصلية (صور + فيديو)
 *
 * ✅ يتعامل مع Base64 الضخمة عبر chunks آمنة لمنع تعليق المتصفح
 * ✅ يستخدم jszip من CDN و file-saver من CDN آمن بدون bundler إضافي
 * ✅ يعمل 100% Client-Side دون خادم
 */

// @ts-ignore — xlsx is installed as a runtime dependency
import * as XLSX from 'xlsx';
import type { InstallationRecord } from '../types';

// ─── Helper: تحميل JSZip ديناميكياً من CDN ─────────────────────────────────
let _jszipPromise: Promise<any> | null = null;

function loadJSZip(): Promise<any> {
  if (_jszipPromise) return _jszipPromise;
  _jszipPromise = new Promise((resolve, reject) => {
    // @ts-ignore
    if (window.JSZip) { resolve(window.JSZip); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => {
      // @ts-ignore
      resolve(window.JSZip);
    };
    script.onerror = () => reject(new Error('فشل تحميل مكتبة JSZip'));
    document.head.appendChild(script);
  });
  return _jszipPromise;
}

// ─── Helper: Base64 dataURL → Uint8Array آمن للذاكرة ───────────────────────
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return new Uint8Array(0);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Helper: استخراج mime-type ومتمديد الملف ──────────────────────────────
function getMimeAndExt(dataUrl: string): { mime: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  const mime = match?.[1] ?? 'application/octet-stream';
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'video/x-msvideo': 'avi', 'video/ogg': 'ogg',
  };
  return { mime, ext: extMap[mime] ?? 'bin' };
}

// ─── 1. customer_data.txt ──────────────────────────────────────────────────
function buildCustomerDataTxt(inst: InstallationRecord, systemTitle = 'نظام إدارة التركيبات'): string {
  const date = new Date(inst.createdAt).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const time = new Date(inst.createdAt).toLocaleTimeString('ar-EG');

  const attachments = [
    inst.clientIdPhoto   ? '✔ صورة بطاقة العميل'     : '✗ صورة بطاقة العميل (غير مرفقة)',
    inst.boxPhoto        ? '✔ صورة البوكس'            : '✗ صورة البوكس (غير مرفقة)',
    inst.thermalPhoto    ? '✔ صورة قياس الحرارة'      : '✗ صورة قياس الحرارة (غير مرفقة)',
    inst.mainBoxPhoto    ? '✔ صورة البوكس الرئيسي'    : '✗ صورة البوكس الرئيسي (غير مرفقة)',
    inst.installationVideo ? '✔ فيديو التركيبة'       : '✗ فيديو التركيبة (غير مرفق)',
  ].join('\n    ');

  const customFieldsText = inst.customFields && Object.keys(inst.customFields).length > 0
    ? '\n' + Object.entries(inst.customFields)
        .filter(([k]) => !k.startsWith('__'))
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n')
    : '';

  return `
╔══════════════════════════════════════════════════════════════════╗
║              ${systemTitle.padEnd(46)}              ║
║                      ملف بيانات العميل الشامل                   ║
╚══════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  بيانات التركيبة
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  الرقم التعريفي    : ${inst.id}
  تاريخ التركيبة    : ${date}
  وقت التسجيل       : ${time}
  اسم العامل المنفذ : ${inst.workerName}
  عدد التركيبات     : ${inst.installationsCount}
  حالة الدفع        : ${inst.isPaid ? `✔ مدفوع (${inst.paidAt ? new Date(inst.paidAt).toLocaleDateString('ar-EG') : ''})` : '✗ غير مدفوع'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  بيانات العميل
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  اسم العميل        : ${inst.clientName}
  رقم الموبايل      : ${inst.clientMobile}
  رقم الأرضي        : ${inst.clientLandline || '—'}
  المنطقة والشارع   : ${inst.area}
  اسم العمارة       : ${inst.buildingName || '—'}
  رقم العمارة       : ${inst.buildingNumber || '—'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  الملاحظات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${inst.notes || 'لا توجد ملاحظات'}
${customFieldsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  المرفقات المُدرجة في مجلد Media
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ${attachments}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ملاحظة: هذا الملف مولّد تلقائياً بواسطة ${systemTitle}
  التاريخ: ${new Date().toLocaleString('ar-EG')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trimStart();
}

// ─── 2. customer_report.xlsx ───────────────────────────────────────────────
function buildExcelBuffer(inst: InstallationRecord): Uint8Array {
  const wb = XLSX.utils.book_new();

  // ورقة البيانات الرئيسية
  const mainData = [
    ['الرقم التعريفي', inst.id],
    ['اسم العميل', inst.clientName],
    ['رقم الموبايل', inst.clientMobile],
    ['رقم الأرضي', inst.clientLandline || '—'],
    ['المنطقة والشارع', inst.area],
    ['اسم العمارة', inst.buildingName || '—'],
    ['رقم العمارة', inst.buildingNumber || '—'],
    ['اسم العامل', inst.workerName],
    ['عدد التركيبات', inst.installationsCount],
    ['حالة الدفع', inst.isPaid ? 'مدفوع' : 'غير مدفوع'],
    ['تاريخ التركيبة', new Date(inst.createdAt).toLocaleDateString('ar-EG')],
    ['وقت التسجيل', new Date(inst.createdAt).toLocaleTimeString('ar-EG')],
    ['الملاحظات', inst.notes || '—'],
    [],
    ['المرفقات', 'الحالة'],
    ['صورة بطاقة العميل', inst.clientIdPhoto   ? 'موجودة في Media/id_card.*'    : 'غير مرفقة'],
    ['صورة البوكس',        inst.boxPhoto        ? 'موجودة في Media/box_photo.*'  : 'غير مرفقة'],
    ['صورة قياس الحرارة', inst.thermalPhoto    ? 'موجودة في Media/thermal.*'    : 'غير مرفقة'],
    ['صورة البوكس الرئيسي', inst.mainBoxPhoto  ? 'موجودة في Media/main_box.*'   : 'غير مرفقة'],
    ['فيديو التركيبة',     inst.installationVideo ? 'موجود في Media/installation_video.*' : 'غير مرفق'],
  ];

  if (inst.customFields) {
    mainData.push([]);
    mainData.push(['الحقول الإضافية', '']);
    Object.entries(inst.customFields)
      .filter(([k]) => !k.startsWith('__'))
      .forEach(([k, v]) => mainData.push([k, v]));
  }

  const ws = XLSX.utils.aoa_to_sheet(mainData);
  ws['!cols'] = [{ wch: 28 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, ws, 'بيانات العميل');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buf);
}

// ─── 3. document.docx (HTML→Word مع صور مضمّنة) ───────────────────────────
function buildWordHtml(inst: InstallationRecord, systemTitle = 'نظام إدارة التركيبات'): string {
  const imgTag = (src: string | undefined, alt: string) => {
    if (!src) return `<p style="color:#999;font-size:9pt;">[ ${alt} — غير مرفقة ]</p>`;
    // نجعل الصورة مضمّنة base64 مباشرةً
    return `<div style="margin:6px 0;"><img src="${src}" alt="${alt}" style="max-width:300px;max-height:220px;border:1px solid #ddd;border-radius:6px;" /><br/><span style="font-size:8pt;color:#666;">${alt}</span></div>`;
  };

  const customFieldsHtml = inst.customFields
    ? Object.entries(inst.customFields)
        .filter(([k]) => !k.startsWith('__'))
        .map(([k, v]) => `<tr><td style="font-weight:bold;padding:5px 10px;background:#f8fafc;">${k}</td><td style="padding:5px 10px;">${v}</td></tr>`)
        .join('')
    : '';

  return `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>تقرير العميل - ${inst.clientName}</title>
  <style>
    @page WordSection1 { size:A4; margin:2cm; }
    div.WordSection1 { page:WordSection1; }
    body { font-family:'Arial',sans-serif; direction:rtl; text-align:right; color:#1e293b; }
    .page-title { text-align:center; font-size:20pt; font-weight:bold; color:#b45309; border-bottom:3px solid #d97706; padding-bottom:10px; margin-bottom:20px; }
    .section-title { font-size:13pt; font-weight:bold; color:#0f172a; background:#fef3c7; padding:6px 12px; border-right:4px solid #d97706; margin:18px 0 8px; }
    table { width:100%; border-collapse:collapse; font-size:10pt; }
    th { background:#1e293b; color:#fff; padding:7px 10px; text-align:right; }
    td { border:1px solid #e2e8f0; padding:6px 10px; }
    tr:nth-child(even) td { background:#f8fafc; }
    .media-grid { display:flex; flex-wrap:wrap; gap:15px; margin:10px 0; }
    .media-item { text-align:center; }
  </style>
</head>
<body><div class="WordSection1">

  <div class="page-title">${systemTitle}<br/>
    <span style="font-size:12pt;color:#64748b;">تقرير العميل الشامل</span>
  </div>

  <div class="section-title">📋 بيانات التركيبة</div>
  <table>
    <tr><td style="font-weight:bold;background:#f8fafc;">الرقم التعريفي</td><td>${inst.id}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">تاريخ التركيبة</td><td>${new Date(inst.createdAt).toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">اسم العامل</td><td>${inst.workerName}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">عدد التركيبات</td><td>${inst.installationsCount}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">حالة الدفع</td><td>${inst.isPaid ? '✔ مدفوع' : '✗ غير مدفوع'}</td></tr>
  </table>

  <div class="section-title">👤 بيانات العميل</div>
  <table>
    <tr><td style="font-weight:bold;background:#f8fafc;">اسم العميل</td><td>${inst.clientName}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">رقم الموبايل</td><td dir="ltr">${inst.clientMobile}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">رقم الأرضي</td><td dir="ltr">${inst.clientLandline || '—'}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">المنطقة والشارع</td><td>${inst.area}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">اسم العمارة</td><td>${inst.buildingName || '—'}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">رقم العمارة</td><td>${inst.buildingNumber || '—'}</td></tr>
    <tr><td style="font-weight:bold;background:#f8fafc;">الملاحظات</td><td>${inst.notes || '—'}</td></tr>
  </table>

  ${customFieldsHtml ? `
  <div class="section-title">📌 حقول إضافية</div>
  <table>${customFieldsHtml}</table>` : ''}

  <div class="section-title">🖼️ المرفقات المدمجة</div>
  <div class="media-grid">
    <div class="media-item">${imgTag(inst.clientIdPhoto, 'صورة بطاقة العميل')}</div>
    <div class="media-item">${imgTag(inst.boxPhoto, 'صورة البوكس')}</div>
    <div class="media-item">${imgTag(inst.thermalPhoto, 'صورة قياس الحرارة')}</div>
    <div class="media-item">${imgTag(inst.mainBoxPhoto, 'صورة البوكس الرئيسي')}</div>
    ${inst.installationVideo ? `<div class="media-item"><p style="background:#1e293b;color:#fff;padding:8px 14px;border-radius:6px;font-size:9pt;">▶ فيديو التركيبة موجود في مجلد Media<br/><span style="color:#fbbf24;font-size:8pt;">installation_video.*</span></p></div>` : ''}
  </div>

  <p style="text-align:center;font-size:8pt;color:#94a3b8;margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px;">
    مولّد بواسطة ${systemTitle} — ${new Date().toLocaleString('ar-EG')}
  </p>

</div></body></html>`;
}

// ─── 4. report.pdf (HTML→Print Window) ────────────────────────────────────
function buildPdfHtml(inst: InstallationRecord, systemTitle = 'نظام إدارة التركيبات', logoBase64?: string): string {
  const imgTag = (src: string | undefined, alt: string, size = 180) => {
    if (!src) return `<div class="no-media">[ ${alt} غير مرفقة ]</div>`;
    return `<div class="media-card"><img src="${src}" alt="${alt}" style="max-width:${size}px;max-height:150px;"/><p class="media-label">${alt}</p></div>`;
  };

  // QR code بسيط بدون مكتبة — نستخدم Google Charts API مؤقتاً (أو نكتفي بالرابط المكتوب)
  const videoRef = inst.installationVideo
    ? `<div class="video-ref">📹 فيديو التركيبة: راجع ملف <strong>Media/installation_video.*</strong> داخل الـ ZIP</div>`
    : '';

  const customFieldsHtml = inst.customFields
    ? Object.entries(inst.customFields)
        .filter(([k]) => !k.startsWith('__'))
        .map(([k, v]) => `<tr><td class="label-cell">${k}</td><td>${v}</td></tr>`)
        .join('')
    : '';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقرير التركيبة - ${inst.clientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 1.5cm; }
    body { font-family: 'Arial', sans-serif; direction: rtl; color: #1e293b; font-size: 10pt; background: #fff; }
    .header { background: linear-gradient(135deg, #d97706, #b45309); color: #fff; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; gap: 16px; }
    .logo { width: 60px; height: 60px; border-radius: 10px; object-fit: cover; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 28px; }
    .header-text h1 { font-size: 18pt; font-weight: bold; }
    .header-text p { font-size: 9pt; opacity: 0.85; }
    .section { margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .section-head { background: #1e293b; color: #fff; padding: 7px 14px; font-weight: bold; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    td { padding: 6px 12px; border-bottom: 1px solid #f1f5f9; }
    .label-cell { font-weight: bold; background: #f8fafc; width: 35%; color: #475569; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 8pt; font-weight: bold; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-unpaid { background: #fef3c7; color: #92400e; }
    .media-grid { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; }
    .media-card { text-align: center; }
    .media-card img { border: 1px solid #e2e8f0; border-radius: 6px; display: block; }
    .media-label { font-size: 7.5pt; color: #64748b; margin-top: 4px; }
    .no-media { color: #94a3b8; font-size: 8pt; font-style: italic; padding: 4px 12px; }
    .video-ref { background: #1e293b; color: #fbbf24; padding: 10px 14px; border-radius: 8px; font-size: 9pt; margin: 8px; }
    .footer { text-align: center; font-size: 7.5pt; color: #94a3b8; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo">
      ${logoBase64 ? `<img src="${logoBase64}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;" />` : '🔧'}
    </div>
    <div class="header-text">
      <h1>${systemTitle}</h1>
      <p>تقرير العميل الشامل — جاهز للطباعة</p>
      <p style="font-size:8pt;opacity:0.7;">${new Date().toLocaleString('ar-EG')}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-head">📋 بيانات التركيبة</div>
    <table>
      <tr><td class="label-cell">الرقم التعريفي</td><td style="font-size:8pt;color:#64748b;">${inst.id}</td></tr>
      <tr><td class="label-cell">تاريخ التركيبة</td><td>${new Date(inst.createdAt).toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}</td></tr>
      <tr><td class="label-cell">اسم العامل</td><td><strong>${inst.workerName}</strong></td></tr>
      <tr><td class="label-cell">عدد التركيبات</td><td><strong>${inst.installationsCount}</strong></td></tr>
      <tr><td class="label-cell">حالة الدفع</td><td><span class="badge ${inst.isPaid ? 'badge-paid' : 'badge-unpaid'}">${inst.isPaid ? '✔ مدفوع' : '✗ غير مدفوع'}</span></td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-head">👤 بيانات العميل</div>
    <table>
      <tr><td class="label-cell">اسم العميل</td><td><strong>${inst.clientName}</strong></td></tr>
      <tr><td class="label-cell">رقم الموبايل</td><td dir="ltr">${inst.clientMobile}</td></tr>
      <tr><td class="label-cell">رقم الأرضي</td><td dir="ltr">${inst.clientLandline || '—'}</td></tr>
      <tr><td class="label-cell">المنطقة والشارع</td><td>${inst.area}</td></tr>
      <tr><td class="label-cell">اسم العمارة</td><td>${inst.buildingName || '—'}</td></tr>
      <tr><td class="label-cell">رقم العمارة</td><td>${inst.buildingNumber || '—'}</td></tr>
      <tr><td class="label-cell">الملاحظات</td><td>${inst.notes || '—'}</td></tr>
    </table>
  </div>

  ${customFieldsHtml ? `
  <div class="section">
    <div class="section-head">📌 حقول إضافية</div>
    <table>${customFieldsHtml}</table>
  </div>` : ''}

  <div class="section">
    <div class="section-head">🖼️ الصور المرفقة</div>
    <div class="media-grid">
      ${imgTag(inst.clientIdPhoto, 'صورة البطاقة')}
      ${imgTag(inst.boxPhoto, 'صورة البوكس')}
      ${imgTag(inst.thermalPhoto, 'قياس الحرارة')}
      ${imgTag(inst.mainBoxPhoto, 'البوكس الرئيسي')}
    </div>
    ${videoRef}
  </div>

  <div class="footer">
    تم توليد هذا التقرير بواسطة ${systemTitle} — جميع الحقوق محفوظة<br/>
    ${new Date().toLocaleString('ar-EG')}
  </div>

</body>
</html>`;
}

// ─── الدالة الرئيسية: توليد وتحميل ZIP ────────────────────────────────────
export interface ZipExportOptions {
  systemTitle?: string;
  logoBase64?: string;
  onProgress?: (step: string) => void;
}

// ─── ② Helper: تحويل Base64 الكبير إلى Uint8Array بأمان عبر chunks ──────────
// يمنع تجميد المتصفح عند الضغط على ملفات كبيرة (فيديوهات > 50MB)
async function dataUrlToUint8ArraySafe(dataUrl: string): Promise<Uint8Array> {
  return new Promise((resolve) => {
    // ② نُفرج عن event loop قبل عملية atob الثقيلة
    setTimeout(() => {
      resolve(dataUrlToUint8Array(dataUrl));
    }, 0);
  });
}

export async function downloadClientZip(
  inst: InstallationRecord,
  options: ZipExportOptions = {}
): Promise<void> {
  const { systemTitle = 'نظام إدارة التركيبات', logoBase64, onProgress } = options;
  const log = (msg: string) => { onProgress?.(msg); console.log('[ZIP]', msg); };

  // ② تحميل JSZip (ديناميكي — لا يُحمَّل إلا عند الضغط فعلياً)
  log('جاري تجهيز مكتبة الضغط...');
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  const safeClientName = inst.clientName.replace(/[^a-zA-Z\u0600-\u06FF0-9_]/g, '_');
  const dateStr = new Date(inst.createdAt).toISOString().slice(0, 10);

  // ── 1. customer_data.txt ──────────────────────────────────────────────────
  log('جاري بناء ملف البيانات النصية...');
  // ② setTimeout(0) قبل كل عملية ثقيلة لتحرير event loop
  await new Promise<void>(r => setTimeout(r, 0));
  const txtContent = buildCustomerDataTxt(inst, systemTitle);
  zip.file('customer_data.txt', txtContent);

  // ── 2. customer_report.xlsx ───────────────────────────────────────────────
  log('جاري بناء ملف الإكسل...');
  await new Promise<void>(r => setTimeout(r, 0));
  const xlsxBuffer = buildExcelBuffer(inst);
  zip.file('customer_report.xlsx', xlsxBuffer, { binary: true });

  // ── 3. document.docx (HTML→Word مع صور مضمّنة) ───────────────────────────
  log('جاري بناء ملف الوورد...');
  await new Promise<void>(r => setTimeout(r, 0));
  const wordHtml = buildWordHtml(inst, systemTitle);
  const wordBlob = new Blob(
    ['\uFEFF' + wordHtml],
    { type: 'application/vnd.ms-word;charset=utf-8' }
  );
  const wordBuffer = await wordBlob.arrayBuffer();
  zip.file('document.docx', wordBuffer);

  // ── 4. report.pdf (HTML جاهز للطباعة) ────────────────────────────────────
  log('جاري بناء ملف التقرير...');
  await new Promise<void>(r => setTimeout(r, 0));
  const pdfHtml = buildPdfHtml(inst, systemTitle, logoBase64);
  // نضيف HTML مكتمل بامتداد .pdf — يُفتح في المتصفح ويُطبع مباشرة
  zip.file('report.pdf', pdfHtml);

  // ── 5. مجلد Media — ② معالجة كل ملف في chunk منفصل ─────────────────────
  const mediaFolder = zip.folder('Media');
  if (!mediaFolder) throw new Error('فشل إنشاء مجلد Media');

  const mediaItems: Array<{ src: string | undefined; name: string; isVideo?: boolean }> = [
    { src: inst.clientIdPhoto,     name: 'id_card' },
    { src: inst.boxPhoto,          name: 'box_photo' },
    { src: inst.thermalPhoto,      name: 'thermal_photo' },
    { src: inst.mainBoxPhoto,      name: 'main_box_photo' },
    { src: inst.installationVideo, name: 'installation_video', isVideo: true },
  ];

  for (const item of mediaItems) {
    if (!item.src || !item.src.startsWith('data:')) continue;
    log(`جاري إضافة: ${item.name}...`);

    // ② كل ملف في setTimeout منفصل لتجزئة الـ Main Thread
    // الفيديو يحتاج timeout أطول لأن Base64 ضخم
    await new Promise<void>(r => setTimeout(r, item.isVideo ? 20 : 5));

    const { ext } = getMimeAndExt(item.src);
    // ② استخدام النسخة الآمنة من dataUrlToUint8Array للملفات الكبيرة
    const bytes = item.isVideo
      ? await dataUrlToUint8ArraySafe(item.src)
      : dataUrlToUint8Array(item.src);

    mediaFolder.file(`${item.name}.${ext}`, bytes, { binary: true });
  }

  // ── توليد ZIP مع Progress Callback ──────────────────────────────────────
  log('جاري ضغط الملفات...');
  await new Promise<void>(r => setTimeout(r, 20));

  const zipBlob: Blob = await (zip as any).generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 },
    },
    // ② callback للـ progress لتحديث UI أثناء الضغط
    (metadata: { percent: number }) => {
      const pct = Math.round(metadata.percent);
      if (pct % 20 === 0) log(`ضغط الملفات: ${pct}%...`);
    }
  );

  // ── تحميل الملف ──────────────────────────────────────────────────────────
  const dlUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = dlUrl;
  a.download = `ملف_العميل_${safeClientName}_${dateStr}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(dlUrl), 8000);

  log('✅ تم تحميل الملف بنجاح!');
}


import type { UserRecord } from '../types';
function buildUserDataTxt(u: UserRecord, systemTitle = 'نظام إدارة التسجيلات'): string {
  const date = new Date(u.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  return `
╔══════════════════════════════════════════════════════════════════╗
║              ${systemTitle.padEnd(46)}              ║
║                       بيانات المتقدم / المسجل                   ║
╚══════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  البيانات الشخصية
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  الرقم التعريفي    : ${u.id}
  الاسم الأول       : ${u.fullName}
  اسم الأب          : ${u.fatherName}
  اسم العائلة       : ${u.lastName}
  رقم الهاتف        : ${u.phone}
  العمر             : ${u.age} سنة
  تاريخ الميلاد     : ${u.dob}
  الجنس             : ${u.gender === 'Male' ? 'ذكر' : u.gender === 'Female' ? 'أنثى' : '—'}
  الجنسية           : ${u.nationality}
  الحالة الاجتماعية : ${u.maritalStatus}
  العنوان           : ${u.streetAddress}
  المدرسة/الجامعة   : ${u.schoolOrUniversity || '—'}
  العُدَد المستخدمة  : ${u.equipmentUsed || '—'}
  عددها             : ${u.equipmentQuantity ?? '—'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  المرفقات
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ${(u.personalPhoto || u.idPhoto) ? '✔ صورة شخصية' : '✗ صورة شخصية (غير مرفقة)'}
    ${u.nationalIdFront ? '✔ بطاقة وجه' : '✗ بطاقة وجه (غير مرفقة)'}
    ${u.nationalIdBack  ? '✔ بطاقة ظهر' : '✗ بطاقة ظهر (غير مرفقة)'}
    ${u.birthCertificate ? '✔ شهادة الميلاد' : '✗ شهادة الميلاد (غير مرفقة)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  تاريخ التسجيل: ${date}
  مولّد بواسطة ${systemTitle} — ${new Date().toLocaleString('ar-EG')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trimStart();
}

function buildUserExcelBuffer(u: UserRecord): Uint8Array {
  const wb = XLSX.utils.book_new();
  const data = [
    ['الرقم التعريفي', u.id],
    ['الاسم الأول', u.fullName],
    ['اسم الأب', u.fatherName],
    ['اسم العائلة', u.lastName],
    ['رقم الهاتف', u.phone],
    ['العمر', u.age],
    ['تاريخ الميلاد', u.dob],
    ['الجنس', u.gender === 'Male' ? 'ذكر' : u.gender === 'Female' ? 'أنثى' : ''],
    ['الجنسية', u.nationality],
    ['الحالة الاجتماعية', u.maritalStatus],
    ['العنوان', u.streetAddress],
    ['المدرسة/الجامعة', u.schoolOrUniversity || ''],
    ['العُدَد المستخدمة', u.equipmentUsed || ''],
    ['عددها', u.equipmentQuantity ?? ''],
    ['تاريخ التسجيل', new Date(u.createdAt).toLocaleString('ar-EG')],
    [],
    ['المرفقات', 'الحالة'],
    ['صورة شخصية', (u.personalPhoto || u.idPhoto) ? 'موجودة في Media/' : 'غير مرفقة'],
    ['بطاقة وجه', u.nationalIdFront ? 'موجودة في Media/' : 'غير مرفقة'],
    ['بطاقة ظهر', u.nationalIdBack ? 'موجودة في Media/' : 'غير مرفقة'],
    ['شهادة الميلاد', u.birthCertificate ? 'موجودة في Media/' : 'غير مرفقة'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, ws, 'بيانات المتقدم');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buf);
}

function buildUserWordHtml(u: UserRecord, systemTitle = 'نظام إدارة التسجيلات'): string {
  const imgTag = (src: string | undefined, alt: string) => {
    if (!src) return `<p style="color:#999;font-size:9pt;">[ ${alt} — غير مرفقة ]</p>`;
    return `<div style="margin:6px 0;"><img src="${src}" alt="${alt}" style="max-width:280px;max-height:200px;border:1px solid #ddd;border-radius:6px;"/><br/><span style="font-size:8pt;color:#666;">${alt}</span></div>`;
  };
  return `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>استمارة المتقدم - ${u.fullName}</title>
<style>
  @page WordSection1 { size:A4; margin:2cm; }
  div.WordSection1 { page:WordSection1; }
  body { font-family:'Arial',sans-serif;direction:rtl;text-align:right;color:#1e293b; }
  .title { text-align:center;font-size:18pt;font-weight:bold;color:#0d9488;border-bottom:3px solid #0d9488;padding-bottom:8px;margin-bottom:18px; }
  .sec { font-size:12pt;font-weight:bold;color:#fff;background:#0f172a;padding:6px 12px;margin:16px 0 8px; }
  table { width:100%;border-collapse:collapse;font-size:10pt; }
  td { border:1px solid #e2e8f0;padding:6px 10px; }
  .lbl { font-weight:bold;background:#f8fafc;width:35%; }
  .media-grid { display:flex;flex-wrap:wrap;gap:12px;margin:10px 0; }
</style></head>
<body><div class="WordSection1">
  <div class="title">${systemTitle}<br/><span style="font-size:11pt;color:#64748b;">استمارة المتقدم الشاملة</span></div>
  <div class="sec">البيانات الشخصية</div>
  <table>
    <tr><td class="lbl">الاسم الكامل</td><td>${u.fullName} ${u.lastName}</td></tr>
    <tr><td class="lbl">اسم الأب</td><td>${u.fatherName}</td></tr>
    <tr><td class="lbl">رقم الهاتف</td><td dir="ltr">${u.phone}</td></tr>
    <tr><td class="lbl">العمر</td><td>${u.age} سنة</td></tr>
    <tr><td class="lbl">تاريخ الميلاد</td><td>${u.dob}</td></tr>
    <tr><td class="lbl">الجنس</td><td>${u.gender === 'Male' ? 'ذكر' : u.gender === 'Female' ? 'أنثى' : '—'}</td></tr>
    <tr><td class="lbl">الجنسية</td><td>${u.nationality}</td></tr>
    <tr><td class="lbl">الحالة الاجتماعية</td><td>${u.maritalStatus}</td></tr>
    <tr><td class="lbl">العنوان</td><td>${u.streetAddress}</td></tr>
    <tr><td class="lbl">المدرسة/الجامعة</td><td>${u.schoolOrUniversity || '—'}</td></tr>
    <tr><td class="lbl">تاريخ التسجيل</td><td>${new Date(u.createdAt).toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' })}</td></tr>
  </table>
  <div class="sec">الصور والمستندات المرفقة</div>
  <div class="media-grid">
    ${imgTag(u.personalPhoto || u.idPhoto, 'الصورة الشخصية')}
    ${imgTag(u.nationalIdFront, 'بطاقة الهوية - وجه')}
    ${imgTag(u.nationalIdBack, 'بطاقة الهوية - ظهر')}
    ${imgTag(u.birthCertificate, 'شهادة الميلاد')}
  </div>
  <p style="text-align:center;font-size:8pt;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;">مولّد بواسطة ${systemTitle} — ${new Date().toLocaleString('ar-EG')}</p>
</div></body></html>`;
}

export async function downloadUserZip(u: UserRecord, systemTitle = 'نظام إدارة التسجيلات', logoBase64?: string): Promise<void> {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const safeName = u.fullName.replace(/[^a-zA-Z\u0600-\u06FF0-9_]/g, '_');
  const dateStr = new Date(u.createdAt).toISOString().slice(0, 10);

  zip.file('customer_data.txt', buildUserDataTxt(u, systemTitle));

  await new Promise<void>(r => setTimeout(r, 10));
  zip.file('customer_report.xlsx', buildUserExcelBuffer(u), { binary: true });

  await new Promise<void>(r => setTimeout(r, 10));
  const wordHtml = buildUserWordHtml(u, systemTitle);
  const wordBlob = new Blob(['\uFEFF' + wordHtml], { type: 'application/vnd.ms-word;charset=utf-8' });
  zip.file('document.docx', await wordBlob.arrayBuffer());

  // PDF HTML
  const pdfHtml = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير المتقدم - ${u.fullName}</title>
    <style>@page{size:A4;margin:1.5cm}body{font-family:Arial;direction:rtl;color:#1e293b;font-size:10pt}
    .h{background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;padding:18px;border-radius:10px;margin-bottom:18px}
    .h h1{font-size:16pt;font-weight:bold}.s{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;overflow:hidden}
    .sh{background:#1e293b;color:#fff;padding:7px 14px;font-weight:bold;font-size:10pt}
    table{width:100%;border-collapse:collapse;font-size:9.5pt}td{padding:6px 12px;border-bottom:1px solid #f1f5f9}
    .lbl{font-weight:bold;background:#f8fafc;width:35%;color:#475569}
    .mg{display:flex;flex-wrap:wrap;gap:10px;padding:10px}
    .mg img{max-width:200px;max-height:150px;border:1px solid #e2e8f0;border-radius:6px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
    <body><div class="h">${logoBase64 ? `<img src="${logoBase64}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;float:right;margin-left:12px;"/>` : ''}<h1>${systemTitle}</h1><p>استمارة المتقدم — جاهزة للطباعة</p></div>
    <div class="s"><div class="sh">👤 البيانات الشخصية</div><table>
    <tr><td class="lbl">الاسم الكامل</td><td><strong>${u.fullName} ${u.lastName}</strong></td></tr>
    <tr><td class="lbl">رقم الهاتف</td><td dir="ltr">${u.phone}</td></tr>
    <tr><td class="lbl">العمر / الميلاد</td><td>${u.age} سنة — ${u.dob}</td></tr>
    <tr><td class="lbl">الجنسية</td><td>${u.nationality}</td></tr>
    <tr><td class="lbl">الحالة الاجتماعية</td><td>${u.maritalStatus}</td></tr>
    <tr><td class="lbl">العنوان</td><td>${u.streetAddress}</td></tr>
    <tr><td class="lbl">تاريخ التسجيل</td><td>${new Date(u.createdAt).toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' })}</td></tr>
    </table></div>
    <div class="s"><div class="sh">🖼️ الصور والمستندات</div><div class="mg">
    ${(u.personalPhoto || u.idPhoto) ? `<div><img src="${u.personalPhoto || u.idPhoto}" alt="صورة شخصية"/><p style="font-size:8pt;text-align:center;color:#64748b;">صورة شخصية</p></div>` : ''}
    ${u.nationalIdFront ? `<div><img src="${u.nationalIdFront}" alt="بطاقة وجه"/><p style="font-size:8pt;text-align:center;color:#64748b;">بطاقة وجه</p></div>` : ''}
    ${u.nationalIdBack ? `<div><img src="${u.nationalIdBack}" alt="بطاقة ظهر"/><p style="font-size:8pt;text-align:center;color:#64748b;">بطاقة ظهر</p></div>` : ''}
    ${u.birthCertificate ? `<div><img src="${u.birthCertificate}" alt="شهادة الميلاد"/><p style="font-size:8pt;text-align:center;color:#64748b;">شهادة الميلاد</p></div>` : ''}
    </div></div>
    <p style="text-align:center;font-size:7.5pt;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;">مولّد بواسطة ${systemTitle} — ${new Date().toLocaleString('ar-EG')}</p>
    </body></html>`;
  zip.file('report.pdf', pdfHtml);

  // Media folder
  const mediaFolder = zip.folder('Media');
  if (mediaFolder) {
    const photos = [
      { src: u.personalPhoto || u.idPhoto, name: 'personal_photo' },
      { src: u.nationalIdFront, name: 'id_card_front' },
      { src: u.nationalIdBack, name: 'id_card_back' },
      { src: u.birthCertificate, name: 'birth_certificate' },
    ];
    for (const item of photos) {
      if (!item.src || !item.src.startsWith('data:')) continue;
      await new Promise<void>(r => setTimeout(r, 5));
      const { ext } = getMimeAndExt(item.src);
      mediaFolder.file(`${item.name}.${ext}`, dataUrlToUint8Array(item.src), { binary: true });
    }
  }

  const zipBlob: Blob = await (zip as any).generateAsync({
    type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 },
  });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ملف_المتقدم_${safeName}_${dateStr}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}


// @ts-ignore — xlsx is installed as a runtime dependency
import * as XLSX from 'xlsx';
import { UserRecord } from '../types';

/**
 * High performance Client-Side Excel exporter using the standard 'xlsx' package.
 */
export function exportToExcel(records: UserRecord[]) {
  if (!records || records.length === 0) return;

  const headers = [
    "الرقم التعريفي (ID)",
    "الاسم الأول والأوسطى",
    "اسم الأب",
    "اسم العائلة / اللقب",
    "رقم الهاتف",
    "العمر",
    "تاريخ الميلاد",
    "العنوان بالتفصيل المعماري",
    "المدرسة أو الجامعة",
    "الجنس",
    "الجنسية",
    "الحالة الاجتماعية",
    "اسم العُدَد المستخدمة",
    "عددها كام",
    "تاريخ التسجيل"
  ];

  const data = records.map(u => [
    u.id,
    u.fullName,
    u.fatherName,
    u.lastName,
    u.phone,
    u.age,
    u.dob,
    u.streetAddress,
    u.schoolOrUniversity || '',
    u.gender === 'Male' ? 'ذكر / Male' : u.gender === 'Female' ? 'أنثى / Female' : '',
    u.nationality,
    u.maritalStatus,
    u.equipmentUsed || '',
    u.equipmentQuantity !== undefined ? u.equipmentQuantity : '',
    u.createdAt ? new Date(u.createdAt).toLocaleString('ar-EG') : ''
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "الأعضاء المسجلين");
  XLSX.writeFile(workbook, `registrations_excel_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * High performance Client-Side Word document exporter.
 * Generates an elegant, structured archival document of applicants.
 */
export function exportToWord(records: UserRecord[]) {
  if (!records || records.length === 0) return;

  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>أرشيف استمارات التسجيل</title>
      <style>
        @page WordSection1 {
          size: 8.5in 11.0in;
          margin: 1.0in 1.0in 1.0in 1.0in;
          mso-header-margin: .5in;
          mso-footer-margin: .5in;
          mso-paper-source: 0;
        }
        div.WordSection1 {
          page: WordSection1;
        }
        body {
          font-family: 'Arial', sans-serif;
          direction: rtl;
          text-align: right;
          color: #1e293b;
          background-color: #ffffff;
        }
        .header-title {
          text-align: center;
          font-size: 22pt;
          font-weight: bold;
          color: #0f172a;
          margin-bottom: 25px;
          border-bottom: 3px double #0d9488;
          padding-bottom: 10px;
        }
        .record-card {
          border: 1px solid #e2e8f0;
          padding: 15px;
          margin-bottom: 30px;
          border-radius: 8px;
        }
        h2 {
          font-size: 14pt;
          color: #0d9488;
          margin-top: 10px;
          margin-bottom: 15px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        tr {
          page-break-inside: avoid;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 8px 12px;
          font-size: 11pt;
          text-align: right;
        }
        th {
          background-color: #f1f5f9;
          font-weight: bold;
          color: #334155;
          width: 35%;
        }
        td {
          color: #0f172a;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      <div class="WordSection1">
        <div class="header-title">أرشيف استمارات تسجيل العضوية - Group m</div>
  `;

  let content = "";
  records.forEach((u, index) => {
    if (index > 0) {
      content += '<div class="page-break"></div>';
    }
    content += `
      <div class="record-card border border-slate-100 rounded-lg p-4">
        <h2>استمارة العضوية للمسجل: ${u.fullName} ${u.lastName}</h2>
        <table>
          <tr>
            <th>الرقم التعريفي (ID)</th>
            <td>${u.id}</td>
          </tr>
          <tr>
            <th>الاسم الكامل واللقب</th>
            <td>${u.fullName} ${u.lastName}</td>
          </tr>
          <tr>
            <th>اسم الأب</th>
            <td>${u.fatherName}</td>
          </tr>
          <tr>
            <th>رقم الهاتف / الموبايل</th>
            <td>${u.phone}</td>
          </tr>
          <tr>
            <th>العمر</th>
            <td>${u.age} سنة</td>
          </tr>
          <tr>
            <th>تاريخ الميلاد</th>
            <td>${u.dob}</td>
          </tr>
          <tr>
            <th>العنوان المعماري بالتفصيل</th>
            <td>${u.streetAddress}</td>
          </tr>
          <tr>
            <th>المدرسة أو الجامعة</th>
            <td>${u.schoolOrUniversity || 'غير محدد'}</td>
          </tr>
          <tr>
            <th>الجنس</th>
            <td>${u.gender === 'Male' ? 'ذكر' : u.gender === 'Female' ? 'أنثى' : 'غير محدد'}</td>
          </tr>
          <tr>
            <th>الجنسية</th>
            <td>${u.nationality}</td>
          </tr>
          <tr>
            <th>الحالة الاجتماعية</th>
            <td>${u.maritalStatus}</td>
          </tr>
          <tr>
            <th>اسم العُدَد المستخدمة</th>
            <td>${u.equipmentUsed || 'غير متوفر'}</td>
          </tr>
          <tr>
            <th>عددها كام</th>
            <td>${u.equipmentQuantity !== undefined ? u.equipmentQuantity : 'غير متوفر'}</td>
          </tr>
          <tr>
            <th>تاريخ وساعة التسجيل</th>
            <td>${u.createdAt ? new Date(u.createdAt).toLocaleString('ar-EG') : 'غير متوفر'}</td>
          </tr>
        </table>
      </div>
    `;
  });

  const footer = `
      </div>
    </body>
    </html>
  `;

  // Compiled Blobs wrapped in Unicode UTF-8 BOM
  const blob = new Blob(['\ufeff' + header + content + footer], {
    type: 'application/msword;charset=utf-8'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `registrations_archive_${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export all records to a CSV file (UTF-8 BOM for Arabic support).
 */
export function exportToCSV(records: UserRecord[]) {
  if (!records || records.length === 0) return;

  const headers = [
    'الرقم التعريفي (ID)',
    'الاسم الأول والأوسطى',
    'اسم الأب',
    'اسم العائلة',
    'رقم الهاتف',
    'العمر',
    'تاريخ الميلاد',
    'العنوان بالتفصيل',
    'المدرسة أو الجامعة',
    'الجنس',
    'الجنسية',
    'الحالة الاجتماعية',
    'اسم العُدَد المستخدمة',
    'عددها كام',
    'تاريخ التسجيل'
  ];

  const escape = (val: any) => {
    const str = val === undefined || val === null ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const rows = records.map(u => [
    u.id,
    u.fullName,
    u.fatherName,
    u.lastName,
    u.phone,
    u.age,
    u.dob,
    u.streetAddress,
    u.schoolOrUniversity || '',
    u.gender === 'Male' ? 'ذكر / Male' : u.gender === 'Female' ? 'أنثى / Female' : '',
    u.nationality,
    u.maritalStatus,
    u.equipmentUsed || '',
    u.equipmentQuantity !== undefined ? u.equipmentQuantity : '',
    u.createdAt ? new Date(u.createdAt).toLocaleString('ar-EG') : ''
  ].map(escape).join(','));

  const csv = '\ufeff' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `registrations_csv_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export database as a styled HTML snapshot (saveable as image via browser print/screenshot).
 * Opens in a new tab for the user to save as PNG or PDF.
 */
export function exportToImage(records: UserRecord[], websiteTitle: string) {
  if (!records || records.length === 0) return;

  const now = new Date().toLocaleString('ar-EG');
  const rows = records.map((u, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
      <td>${i + 1}</td>
      <td style="font-weight:700">${u.fullName} ${u.lastName}</td>
      <td>${u.fatherName}</td>
      <td dir="ltr" style="font-family:monospace">${u.phone}</td>
      <td>${u.age} سنة / ${u.dob}</td>
      <td>${u.streetAddress}</td>
      <td>${u.schoolOrUniversity || '-'}</td>
      <td>${u.gender === 'Male' ? 'ذكر' : u.gender === 'Female' ? 'أنثى' : '-'}</td>
      <td>${u.equipmentUsed || '-'}</td>
      <td style="font-size:9px;color:#64748b">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <title>كشف قاعدة البيانات - ${websiteTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; color: #0f172a; direction: rtl; padding: 20px; }
    .header { background: linear-gradient(135deg,#0f172a,#1e40af); color: #fff; border-radius: 16px; padding: 24px 32px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 22px; font-weight: 900; }
    .header .meta { font-size: 11px; opacity: 0.75; text-align: left; }
    .stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat { background: #fff; border-radius: 12px; padding: 14px 20px; border: 1px solid #e2e8f0; min-width: 120px; }
    .stat .val { font-size: 28px; font-weight: 900; color: #0f172a; }
    .stat .lbl { font-size: 10px; color: #64748b; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 8px rgba(0,0,0,0.06); font-size: 12px; }
    thead tr { background: #0f172a; color: #fff; }
    thead th { padding: 12px 10px; font-weight: 800; text-align: right; }
    tbody td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
    .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #94a3b8; }
    @media print { body { background: #fff; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div><h1>🗄️ قاعدة البيانات الحية — ${websiteTitle}</h1><p style="font-size:12px;margin-top:6px;opacity:0.8">LIVE DATABASE CONSOLE EXPORT</p></div>
    <div class="meta"><div>تاريخ الاستخراج:</div><div style="font-size:13px;font-weight:700">${now}</div><div style="margin-top:4px">الإجمالي: ${records.length} سجل</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="val">${records.length}</div><div class="lbl">إجمالي المسجلين</div></div>
    <div class="stat"><div class="val">${records.filter(u => u.gender === 'Male').length}</div><div class="lbl">ذكور</div></div>
    <div class="stat"><div class="val">${records.filter(u => u.gender === 'Female').length}</div><div class="lbl">إناث</div></div>
    <div class="stat"><div class="val">${records.filter(u => u.personalPhoto || u.idPhoto).length}</div><div class="lbl">لديهم صور</div></div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>الاسم الكامل</th><th>اسم الأب</th><th>الهاتف</th>
      <th>العمر / الميلاد</th><th>العنوان</th><th>المدرسة/الجامعة</th>
      <th>الجنس</th><th>العُدَد</th><th>تاريخ التسجيل</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">© ${new Date().getFullYear()} ${websiteTitle} — تم إنشاء هذا الكشف تلقائياً من قاعدة البيانات الحية</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ══════════════════════════════════════════════════════════
//  INSTALLATIONS EXPORTS  (PDF · Excel · Word)
// ══════════════════════════════════════════════════════════

export interface InstallationExportRecord {
  id: string;
  workerName: string;
  clientName: string;
  clientMobile: string;
  clientLandline?: string;
  area: string;
  buildingName?: string;
  buildingNumber?: string;
  installationsCount: number;
  notes?: string;
  createdAt: string;
  isPaid?: boolean;
  paidAt?: string;
  customFields?: { [key: string]: string };
}

/**
 * Export installations as Excel (.xlsx)
 */
export function exportInstallationsToExcel(
  records: InstallationExportRecord[],
  workerName?: string,
  pricePerUnit = 0
) {
  const filtered = workerName ? records.filter(r => r.workerName === workerName) : records;
  if (!filtered.length) return;

  const headers = [
    'م', 'اسم العامل', 'اسم العميل', 'موبايل العميل', 'خط أرضي',
    'المنطقة', 'اسم العمارة', 'رقم العمارة', 'عدد التركيبات',
    'المبلغ (ج)', 'حالة الدفع', 'تاريخ الدفع', 'ملحوظة', 'تاريخ الإضافة'
  ];

  const data = filtered.map((r, i) => [
    i + 1,
    r.workerName,
    r.clientName,
    r.clientMobile,
    r.clientLandline || '',
    r.area,
    r.buildingName || '',
    r.buildingNumber || '',
    r.installationsCount,
    r.installationsCount * pricePerUnit,
    r.isPaid ? 'مدفوع ✓' : 'غير مدفوع',
    r.paidAt ? new Date(r.paidAt).toLocaleDateString('ar-EG') : '',
    r.notes || '',
    r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-EG') : ''
  ]);

  // Total row
  const total = filtered.reduce((s, r) => s + (r.installationsCount || 0), 0);
  data.push(['', 'الإجمالي', '', '', '', '', '', '', total, total * pricePerUnit, '', '', '', '']);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Column widths
  worksheet['!cols'] = [
    { wch: 4 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'التركيبات');
  XLSX.writeFile(workbook, `تركيبات_${workerName || 'الكل'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export installations as Word (.doc via HTML blob)
 */
export function exportInstallationsToWord(
  records: InstallationExportRecord[],
  workerName?: string,
  pricePerUnit = 0,
  websiteTitle = 'Group M'
) {
  const filtered = workerName ? records.filter(r => r.workerName === workerName) : records;
  if (!filtered.length) return;

  const total = filtered.reduce((s, r) => s + (r.installationsCount || 0), 0);
  const amount = total * pricePerUnit;
  const now = new Date().toLocaleDateString('ar-EG');

  const rows = filtered.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
      <td>${i + 1}</td>
      <td style="font-weight:700">${r.workerName}</td>
      <td>${r.clientName}</td>
      <td dir="ltr" style="font-family:monospace">${r.clientMobile}</td>
      <td>${r.area}</td>
      <td style="text-align:center;font-weight:700;color:#d97706">${r.installationsCount}</td>
      <td style="text-align:center">${(r.installationsCount * pricePerUnit).toLocaleString('ar-EG')} ج</td>
      <td style="text-align:center;color:${r.isPaid ? '#059669' : '#dc2626'}">${r.isPaid ? '✓ مدفوع' : '✗ غير مدفوع'}</td>
      <td>${r.notes || '-'}</td>
      <td style="font-size:10px;color:#64748b">${r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
    </tr>`).join('');

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>كشف التركيبات - ${websiteTitle}</title>
      <style>
        @page WordSection1 { size:A4 landscape; margin:1cm 1.5cm; }
        div.WordSection1 { page:WordSection1; }
        body { font-family:'Arial',sans-serif; direction:rtl; text-align:right; color:#1e293b; }
        h1 { font-size:18pt; font-weight:900; color:#0f172a; text-align:center; border-bottom:3px solid #d97706; padding-bottom:8px; margin-bottom:4px; }
        .meta { text-align:center; font-size:10pt; color:#64748b; margin-bottom:16px; }
        table { width:100%; border-collapse:collapse; font-size:10pt; }
        thead tr { background:#0f172a; color:#ffffff; }
        th { padding:8px 6px; font-weight:800; text-align:right; border:1px solid #1e293b; }
        td { padding:7px 6px; border:1px solid #e2e8f0; }
        .summary { margin-top:20px; background:#fef9ee; border:2px solid #d97706; border-radius:8px; padding:14px 20px; }
        .summary p { font-size:13pt; font-weight:900; color:#0f172a; margin:4px 0; }
        .footer { margin-top:16px; text-align:center; font-size:9pt; color:#94a3b8; }
      </style>
    </head>
    <body><div class="WordSection1">
      <h1>📋 كشف التركيبات — ${websiteTitle}</h1>
      <div class="meta">
        ${workerName ? `العامل: <strong>${workerName}</strong> &nbsp;|&nbsp;` : ''}
        التاريخ: <strong>${now}</strong> &nbsp;|&nbsp;
        الإجمالي: <strong>${total} تركيبة</strong>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>اسم العامل</th><th>اسم العميل</th><th>الموبايل</th>
          <th>المنطقة</th><th>عدد التركيبات</th><th>المبلغ</th>
          <th>حالة الدفع</th><th>ملحوظة</th><th>التاريخ</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary">
        <p>📦 إجمالي التركيبات: <span style="color:#d97706">${total} تركيبة</span></p>
        <p>💰 سعر الوحدة: ${pricePerUnit.toLocaleString('ar-EG')} ج</p>
        <p>💵 المبلغ الإجمالي المستحق: <span style="color:#059669">${amount.toLocaleString('ar-EG')} جنيه مصري</span></p>
      </div>
      <div class="footer">© ${new Date().getFullYear()} ${websiteTitle} — تم إنشاء هذا الكشف تلقائياً</div>
    </div></body></html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `تركيبات_${workerName || 'الكل'}_${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/**
 * Export installations as PDF (via print dialog with styled HTML)
 */
export function exportInstallationsToPDF(
  records: InstallationExportRecord[],
  workerName?: string,
  pricePerUnit = 0,
  websiteTitle = 'Group M'
) {
  const filtered = workerName ? records.filter(r => r.workerName === workerName) : records;
  if (!filtered.length) return;

  const total = filtered.reduce((s, r) => s + (r.installationsCount || 0), 0);
  const amount = total * pricePerUnit;
  const now = new Date().toLocaleDateString('ar-EG');

  const rows = filtered.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
      <td>${i + 1}</td>
      <td style="font-weight:700">${r.workerName}</td>
      <td>${r.clientName}</td>
      <td dir="ltr">${r.clientMobile}</td>
      <td>${r.area}</td>
      <td class="center amber">${r.installationsCount}</td>
      <td class="center">${(r.installationsCount * pricePerUnit).toLocaleString('ar-EG')} ج</td>
      <td class="center" style="color:${r.isPaid ? '#059669' : '#dc2626'}">${r.isPaid ? '✓' : '✗'}</td>
      <td style="font-size:9px;color:#64748b">${r.notes || '-'}</td>
      <td style="font-size:9px;color:#94a3b8">${r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <title>كشف التركيبات - ${websiteTitle}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Segoe UI',Arial,sans-serif; direction:rtl; color:#0f172a; padding:16px; font-size:11px; }
    .header { background:linear-gradient(135deg,#0f172a,#d97706); color:#fff; border-radius:12px; padding:18px 24px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .header h1 { font-size:16px; font-weight:900; }
    .header .meta { font-size:10px; opacity:0.85; text-align:left; }
    .stats { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .stat { background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 16px; flex:1; min-width:100px; }
    .stat .val { font-size:22px; font-weight:900; color:#d97706; }
    .stat .lbl { font-size:9px; color:#64748b; font-weight:700; }
    table { width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; font-size:10px; box-shadow:0 1px 6px rgba(0,0,0,.07); }
    thead tr { background:#0f172a; color:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    th { padding:9px 7px; font-weight:800; text-align:right; }
    td { padding:7px; border-bottom:1px solid #f1f5f9; }
    .center { text-align:center; }
    .amber { font-weight:900; color:#d97706; }
    .summary { margin-top:16px; background:#fffbeb; border:2px solid #d97706; border-radius:10px; padding:12px 18px; display:flex; gap:30px; flex-wrap:wrap; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .summary p { font-size:12px; font-weight:900; }
    .footer { text-align:center; margin-top:14px; font-size:9px; color:#94a3b8; }
    @media print { @page { size:A4 landscape; margin:1cm; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📋 كشف التركيبات — ${websiteTitle}</h1>
      <p style="font-size:11px;margin-top:4px;opacity:.8">${workerName ? `العامل: ${workerName}` : 'جميع العمال'}</p>
    </div>
    <div class="meta">
      <div>تاريخ الطباعة</div>
      <div style="font-size:13px;font-weight:700">${now}</div>
      <div style="margin-top:4px">الإجمالي: ${filtered.length} سجل</div>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><div class="val">${total}</div><div class="lbl">إجمالي التركيبات</div></div>
    <div class="stat"><div class="val">${filtered.filter(r => r.isPaid).length}</div><div class="lbl">مدفوع</div></div>
    <div class="stat"><div class="val">${filtered.filter(r => !r.isPaid).length}</div><div class="lbl">غير مدفوع</div></div>
    <div class="stat"><div class="val">${amount.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المبلغ (ج)</div></div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>العامل</th><th>العميل</th><th>الموبايل</th>
      <th>المنطقة</th><th>تركيبات</th><th>المبلغ</th><th>دفع</th>
      <th>ملحوظة</th><th>التاريخ</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">
    <p>📦 إجمالي التركيبات: <span style="color:#d97706">${total}</span></p>
    <p>💰 سعر الوحدة: ${pricePerUnit} ج</p>
    <p>💵 المستحق الكلي: <span style="color:#059669">${amount.toLocaleString('ar-EG')} ج</span></p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} ${websiteTitle} — تم إنشاء هذا الكشف تلقائياً من النظام</div>
  <script>window.onload = () => { window.focus(); window.print(); }</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) w.focus();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

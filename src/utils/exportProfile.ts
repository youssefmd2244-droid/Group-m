import { UserRecord, ThemeConfig } from '../types';
// @ts-ignore — html2canvas is installed, types resolved at runtime
import html2canvas from 'html2canvas';

/**
 * Loads an image from a URL or base64 string asynchronously.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
}

/**
 * Formats a date string nicely.
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

/**
 * Draws and downloads the complete user registration profile card as a high-quality PNG.
 * Includes all 4 photos in an elegant grid.
 */
export async function exportProfileAsPNG(
  user: UserRecord,
  theme: ThemeConfig,
  appName: string
): Promise<void> {
  // Define canvas dimensions (high resolution for perfect printing & details)
  const width = 1000;
  const height = 1550;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas 2D context');
  }

  // 1. Draw elegant background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.1, '#f8fafc');
  gradient.addColorStop(0.9, '#f1f5f9');
  gradient.addColorStop(1, theme.primary || '#0f172a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Draw border frame
  ctx.lineWidth = 18;
  ctx.strokeStyle = theme.primary || '#1e293b';
  ctx.strokeRect(15, 15, width - 30, height - 30);

  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.secondary || '#64748b';
  ctx.strokeRect(28, 27, width - 56, height - 54);

  // 3. Header Section (Theme Primary colored banner)
  ctx.fillStyle = theme.primary || '#1e293b';
  ctx.fillRect(29, 29, width - 58, 175);

  // Decorative diagonals
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(width - 350, 29);
  ctx.lineTo(width - 29, 29);
  ctx.lineTo(width - 29, 204);
  ctx.lineTo(width - 500, 204);
  ctx.closePath();
  ctx.fill();

  // Header Title
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  
  ctx.font = 'bold 42px "Segoe UI", "Arial", sans-serif';
  ctx.fillText(appName || 'Group m', width / 2, 95);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 24px "Segoe UI", "Arial", sans-serif';
  ctx.fillText('بطاقة تسجيل عضوية شاملة / FULL REGISTRATION PROFILE PORTFOLIO', width / 2, 150);

  // Helper inside to draw fallback text inside photos
  const drawPhotoPlaceholder = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    titleAr: string,
    titleEn: string
  ) => {
    c.fillStyle = '#f8fafc';
    c.fillRect(x, y, w, h);
    c.strokeStyle = '#e2e8f0';
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);

    c.fillStyle = '#94a3b8';
    c.font = 'bold 15px "Segoe UI", sans-serif';
    c.textAlign = 'center';
    c.fillText(titleAr, x + w / 2, y + h / 2 - 10);
    c.font = 'italic 11px "Segoe UI", sans-serif';
    c.fillText(titleEn, x + w / 2, y + h / 2 + 10);
    c.fillStyle = '#cbd5e1';
    c.fillText('(غير مرفقة / Empty)', x + w / 2, y + h / 2 + 30);
  };

  // Draw 2x2 Grid of the 4 Optimized Media Files on the Left Column
  const photoW = 200;
  const photoH = 220;
  const startX = 60;
  const startY = 240;
  const spacingY = 265;

  const photoSlots = [
    { titleAr: '1. صورة شخصية', titleEn: 'Personal Photo', value: user.personalPhoto || user.idPhoto },
    { titleAr: '2. بطاقة (وجه)', titleEn: 'National ID Front', value: user.nationalIdFront },
    { titleAr: '3. بطاقة (ظهر)', titleEn: 'National ID Back', value: user.nationalIdBack },
    { titleAr: '4. شهادة ميلاد', titleEn: 'Birth Certificate', value: user.birthCertificate },
  ];

  for (let i = 0; i < 4; i++) {
    const slot = photoSlots[i];
    const x = startX + (i % 2) * 230;
    const y = startY + Math.floor(i / 2) * spacingY;

    // Draw slot background/border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 5, y - 5, photoW + 10, photoH + 10);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 5, y - 5, photoW + 10, photoH + 10);

    // Draw Title above slot
    ctx.fillStyle = theme.primary || '#1e293b';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(slot.titleAr, x + photoW / 2, y - 10);

    if (slot.value && slot.value.startsWith('data:image')) {
      try {
        const img = await loadImage(slot.value);
        ctx.drawImage(img, x, y, photoW, photoH);
      } catch (e) {
        console.error(`Error drawing photo slot ${i + 1}:`, e);
        drawPhotoPlaceholder(ctx, x, y, photoW, photoH, slot.titleAr, slot.titleEn);
      }
    } else {
      drawPhotoPlaceholder(ctx, x, y, photoW, photoH, slot.titleAr, slot.titleEn);
    }
  }

  // 5. User Registration Fields Layout (Right Side Column)
  const infoX = 540;
  const infoY = 240;
  const colWidth = 400;

  const fields = [
    { labelAr: 'الاسم الكامل', labelEn: 'Full Name', value: user.fullName },
    { labelAr: 'اسم الأب', labelEn: "Father's Name", value: user.fatherName },
    { labelAr: 'اسم العائلة', labelEn: 'Family Name', value: user.lastName },
    { labelAr: 'رقم الهاتف', labelEn: 'Phone Number', value: user.phone },
    { labelAr: 'العمر', labelEn: 'Age', value: `${user.age} سنة / Years` },
    { labelAr: 'تاريخ الميلاد', labelEn: 'Date of Birth', value: formatDate(user.dob) },
    { labelAr: 'المدرسة / الجامعة', labelEn: 'School/Uni', value: user.schoolOrUniversity },
    { labelAr: 'الجنس', labelEn: 'Gender', value: user.gender === 'Male' ? 'ذكر / Male' : 'أنثى / Female' },
    { labelAr: 'الجنسية', labelEn: 'Nationality', value: user.nationality },
    { labelAr: 'الحالة الاجتماعية', labelEn: 'Marital Status', value: user.maritalStatus },
    { labelAr: 'العنوان', labelEn: 'Street Address', value: user.streetAddress },
  ];

  // Render Form fields with back-coloring row stripes
  let currentY = infoY + 20;

  fields.forEach((field, index) => {
    if (index % 2 === 0) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.4)';
      ctx.fillRect(infoX - 10, currentY - 20, colWidth + 20, 50);
    }

    // Right Side (Arabic Labels)
    ctx.textAlign = 'right';
    ctx.fillStyle = theme.primary || '#1e293b';
    ctx.font = 'bold 16px "Segoe UI", "Arial", sans-serif';
    ctx.fillText(field.labelAr + ':', infoX + colWidth - 10, currentY);

    // Left Side En Labels & Values
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 11px "Segoe UI", sans-serif';
    ctx.fillText(`(${field.labelEn})`, infoX - 5, currentY - 6);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 15px "Segoe UI", "Arial", sans-serif';
    ctx.fillText(field.value || '-', infoX - 5, currentY + 12);

    // Divide line
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(infoX - 10, currentY + 22);
    ctx.lineTo(infoX + colWidth + 10, currentY + 22);
    ctx.stroke();

    currentY += 56;
  });

  // Render any custom fields if they exist
  if (user.customFields) {
    Object.entries(user.customFields).forEach(([key, val]) => {
      // Draw background shading
      ctx.fillStyle = 'rgba(254, 243, 199, 0.4)'; // Light golden accent for custom fields
      ctx.fillRect(infoX - 10, currentY - 20, colWidth + 20, 50);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.fillText(key + ':', infoX + colWidth - 10, currentY);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 15px "Segoe UI", sans-serif';
      ctx.fillText(val || '-', infoX - 5, currentY + 5);

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(infoX - 10, currentY + 22);
      ctx.lineTo(infoX + colWidth + 10, currentY + 22);
      ctx.stroke();

      currentY += 56;
    });
  }

  // 6. Centered watermark / details line
  const footerY = 1380;
  ctx.strokeStyle = theme.secondary || '#64748b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, footerY);
  ctx.lineTo(width - 50, footerY);
  ctx.stroke();

  // Watermark text in background
  ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.font = 'bold 64px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VERIFIED APPLICANT', width / 2, footerY + 80);

  // Left stamp
  ctx.fillStyle = '#64748b';
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('REG_ID: ' + user.id, 60, footerY + 30);
  ctx.fillText('DB STATUS: OK/CLOUD_SYNCHRONIZED', 60, footerY + 55);
  ctx.fillText('DATE: ' + new Date(user.createdAt).toISOString(), 60, footerY + 80);

  // Right Sign stamp
  ctx.textAlign = 'right';
  ctx.fillStyle = theme.primary || '#1e293b';
  ctx.font = 'bold 15px "Segoe UI", sans-serif';
  ctx.fillText('توقيع وختم رعاية التسجيل', width - 60, footerY + 30);
  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.fillText('REGISTRATION STAMP & AUTHORIZATION SIGN', width - 60, footerY + 50);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(width - 260, footerY + 65, 200, 50);
  ctx.setLineDash([]);

  // Trigger file save PNG
  const filename = `${user.fullName ? user.fullName.replace(/\s+/g, '_') : 'profile'}_${user.id.slice(0, 5)}.png`;
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Triggers native browser print with optimized styles loaded dynamically to print
 * the selected user's registration layout beautifully. Designed to compile all 4 photos perfectly on one crisp page.
 */
export function printUserProfile(user: UserRecord, appName: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('الرجاء السماح بفتح النوافذ المنبثقة (Pop-ups) لتشغيل ميزة طباعة وتصدير الكشوفات.');
    return;
  }

  const dateValue = formatDate(user.dob);
  
  // Renders beautiful card grids for the 4 image uploads
  const renderPhotoHtml = (src?: string, title?: string) => {
    if (src && src.startsWith('data:image')) {
      return `
        <div class="photo-card select-none">
          <div class="p-title">${title}</div>
          <img src="${src}" alt="${title}" class="pic-img" />
        </div>
      `;
    } else {
      return `
        <div class="photo-card empty-card select-none">
          <div class="p-title">${title}</div>
          <div class="p-empty-placeholder">
            <span>لم ترفق الصورة</span>
            <span>(Not Uploaded)</span>
          </div>
        </div>
      `;
    }
  };

  // Build custom field html rows
  let customFieldsHtml = '';
  if (user.customFields) {
    Object.entries(user.customFields).forEach(([key, val]) => {
      customFieldsHtml += `
        <div class="field custom-field-row">
          <div class="field-label">${key} <span>(حقل مخصص)</span></div>
          <div class="field-value">${val || '-'}</div>
        </div>
      `;
    });
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${user.fullName} - الاستمارة الشاملة</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #ffffff;
          margin: 0;
          padding: 15px;
          color: #1e293b;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          border: 3px solid #0f172a;
          padding: 25px;
          background: #ffffff;
          box-shadow: 0 4px 10px rgb(0 0 0 / 10%);
        }
        .header {
          text-align: center;
          border-bottom: 3px double #0f172a;
          padding-bottom: 12px;
          margin-bottom: 25px;
        }
        .header h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 900;
          color: #0f172a;
        }
        .header p {
          margin: 5px 0 0 0;
          font-size: 14px;
          color: #475569;
          font-weight: bold;
          letter-spacing: 0.5px;
        }
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 25px;
        }
        .details-column {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .field {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          font-size: 14px;
        }
        .custom-field-row {
          background-color: #fffbeb;
          border-bottom: 1px solid #fde68a;
          padding: 4px 8px;
        }
        .field-label {
          font-weight: 800;
          color: #0d1e3d;
        }
        .field-label span {
          font-style: italic;
          font-size: 10px;
          color: #94a3b8;
          margin-right: 4px;
        }
        .field-value {
          color: #1e293b;
          font-weight: bold;
          text-align: left;
        }
        .media-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          align-content: start;
        }
        .photo-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          height: 180px;
        }
        .photo-card .p-title {
          background-color: #0f172a;
          color: #ffffff;
          font-size: 11px;
          font-weight: bold;
          text-align: center;
          padding: 4px 2px;
        }
        .photo-card .pic-img {
          width: 100%;
          height: 152px;
          object-fit: cover;
        }
        .empty-card {
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
        }
        .p-empty-placeholder {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 11px;
          font-weight: bold;
          gap: 4px;
        }
        .footer {
          margin-top: 35px;
          border-top: 1px dotted #94a3b8;
          padding-top: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #64748b;
        }
        .signature-box {
          border: 1px dashed #cbd5e1;
          width: 160px;
          height: 45px;
          margin-top: 5px;
        }
        .no-print-bar {
          margin-bottom: 15px;
          text-align: center;
        }
        .no-print-bar button {
          padding: 8px 20px;
          font-weight: bold;
          background: #0f172a;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.1s;
        }
        .no-print-bar button:hover {
          background: #334155;
        }
        @media print {
          body {
            padding: 0;
          }
          .container {
            border: none;
            box-shadow: none;
            padding: 0;
          }
          .no-print-bar {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <button onclick="window.print();">
          إصدار وطباعة كملف PDF للمسجل / Print & Download PDF
        </button>
      </div>
      <div class="container">
        <div class="header">
          <h1>${appName}</h1>
          <p>صحيفة تسجيل العضوية المعتمدة / CERTIFIED APPLICANT REGISTRATION FORM</p>
        </div>
        
        <div class="main-grid">
          <div class="details-column">
            <div class="field">
              <div class="field-label">الاسم الكامل <span>(Full Name)</span></div>
              <div class="field-value">${user.fullName || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">اسم الأب <span>(Father Name)</span></div>
              <div class="field-value">${user.fatherName || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">اسم العائلة <span>(Family Name)</span></div>
              <div class="field-value">${user.lastName || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">رقم الهاتف <span>(Phone)</span></div>
              <div class="field-value" style="direction: ltr;">${user.phone || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">العمر <span>(Age)</span></div>
              <div class="field-value">${user.age || '-'} سنة / Years</div>
            </div>
            <div class="field">
              <div class="field-label">تاريخ الميلاد <span>(Date of Birth)</span></div>
              <div class="field-value">${dateValue || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">المدرسة / الجامعة <span>(School / Uni)</span></div>
              <div class="field-value">${user.schoolOrUniversity || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">الجنس <span>(Gender)</span></div>
              <div class="field-value">${user.gender === 'Male' ? 'ذكر ذكر / Male' : 'أنثى أنثى / Female'}</div>
            </div>
            <div class="field">
              <div class="field-label">الجنسية <span>(Nationality)</span></div>
              <div class="field-value">${user.nationality || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">الحالة الاجتماعية <span>(Marital Status)</span></div>
              <div class="field-value">${user.maritalStatus || '-'}</div>
            </div>
            <div class="field">
              <div class="field-label">العنوان بالكامل <span>(Full Address)</span></div>
              <div class="field-value">${user.streetAddress || '-'}</div>
            </div>
            ${customFieldsHtml}
          </div>
          
          <div class="media-column">
            ${renderPhotoHtml(user.personalPhoto || user.idPhoto, '1. الصورة الشخصية')}
            ${renderPhotoHtml(user.nationalIdFront, '2. بطاقة الهوية (وجه)')}
            ${renderPhotoHtml(user.nationalIdBack, '3. بطاقة الهوية (ظهر)')}
            ${renderPhotoHtml(user.birthCertificate, '4. شهادة ميلاد الطالب')}
          </div>
        </div>

        <div class="footer">
          <div>
            <p style="margin: 3px 0;">معرف التسجيل: ${user.id}</p>
            <p style="margin: 3px 0;">حالة التوثيق: معاملة سحابية معتمدة</p>
            <p style="margin: 3px 0;">تاريخ إصدار المستند: ${new Date(user.createdAt).toLocaleString('ar-EG')}</p>
          </div>
          <div style="text-align: center;">
            <p style="margin:0; font-weight: bold; color: #0f172a;">اعتماد وتوقيع مسؤول القبول</p>
            <div class="signature-box"></div>
          </div>
        </div>
      </div>
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 300);
        });
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Generates and downloads a gorgeous, professional profile card on the client-side
 * using html2canvas to capture a custom designed HTML structure.
 */
export async function exportProfileAsHTML2Canvas(
  user: UserRecord,
  theme: ThemeConfig,
  appName: string
): Promise<void> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1000px';
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px';
  container.style.direction = 'rtl';
  container.style.textAlign = 'right';
  container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  container.style.color = '#1e293b';
  container.style.boxSizing = 'border-box';

  const dateValue = formatDate(user.dob);

  const getPhotoSrc = (src?: string) => {
    if (src && src.startsWith('data:image')) return src;
    return '';
  };

  const personalPhoto = getPhotoSrc(user.personalPhoto || user.idPhoto);
  const nationalIdFront = getPhotoSrc(user.nationalIdFront);
  const nationalIdBack = getPhotoSrc(user.nationalIdBack);
  const birthCertificate = getPhotoSrc(user.birthCertificate);

  // Render a beautiful card layout
  let customFieldsRows = '';
  if (user.customFields) {
    Object.entries(user.customFields).forEach(([key, val]) => {
      customFieldsRows += `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fde68a; background-color: #fffbeb; padding: 10px 14px; border-radius: 8px; margin-bottom: 6px;">
          <div style="font-weight: 800; color: #78350f;">${key}:</div>
          <div style="font-weight: bold; color: #1e293b; text-align: left;">${val || '-'}</div>
        </div>
      `;
    });
  }

  container.innerHTML = `
    <div style="border: 4px solid ${theme.primary || '#0f172a'}; border-radius: 20px; overflow: hidden; background: #ffffff; padding: 25px;">
      
      <!-- HEADER BANNER -->
      <div style="background-color: ${theme.primary || '#0f172a'}; color: #ffffff; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 36px; font-weight: 900; letter-spacing: 0.5px;">${appName || 'Group m'}</h1>
        <p style="margin: 6px 0 0 0; font-size: 15px; color: #e2e8f0; font-weight: bold; letter-spacing: 1px;">صحيفة تسجيل عضوية بوابية معتمدة / APPLICANT REGISTRATION PORTFOLIO</p>
      </div>

      <!-- MAIN CONTENT GRID -->
      <div style="display: flex; gap: 30px;">
        
        <!-- RIGHT COLUMN: APPLICANT DATA (60% width) -->
        <div style="flex: 1.5; display: flex; flex-direction: column; gap: 10px;">
          <h3 style="font-size: 18px; font-weight: 900; color: ${theme.primary || '#0f172a'}; border-bottom: 2px solid ${theme.primary || '#0f172a'}; padding-bottom: 6px; margin: 0 0 10px 0;">البيانات الشخصية والمعلومات العامة</h3>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">الاسم الأول والوسطى (First Name)</span>
              <span style="font-weight: 900; color: #0f172a; font-size: 15px;">${user.fullName || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">اسم الأب (Father's Name)</span>
              <span style="font-weight: bold; color: #0f172a; font-size: 15px;">${user.fatherName || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">اسم العائلة / اللقب (Family Name)</span>
              <span style="font-weight: bold; color: #0f172a; font-size: 15px;">${user.lastName || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">رقم الهاتف (Phone Number)</span>
              <span style="font-weight: bold; color: #01579b; font-family: monospace; font-size: 15px; direction: ltr;">${user.phone || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">العمر (Age)</span>
              <span style="font-weight: bold; color: #0f172a;">${user.age || '-'} سنة / Years</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">تاريخ الميلاد (Date of Birth)</span>
              <span style="font-weight: bold; color: #0f172a;">${dateValue || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">المدرسة / الجامعة (School/Uni)</span>
              <span style="font-weight: bold; color: #0f172a;">${user.schoolOrUniversity || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">الجنس (Gender)</span>
              <span style="font-weight: bold; color: #0f172a;">${user.gender === 'Male' ? 'ذكر / Male' : user.gender === 'Female' ? 'أنثى / Female' : '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">الجنسية (Nationality)</span>
              <span style="font-weight: bold; color: #0f172a;">${user.nationality || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">الحالة الاجتماعية (Marital Status)</span>
              <span style="font-weight: bold; color: #0f172a;">${user.maritalStatus || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">العنوان بالكامل (Street Address)</span>
              <span style="font-weight: bold; color: #0f172a; font-size: 13px;">${user.streetAddress || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">اسم العُدَد المستخدمة (Equipment)</span>
              <span style="font-weight: bold; color: #0f172a;">${user.equipmentUsed || '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding: 8px 10px;">
              <span style="font-weight: bold; color: #475569;">عددها كام (Quantity)</span>
              <span style="font-weight: bold; color: #0f172a;">${user.equipmentQuantity !== undefined ? user.equipmentQuantity : '-'}</span>
            </div>
          </div>

          <!-- DYNAMIC CUSTOM FIELDS -->
          ${customFieldsRows ? `
            <div style="margin-top: 15px;">
              <h4 style="font-size: 15px; font-weight: 900; color: #78350f; margin: 0 0 8px 0; border-bottom: 1px dashed #f59e0b; padding-bottom: 4px;">الحقول المخصصة الإضافية</h4>
              ${customFieldsRows}
            </div>
          ` : ''}

        </div>

        <!-- LEFT COLUMN: DOCUMENTS & IMAGES GRID (40% width) -->
        <div style="flex: 1; display: flex; flex-direction: column; gap: 15px;">
          <h3 style="font-size: 18px; font-weight: 900; color: ${theme.primary || '#0f172a'}; border-bottom: 2px solid ${theme.primary || '#0f172a'}; padding-bottom: 6px; margin: 0 0 10px 0;">المستندات والوثائق المرفقة</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            
            <!-- Photo 1 -->
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; display: flex; flex-direction: column; height: 170px;">
              <div style="background-color: ${theme.primary || '#0f172a'}; color: #ffffff; font-size: 11px; font-weight: bold; text-align: center; padding: 4px 2px;">1. الصورة الشخصية</div>
              ${personalPhoto ? `
                <img src="${personalPhoto}" style="width: 100%; height: 142px; object-fit: cover;" />
              ` : `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; font-weight: bold; background: #f8fafc; text-align: center; padding: 20px 5px;">
                  <span>غير مرفقة</span><span style="font-size:9px;">(Not Uploaded)</span>
                </div>
              `}
            </div>

            <!-- Photo 2 -->
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; display: flex; flex-direction: column; height: 170px;">
              <div style="background-color: ${theme.primary || '#0f172a'}; color: #ffffff; font-size: 11px; font-weight: bold; text-align: center; padding: 4px 2px;">2. وجه بطاقة الهوية</div>
              ${nationalIdFront ? `
                <img src="${nationalIdFront}" style="width: 100%; height: 142px; object-fit: cover;" />
              ` : `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; font-weight: bold; background: #f8fafc; text-align: center; padding: 20px 5px;">
                  <span>غير مرفقة</span><span style="font-size:9px;">(Not Uploaded)</span>
                </div>
              `}
            </div>

            <!-- Photo 3 -->
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; display: flex; flex-direction: column; height: 170px;">
              <div style="background-color: ${theme.primary || '#0f172a'}; color: #ffffff; font-size: 11px; font-weight: bold; text-align: center; padding: 4px 2px;">3. ظهر بطاقة الهوية</div>
              ${nationalIdBack ? `
                <img src="${nationalIdBack}" style="width: 100%; height: 142px; object-fit: cover;" />
              ` : `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; font-weight: bold; background: #f8fafc; text-align: center; padding: 20px 5px;">
                  <span>غير مرفقة</span><span style="font-size:9px;">(Not Uploaded)</span>
                </div>
              `}
            </div>

            <!-- Photo 4 -->
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff; display: flex; flex-direction: column; height: 170px;">
              <div style="background-color: ${theme.primary || '#0f172a'}; color: #ffffff; font-size: 11px; font-weight: bold; text-align: center; padding: 4px 2px;">4. شهادة ميلاد الطالب</div>
              ${birthCertificate ? `
                <img src="${birthCertificate}" style="width: 100%; height: 142px; object-fit: cover;" />
              ` : `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; font-weight: bold; background: #f8fafc; text-align: center; padding: 20px 5px;">
                  <span>غير مرفقة</span><span style="font-size:9px;">(Not Uploaded)</span>
                </div>
              `}
            </div>

          </div>

          <!-- SIGNATURE SEAL EXPORT CARD -->
          <div style="margin-top: 20px; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 15px; text-align: center; background-color: #fafafa;">
            <p style="margin: 0; font-size: 13px; font-weight: bold; color: ${theme.primary || '#0f172a'};">ختم واعتماد القبول للتسجيل</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8; font-weight: bold;">OFFICIAL PORTAL SEAL & VERIFIED STAMP</p>
            <div style="width: 100%; height: 50px; margin-top: 10px; display: flex; align-items: center; justify-content: center; position: relative;">
              <div style="width: 60px; height: 60px; border-radius: 50%; border: 3px double #10b981; color: #10b981; font-weight: 900; font-size: 11px; display: flex; align-items: center; justify-content: center; transform: rotate(-15deg); opacity: 0.85;">
                <span style="border-top:1px solid #10b981; border-bottom:1px solid #10b981; padding:2px;">APPROVED</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      <!-- FOOTER INFO SECTION -->
      <div style="margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
        <div>
          <p style="margin: 2px 0; font-weight: bold;">معرف التسجيل الرقمي: <span style="font-family: monospace; color:#1e293b; font-size:12px;">${user.id}</span></p>
          <p style="margin: 2px 0; font-weight: bold;">حالة توثيق المعاملة: معتمد ومحفوظ سحابياً بنجاح</p>
          <p style="margin: 2px 0; font-weight: bold;">رابط وتاريخ الاستمارات: ${new Date(user.createdAt).toLocaleString('ar-EG')}</p>
        </div>
        <div style="text-align: left; font-size: 10px; font-family: monospace;">
          <span>SECURED DOCUMENT SYSTEM</span><br />
          <span>VERIFIED BY CLOUD PLATFORM</span>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(container);

  try {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve(true);
            } else {
              img.onload = () => resolve(true);
              img.onerror = () => resolve(true);
            }
          })
      )
    );

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = `${user.fullName ? user.fullName.replace(/\s+/g, '_') : 'applicant'}_profile_${user.id.slice(0, 6)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error in html2canvas profile image export:', error);
    await exportProfileAsPNG(user, theme, appName);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}


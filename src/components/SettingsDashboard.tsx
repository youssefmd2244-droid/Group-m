import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Users, Palette, Github, FileDown, Eye, Edit2, Trash2, KeyRound, 
  Globe, PhoneCall, Save, RefreshCw, LogOut, Check, Search, X, 
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Plus, Sparkles, Printer, Lock,
  Sliders, Languages, PlusCircle, CheckSquare, Square, Send, Link, ToggleLeft, ToggleRight,
  Monitor, Image, Zap,
  Wrench, Calculator, DollarSign, UserCheck, Download, BarChart2,
  Camera, Video, FileText, Trash, ChevronDown, ChevronUp, Package, Archive
} from 'lucide-react';
import { UserRecord, ContactNumber, ThemeConfig, AppConfig, FormFieldSchema, CustomFloatingButton, InstallationRecord, InstallationFieldSchema } from '../types';
import { exportProfileAsPNG, printUserProfile, exportProfileAsHTML2Canvas } from '../utils/exportProfile';
import { exportToExcel, exportToWord, exportToCSV, exportToImage, exportInstallationsToExcel, exportInstallationsToWord, exportInstallationsToPDF } from '../utils/advancedExports';
import type { InstallationExportRecord } from '../utils/advancedExports';
import { DownloadZipButton } from '../utils/clientZipComponents';

// Re-exported for backward compatibility — defined in ../types
export type { InstallationFieldSchema, InstallationRecord } from '../types';

interface SettingsDashboardProps {
  appConfig: AppConfig;
  users: UserRecord[];
  onUpdateConfig: (newConfig: AppConfig) => void;
  onUpdateUsers: (newUsers: UserRecord[]) => void;
  onTriggerSync: () => Promise<void>;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error' | 'transient_fail';
  onClose: () => void;
  onAdminLogin?: () => void;
  onAdminLogout?: () => void;
}


// ── Image compression utility (Canvas resize before base64 storage) ────────
function compressImageToBase64(file: File, maxDim = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// ── Hardcoded GitHub Defaults ──────────────────────────────────────────────
const HARDCODED_OWNER   = 'youssefmd2244-droid';
const HARDCODED_REPO    = 'Group-m';
const HARDCODED_BRANCH  = 'main';
const HARDCODED_DATA_PATH = 'src/data.json';

function toBase64GH(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64GH(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

function exportInstallationsToCSV(records: InstallationRecord[], workerName?: string) {
  const filtered = workerName ? records.filter(r => r.workerName === workerName) : records;
  const headers = ['م','اسم العامل','اسم العميل','موبايل','أرضي','المنطقة','العمارة','رقم العمارة','عدد التركيبات','ملحوظة','التاريخ'];
  const rows = filtered.map((r, i) => [
    i+1, r.workerName, r.clientName, r.clientMobile, r.clientLandline,
    r.area, r.buildingName, r.buildingNumber, r.installationsCount,
    r.notes||'', new Date(r.createdAt).toLocaleDateString('ar-EG')
  ]);
  const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `تركيبات_${workerName||'الكل'}_${Date.now()}.csv`;
  a.click();
}

function exportInstallationsToPrint(records: InstallationRecord[], workerName: string, price: number) {
  const filtered = records.filter(r => r.workerName === workerName);
  const total = filtered.reduce((s, r) => s + (r.installationsCount||0), 0);
  const amount = total * price;
  const html = `<html dir="rtl"><head><title>كشف حساب - ${workerName}</title>
    <style>body{font-family:Arial;direction:rtl}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#0f172a;color:#fff}
    .total{font-size:18px;font-weight:bold;color:#0f172a;margin-top:20px}</style></head><body>
    <h2>كشف حساب العامل: ${workerName}</h2>
    <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
    <table><tr><th>م</th><th>اسم العميل</th><th>المنطقة</th><th>عدد التركيبات</th><th>التاريخ</th></tr>
    ${filtered.map((r,i)=>`<tr><td>${i+1}</td><td>${r.clientName}</td><td>${r.area}</td><td>${r.installationsCount}</td><td>${new Date(r.createdAt).toLocaleDateString('ar-EG')}</td></tr>`).join('')}
    </table>
    <div class="total">إجمالي التركيبات: ${total} | السعر: ${price} ج | المبلغ المستحق: ${amount.toLocaleString('ar-EG')} ج</div>
    </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export default function SettingsDashboard({
  appConfig,
  users,
  onUpdateConfig,
  onUpdateUsers,
  onTriggerSync,
  syncStatus,
  onClose,
  onAdminLogin,
  onAdminLogout,
}: SettingsDashboardProps) {
  // Authentication Gateway State
  // ✅ نستخدم localStorage عشان الجلسة ما تتمسحش مع ريفريش أو تغيير وضع سطح المكتب
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Auth من sessionStorage أو localStorage (App يضبطها قبل فتح الـ Dashboard)
    return sessionStorage.getItem('group_m_admin_session') === 'active' ||
           localStorage.getItem('group_m_admin_ok') === '1';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState<'inbox' | 'database' | 'installations' | 'schema' | 'installSchema' | 'localization' | 'contacts' | 'theme' | 'site' | 'github' | 'security'>('inbox');

  // Search & Pagination in Inbox
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Database Console
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbCurrentPage, setDbCurrentPage] = useState(1);
  const [dbItemsPerPage] = useState(15);
  const [dbGenderFilter, setDbGenderFilter] = useState<'all' | 'Male' | 'Female'>('all');

  // Focus Modal views
  const [focusedUser, setFocusedUser] = useState<UserRecord | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);
  const [activeExportDropdown, setActiveExportDropdown] = useState<string | null>(null);

  // 1. DYNAMIC COMPONENT & SCHEMA STATE
  const [fieldsSchemaList, setFieldsSchemaList] = useState<FormFieldSchema[]>(appConfig.fieldsSchema || []);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabelAr, setNewFieldLabelAr] = useState('');
  const [newFieldLabelEn, setNewFieldLabelEn] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'select' | 'tel' | 'date'>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptionsAr, setNewFieldOptionsAr] = useState('');
  const [newFieldPlaceholderAr, setNewFieldPlaceholderAr] = useState('');
  const [schemaMessage, setSchemaMessage] = useState('');

  // 2. LOCALIZATION CMS DICTIONARY OVERRIDES
  const [localizationMap, setLocalizationMap] = useState<{ [key: string]: string }>(appConfig.localizationOverrides || {});
  const [locSuccess, setLocSuccess] = useState('');

  // Basic layout configurations state
  const [websiteTitle, setWebsiteTitle] = useState(appConfig.websiteTitle);
  const [securityPassword, setSecurityPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secSuccess, setSecSuccess] = useState('');
  const [secError, setSecError] = useState('');

  const [whatsappList, setWhatsappList] = useState<ContactNumber[]>(appConfig.whatsappNumbers || []);
  const [callList, setCallList] = useState<ContactNumber[]>(appConfig.callNumbers || []);
  const [newContactLabel, setNewContactLabel] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [contactType, setContactType] = useState<'whatsapp' | 'call'>('whatsapp');
  const [contactMessage, setContactMessage] = useState('');

  // Custom Floating Buttons
  const [customButtonsList, setCustomButtonsList] = useState<CustomFloatingButton[]>(appConfig.customFloatingButtons || []);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [newCustomIcon, setNewCustomIcon] = useState('Send');
  const [newCustomIsFloating, setNewCustomIsFloating] = useState(true);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);

  const [themeColors, setThemeColors] = useState<ThemeConfig>(appConfig.theme);
  const [themeMessage, setThemeMessage] = useState('');

  const [ghToken, setGhToken] = useState(
    appConfig.github.token?.trim() ||
    (import.meta as any).env?.VITE_GITHUB_TOKEN?.trim() ||
    localStorage.getItem('gh_token_primary')?.trim() ||
    localStorage.getItem('gh_token_backup_1')?.trim() ||
    localStorage.getItem('gh_token_backup_2')?.trim() ||
    localStorage.getItem('gh_token_fallback')?.trim() ||
    ''
  );
  const [ghOwner, setGhOwner] = useState(appConfig.github.owner || 'youssefmd2244-droid');
  const [ghRepo, setGhRepo] = useState(appConfig.github.repo || 'Group-m');
  const [ghBranch, setGhBranch] = useState(appConfig.github.branch || 'main');
  const [ghDataPath, setGhDataPath] = useState(appConfig.github.dataPath || 'src/data.json');
  const [ghConfigPath, setGhConfigPath] = useState(appConfig.github.configPath || 'config.json');
  const [ghEnabled, setGhEnabled] = useState(appConfig.github.isEnabled);
  const [ghMessage, setGhMessage] = useState({ text: '', type: 'success' as 'success' | 'error' });

  // Dynamic Custom Favicon Logo & Website Title Animations States
  const [logoBase64, setLogoBase64] = useState(appConfig.logoBase64 || '');
  const [enableTitleAnimation, setEnableTitleAnimation] = useState(appConfig.enableTitleAnimation || false);


  // ── Installations State ───────────────────────────────────────────────────
  const [installations, setInstallations] = useState<InstallationRecord[]>(() => {
    // ✅ نحمل من appConfig أو من localStorage — أيهما أحدث وأكثر
    const fromConfig = appConfig?.installations || [];
    try {
      const fromStorage = JSON.parse(localStorage.getItem('group_m_installations') || '[]') as InstallationRecord[];
      // خد الأكثر
      return fromStorage.length >= fromConfig.length ? fromStorage : fromConfig;
    } catch {
      return fromConfig;
    }
  });
  const [installPrice, setInstallPrice] = useState<number>(
    appConfig?.installationPricePerUnit || 45
  );
  const [installTab, setInstallTab] = useState<'list' | 'workers' | 'accounting'>('list');
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [installSearch, setInstallSearch] = useState('');
  const [editingInstall, setEditingInstall] = useState<InstallationRecord | null>(null);

  // ── Installation Fields Schema ─────────────────────────────────────────────
  const [installFieldSchema, setInstallFieldSchema] = useState<InstallationFieldSchema[]>(
    appConfig?.installationFieldsSchema || []
  );
  const [newInstField, setNewInstField] = useState({ name: '', labelAr: '', type: 'text' as InstallationFieldSchema['type'], required: false, optionsAr: '' });
  const [instFieldMsg, setInstFieldMsg] = useState('');
  const [editingInstFieldId, setEditingInstFieldId] = useState<string | null>(null);
  const [editingInstFieldData, setEditingInstFieldData] = useState<Partial<InstallationFieldSchema>>({});

  // ── SITE CUSTOMIZATION TAB STATE ─────────────────────────────────────────
  const [siteTitle, setSiteTitle] = useState(appConfig.websiteTitle || 'Group M');
  const [siteFaviconBase64, setSiteFaviconBase64] = useState(appConfig.logoBase64 || '');
  const [enableIconGlowSpin, setEnableIconGlowSpin] = useState(appConfig.enableTitleAnimation || false);
  const [siteCustomMessage, setSiteCustomMessage] = useState('');

  // Sync state modifications when props reload
  useEffect(() => {
    setWebsiteTitle(appConfig.websiteTitle);
    setSiteTitle(appConfig.websiteTitle || 'Group M');
    setWhatsappList(appConfig.whatsappNumbers || []);
    setCallList(appConfig.callNumbers || []);
    setCustomButtonsList(appConfig.customFloatingButtons || []);
    setThemeColors(appConfig.theme);
    setFieldsSchemaList(appConfig.fieldsSchema || []);
    setInstallFieldSchema(appConfig?.installationFieldsSchema || []);
    // ✅ نحدّث التركيبات بس لو appConfig عنده بيانات أحدث
    if ((appConfig?.installations || []).length > 0) {
      setInstallations(appConfig.installations || []);
    }
    setInstallPrice(appConfig?.installationPricePerUnit || 45);
    setLocalizationMap(appConfig.localizationOverrides || {});
    setGhToken(appConfig.github.token || (import.meta.env.VITE_GITHUB_TOKEN as string) || '');
    setGhOwner(appConfig.github.owner || 'youssefmd2244-droid');
    setGhRepo(appConfig.github.repo || 'Group-m');
    setGhBranch(appConfig.github.branch || 'main');
    setGhDataPath(appConfig.github.dataPath || 'src/data.json');
    setGhConfigPath(appConfig.github.configPath || 'config.json');
    setGhEnabled(appConfig.github.isEnabled);
    setLogoBase64(appConfig.logoBase64 || '');
    setSiteFaviconBase64(appConfig.logoBase64 || '');
    setEnableTitleAnimation(appConfig.enableTitleAnimation || false);
    setEnableIconGlowSpin(appConfig.enableTitleAnimation || false);
  }, [appConfig]);

  const handleAuthClick = () => {
    const correctPassword = appConfig.masterPasswordHash || '20042007';
    if (passwordInput === correctPassword) {
      // ✅ حفظ في localStorage عشان ما يتمسحش مع ريفريش
      localStorage.setItem('group_m_admin_ok', '1');
      sessionStorage.setItem('group_m_admin_session', 'active');
      localStorage.setItem('isAdminNotificationDevice', 'true');
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
      setAuthError('');
      if (onAdminLogin) onAdminLogin();
      // Smooth state transition — no reload, no redirect, no form submit
      setIsAuthenticated(true);
      setActiveTab('inbox');
    } else {
      setAuthError('الرمز السري المكتوب خاطئ! الرجاء إعادة المحاولة.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    localStorage.removeItem('group_m_admin_ok');
    sessionStorage.removeItem('group_m_admin_session');
    if (onAdminLogout) onAdminLogout();
    // onAdminLogout في App يستدعي setShowSettings(false) أيضاً
  };


  // ── Pagination constants ──────────────────────────────────────────────────
  const ITEMS_PER_PAGE = 10;
  const DB_ITEMS = 15;

  // ── GitHub helpers for installations ─────────────────────────────────────

  const GH_TOKEN_VAL = ghToken || (import.meta as any).env?.VITE_GITHUB_TOKEN || localStorage.getItem('gh_token_fallback') || '';

  const pushInstallationsToGithub = async (newUsers: UserRecord[], newInstalls: InstallationRecord[]) => {
    if (!GH_TOKEN_VAL) return;
    // ─── إضافة AbortController للـ timeout (60 ثانية) ───────────────────
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const REPO_OWNER_V = ghOwner?.trim() || HARDCODED_OWNER;
      const REPO_NAME_V  = ghRepo?.trim()  || HARDCODED_REPO;
      const BRANCH_V     = ghBranch?.trim() || HARDCODED_BRANCH;
      const DATA_PATH_V  = ghDataPath?.trim() || HARDCODED_DATA_PATH;
      const url = `https://api.github.com/repos/${REPO_OWNER_V}/${REPO_NAME_V}/contents/${DATA_PATH_V}`;
      const getRes = await fetch(`${url}?ref=${BRANCH_V}`, {
        headers: { Authorization: `Bearer ${GH_TOKEN_VAL}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        signal: controller.signal,
      });
      const shaData = getRes.ok ? await getRes.json() : null;
      const currentSha: string | undefined = shaData?.sha;
      let existingConfig: Record<string, unknown> = {};
      if (shaData?.content) { try { const dec = fromBase64GH(shaData.content); const parsed = JSON.parse(dec); if (parsed?.__config__) existingConfig = parsed.__config__; } catch (_) {} }

      // safeStringify — يمنع تجميد المتصفح مع Base64 كبير
      const jsonStr = await new Promise<string>((resolve, reject) => {
        setTimeout(() => {
          try { resolve(JSON.stringify({ users: newUsers, installations: newInstalls, __config__: existingConfig }, null, 2)); }
          catch (e) { reject(e); }
        }, 0);
      });

      const payload: Record<string, string> = {
        message: `chore: sync ${newUsers.length} records + ${newInstalls.length} installations [auto]`,
        content: toBase64GH(jsonStr),
        branch: BRANCH_V,
      };
      if (currentSha) payload.sha = currentSha;
      await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${GH_TOKEN_VAL}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: any) {
      // ⚠️ لا نمس الـ Token عند أي خطأ (Timeout أو Network أو 4xx)
      if (err?.name !== 'AbortError') {
        console.warn('GitHub push failed (Token محفوظ):', err);
      } else {
        console.warn('GitHub push timeout — سيُعاد لاحقاً');
      }
    } finally {
      clearTimeout(timer);
    }
  };

  // ── Installation handlers ─────────────────────────────────────────────────

  const updateInstallations = (newInstalls: InstallationRecord[]) => {
    setInstallations(newInstalls);
    // ✅ حفظ في localStorage عشان يتحمل للكل
    localStorage.setItem('group_m_installations', JSON.stringify(newInstalls));
    onUpdateConfig({ ...appConfig, installations: newInstalls, installationPricePerUnit: installPrice });
    pushInstallationsToGithub(users || [], newInstalls);
  };

  const handleDeleteInstall = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه التركيبة؟')) {
      updateInstallations(installations.filter(i => i.id !== id));
    }
  };

  const handleUpdateInstall = () => {
    if (!editingInstall) return;
    updateInstallations(installations.map(i => i.id === editingInstall.id ? editingInstall : i));
    setEditingInstall(null);
  };

  const handleSettleWorker = (workerName: string) => {
    const total = installations.filter(r => r.workerName === workerName && !r.isPaid)
      .reduce((s, r) => s + (r.installationsCount || 0), 0);
    if (!window.confirm(`هل تريد تصفية حساب "${workerName}"?\nإجمالي التركيبات: ${total}\nالمبلغ: ${(total * installPrice).toLocaleString('ar-EG')} ج\n\nسيتم تصفير العداد بعد تأكيد الدفع.`)) return;
    updateInstallations(installations.map(i =>
      i.workerName === workerName && !i.isPaid ? { ...i, isPaid: true, paidAt: new Date().toISOString() } : i
    ));
  };

  const handleSaveInstallPrice = () => {
    onUpdateConfig({ ...appConfig, installationPricePerUnit: installPrice });
    alert('تم حفظ سعر التركيبة!');
  };

  const handleAddInstallField = () => {
    if (!newInstField.labelAr.trim()) { setInstFieldMsg('أدخل اسم الحقل!'); return; }
    const newF: InstallationFieldSchema = {
      id: `if_${Date.now()}`, name: `instf_${Date.now()}`,
      labelAr: newInstField.labelAr.trim(), type: newInstField.type,
      required: newInstField.required, optionsAr: newInstField.optionsAr.trim(), isEnabled: true,
    };
    const updated = [...installFieldSchema, newF];
    setInstallFieldSchema(updated);
    onUpdateConfig({ ...appConfig, installationFieldsSchema: updated });
    setNewInstField({ name: '', labelAr: '', type: 'text', required: false, optionsAr: '' });
    setInstFieldMsg('تم إضافة الحقل!');
    setTimeout(() => setInstFieldMsg(''), 3000);
  };

  // ── Workers grouping ──────────────────────────────────────────────────────

  const workerGroups = (() => {
    const map = new Map<string, { records: InstallationRecord[]; total: number; unpaid: number }>();
    installations.forEach(r => {
      if (!map.has(r.workerName)) map.set(r.workerName, { records: [], total: 0, unpaid: 0 });
      const g = map.get(r.workerName)!;
      g.records.push(r);
      g.total += r.installationsCount || 0;
      if (!r.isPaid) g.unpaid += r.installationsCount || 0;
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  })();

  const filteredInstalls = installations.filter(i => {
    const q = installSearch.toLowerCase().trim();
    return !q || i.workerName?.toLowerCase().includes(q) || i.clientName?.toLowerCase().includes(q) || i.area?.toLowerCase().includes(q);
  });

  // ── GITHUB DIRECT SYNC ENGINE ─────────────────────────────────────────────
  // Hardcoded repo defaults — never empty
  const REPO_OWNER = ghOwner?.trim() || 'youssefmd2244-droid';
  const REPO_NAME  = ghRepo?.trim()  || 'Group-m';
  const DATA_PATH  = ghDataPath?.trim() || 'src/data.json';
  const BRANCH     = ghBranch?.trim()   || 'main';
  // Multi-source token resolution — priority: state → env → localStorage
  const GH_TOKEN: string = (
    ghToken?.trim() ||
    (import.meta as any).env?.VITE_GITHUB_TOKEN?.trim() ||
    localStorage.getItem('gh_token_primary')?.trim() ||
    localStorage.getItem('gh_token_backup_1')?.trim() ||
    localStorage.getItem('gh_token_backup_2')?.trim() ||
    localStorage.getItem('gh_token_fallback')?.trim() ||
    ''
  );
  // ✅ حفظ التوكن في localStorage كلما وجد
  if (GH_TOKEN) localStorage.setItem('gh_token_fallback', GH_TOKEN);

  /** Fetch data.json from GitHub and update users list immediately (on boot / refresh) */
  const fetchUsersFromGithub = async () => {
    if (!GH_TOKEN) return;
    try {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}?ref=${BRANCH}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!res.ok) return;
      const json = await res.json();
      const decoded = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
      const raw = JSON.parse(decoded);
      // Support both plain array and {users, __config__} format
      const parsed: UserRecord[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.users) ? raw.users : []);
      if (parsed.length >= 0) {
        onUpdateUsers(parsed);
        localStorage.setItem('group_m_users', JSON.stringify(parsed));
      }
    } catch (err) {
      console.warn('GitHub fetch on load failed:', err);
    }
  };

  /** SHA-aware push: reads current SHA first, then commits updated data.json */
  const pushUsersToGithub = async (newUsers: UserRecord[]) => {
    if (!GH_TOKEN) return;
    try {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}`;
      const getRes = await fetch(`${url}?ref=${BRANCH}`, {
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      const shaData = getRes.ok ? await getRes.json() : null;
      const currentSha: string | undefined = shaData?.sha;

      // Preserve __config__ block when writing users — read existing config
      let existingConfig: Record<string, unknown> = {};
      if (shaData?.content) {
        try {
          const dec = decodeURIComponent(escape(atob(shaData.content.replace(/\n/g, ''))));
          const parsed = JSON.parse(dec);
          if (parsed?.__config__) existingConfig = parsed.__config__;
        } catch (_) {}
      }

      const filePayload = {
        users: newUsers,
        __config__: existingConfig,
      };

      const payload: Record<string, string> = {
        message: `chore: sync ${newUsers.length} records [auto]`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(filePayload, null, 2)))),
        branch: BRANCH,
      };
      if (currentSha) payload.sha = currentSha;

      await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('GitHub push failed:', err);
    }
  };

  /** Optimistic delete: update UI instantly, then sync to GitHub in background */
  const handleDeleteUserDirect = (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من مسح استمارة الطالب "${name}" نهائياً من الشبكة؟`)) {
      const updated = (users || []).filter((u) => u.id !== id);
      onUpdateUsers(updated);
      pushUsersToGithub(updated);
    }
  };

  // Note: GitHub data fetch is handled by App.tsx handleAdminLogin
  // No duplicate fetch here to avoid overwriting merged data

  // ─────────────────────────────────────────────────────────────────────────

  // 1. INBOX DATAGRID & MUTATIONS
  const filteredUsers = (users || []).filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.fatherName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      u.streetAddress.toLowerCase().includes(q) ||
      u.schoolOrUniversity.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  const handleDeleteUser = (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من مسح استمارة الطالب "${name}" نهائياً من الشبكة؟`)) {
      const updated = (users || []).filter((u) => u.id !== id);
      onUpdateUsers(updated);
      pushUsersToGithub(updated);
    }
  };

  const handlePurgeAll = () => {
    if (window.confirm('🚨 تحذير أمني: هل أنت متأكد من مسح وتطهير جميع السجلات والملفات المرفقة بالكامل من الموقع والشبكة؟ لا يمكن التراجع عن هذا الإجراء!')) {
      onUpdateUsers([]);
      pushUsersToGithub([]);
    }
  };

  const handleUpdateUserValue = () => {
    
    if (!editingUser) return;
    const updated = (users || []).map((u) => (u.id === editingUser.id ? editingUser : u));
    onUpdateUsers(updated);
    pushUsersToGithub(updated);
    setEditingUser(null);
  };

  // 2. SCHEMA DEFINITIONS (CMS FORM LAYERS)
  const handleAddSchemaField = () => {
    if (!newFieldLabelAr.trim() || !newFieldLabelEn.trim()) {
      setSchemaMessage('يرجى تعبئة الملصقات التعريفية العربية والإنجليزية معاً!');
      return;
    }
    const cleanKeyName = newFieldName.trim() || `custom_field_${Date.now()}`;
    const newField: FormFieldSchema = {
      id: `schema_${Date.now()}`,
      name: cleanKeyName,
      labelAr: newFieldLabelAr.trim(),
      labelEn: newFieldLabelEn.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholderAr: newFieldPlaceholderAr.trim(),
      optionsAr: newFieldOptionsAr.trim(),
      isEnabled: true
    };

    const updatedList = [...fieldsSchemaList, newField];
    setFieldsSchemaList(updatedList);
    onUpdateConfig({ ...appConfig, fieldsSchema: updatedList });
    setNewFieldName('');
    setNewFieldLabelAr('');
    setNewFieldLabelEn('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldOptionsAr('');
    setNewFieldPlaceholderAr('');
    setSchemaMessage('تم تسجيل الحقل المخصص وتحديث استمارات التسجيل بنجاح!');
    setTimeout(() => setSchemaMessage(''), 3000);
  };

  const toggleSchemaFieldStatus = (id: string) => {
    const updated = fieldsSchemaList.map(f => f.id === id ? { ...f, isEnabled: !f.isEnabled } : f);
    setFieldsSchemaList(updated);
    onUpdateConfig({ ...appConfig, fieldsSchema: updated });
  };

  const handleUpdateSchemaFieldInline = (id: string, updatedFields: Partial<FormFieldSchema>) => {
    const updated = fieldsSchemaList.map(f => f.id === id ? { ...f, ...updatedFields } : f);
    setFieldsSchemaList(updated);
    onUpdateConfig({ ...appConfig, fieldsSchema: updated });
  };

  const deleteSchemaField = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الحقل الإضافي نهائياً من قائمة التسجيل؟')) {
      const updated = fieldsSchemaList.filter(f => f.id !== id);
      setFieldsSchemaList(updated);
      onUpdateConfig({ ...appConfig, fieldsSchema: updated });
    }
  };

  // 3. HOME CMS LOCALIZATION MAPPERS
  const localizationKeys = [
    { key: 'registrationFormTitle', label: 'عنوان كارت الاستمارة الرئيسي', defaultVal: 'استمارة تسجيل عضوية جديدة' },
    { key: 'welcomeSubtitle', label: 'النص التعريفي المساعد تحت العنوان', defaultVal: 'البوابة الإلكترونية الشاملة لتسجيل العضوية والالتحاق بالدورات التدريبية' },
    { key: 'submitButtonText', label: 'نص زر الإرسال المضيء', defaultVal: 'إرسال استمارة التسجيل والمزامنة' },
    { key: 'successMessageAr', label: 'رسالة إشعار النجاح بعد الحفظ', defaultVal: 'تم حفظ استمارة التسجيل بنجاح في قاعدة البيانات المحلية!' },
    { key: 'publicTableTitle', label: 'عنوان جدول قاعدة البيانات في الواجهة', defaultVal: 'بيانات التسجيل والسجلات النشطة' }
  ];

  const handleSaveLocalizationOverrides = () => {
    const updatedConfig = { ...appConfig, localizationOverrides: localizationMap };
    onUpdateConfig(updatedConfig);
    setLocSuccess('تمت كتابة الأقسام والعبارات الجديدة وحفظها بنجاح!');
    setTimeout(() => setLocSuccess(''), 3000);
  };

  const handleLocMapChange = (key: string, value: string) => {
    setLocalizationMap(prev => ({ ...prev, [key]: value }));
  };

  // 4. FLOATING CONTACT SWITCHES
  const addContactNumber = () => {
    if (!newContactLabel.trim() || !newContactPhone.trim()) {
      setContactMessage('يرجى كتابة الاسم ورقم الهاتف معاً!');
      return;
    }
    const newContact: ContactNumber = {
      id: `cont_${Date.now()}`,
      label: newContactLabel.trim(),
      number: newContactPhone.trim(),
    };

    let updatedConfig = { ...appConfig };
    if (contactType === 'whatsapp') {
      const list = [...whatsappList, newContact];
      setWhatsappList(list);
      updatedConfig.whatsappNumbers = list;
    } else {
      const list = [...callList, newContact];
      setCallList(list);
      updatedConfig.callNumbers = list;
    }

    onUpdateConfig(updatedConfig);
    setNewContactLabel('');
    setNewContactPhone('');
    setContactMessage('تم إدخال الرقم وحفظ الإعدادات الهاتفي بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const deleteContactNumber = (id: string, type: 'whatsapp' | 'call') => {
    let updatedConfig = { ...appConfig };
    if (type === 'whatsapp') {
      const list = whatsappList.filter(c => c.id !== id);
      setWhatsappList(list);
      updatedConfig.whatsappNumbers = list;
    } else {
      const list = callList.filter(c => c.id !== id);
      setCallList(list);
      updatedConfig.callNumbers = list;
    }
    onUpdateConfig(updatedConfig);
    setContactMessage('تم إخلاء الرقم بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  // 4B. CUSTOM FLOATING BUTTON ACTIONS
  const addCustomFloatingButton = () => {
    if (!newCustomLabel.trim() || !newCustomUrl.trim()) {
      setContactMessage('يرجى ملاء البيانات بالكامل للزر المخصص!');
      return;
    }
    const newBtn: CustomFloatingButton = {
      id: `btn_${Date.now()}`,
      label: newCustomLabel.trim(),
      url: newCustomUrl.trim(),
      icon: newCustomIcon,
      isFloating: newCustomIsFloating,
    };
    const updatedList = [...customButtonsList, newBtn];
    setCustomButtonsList(updatedList);
    onUpdateConfig({ ...appConfig, customFloatingButtons: updatedList });
    setNewCustomLabel('');
    setNewCustomUrl('');
    setNewCustomIcon('Send');
    setNewCustomIsFloating(true);
    setContactMessage('تم إدراج وحفظ الزر العائم المخصص بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const deleteCustomFloatingButton = (id: string) => {
    const updatedList = customButtonsList.filter(b => b.id !== id);
    setCustomButtonsList(updatedList);
    onUpdateConfig({ ...appConfig, customFloatingButtons: updatedList });
    setContactMessage('تم حذف الزر المخصص بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const toggleCustomFloatingState = (id: string) => {
    const updatedList = customButtonsList.map(b => b.id === id ? { ...b, isFloating: !b.isFloating } : b);
    setCustomButtonsList(updatedList);
    onUpdateConfig({ ...appConfig, customFloatingButtons: updatedList });
  };

  const startEditCustomButton = (btn: CustomFloatingButton) => {
    setEditingCustomId(btn.id);
    setNewCustomLabel(btn.label);
    setNewCustomUrl(btn.url);
    setNewCustomIcon(btn.icon);
    setNewCustomIsFloating(btn.isFloating);
  };

  const saveEditCustomButton = () => {
    if (!newCustomLabel.trim() || !newCustomUrl.trim()) {
      setContactMessage('يرجى ملاء البيانات بالكامل للزر المخصص!');
      return;
    }
    const updatedList = customButtonsList.map(b =>
      b.id === editingCustomId
        ? { ...b, label: newCustomLabel.trim(), url: newCustomUrl.trim(), icon: newCustomIcon, isFloating: newCustomIsFloating }
        : b
    );
    setCustomButtonsList(updatedList);
    setEditingCustomId(null);
    onUpdateConfig({ ...appConfig, customFloatingButtons: updatedList });
    setNewCustomLabel('');
    setNewCustomUrl('');
    setNewCustomIcon('Send');
    setNewCustomIsFloating(true);
    setContactMessage('تم حفظ تعديل الزر المخصص بنجاح!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const cancelEditCustomButton = () => {
    setEditingCustomId(null);
    setNewCustomLabel('');
    setNewCustomUrl('');
    setNewCustomIcon('Send');
    setNewCustomIsFloating(true);
  };

  // 5. COLORS WHEEL & THEME BINDINGS
  const colorPresets = [
    { name: 'كلاسيك بحري / Slate Blue', primary: '#0f172a', secondary: '#475569', accent: '#14b8a6', bgGradientStart: '#f8fafc', bgGradientEnd: '#e2e8f0', borderRadius: 'rounded-xl' },
    { name: 'الأخضر الزمردي / Emerald', primary: '#064e3b', secondary: '#059669', accent: '#10b981', bgGradientStart: '#f0fdf4', bgGradientEnd: '#dcfce7', borderRadius: 'rounded-2xl' },
    { name: 'الأرجواني الملكي / Violet', primary: '#4c1d95', secondary: '#7c3aed', accent: '#a78bfa', bgGradientStart: '#faf5ff', bgGradientEnd: '#f3e8ff', borderRadius: 'rounded-3xl' },
    { name: 'النحاسي الذهبي / Amber', primary: '#78350f', secondary: '#b45309', accent: '#f59e0b', bgGradientStart: '#fffbeb', bgGradientEnd: '#fef3c7', borderRadius: 'rounded-lg' },
    { name: 'التيتانيوم الفحمي / Dark Zinc', primary: '#18181b', secondary: '#3f3f46', accent: '#f4f4f5', bgGradientStart: '#09090b', bgGradientEnd: '#1e1e24', borderRadius: 'rounded-2xl', isDarkMode: true }
  ];

  const applyPresetTheme = (preset: typeof colorPresets[0]) => {
    const updatedTheme: ThemeConfig = {
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      bgGradientStart: preset.bgGradientStart,
      bgGradientEnd: preset.bgGradientEnd,
      cardBg: preset.isDarkMode ? '#1e1e24' : '#ffffff',
      borderRadius: preset.borderRadius,
      isDarkMode: preset.isDarkMode || false
    };
    setThemeColors(updatedTheme);
    onUpdateConfig({ ...appConfig, theme: updatedTheme });
    setThemeMessage('تم تطبيق تناسق الألوان وسِلسِلة القوالب فورياً وعبر كافة الشاشات!');
    setTimeout(() => setThemeMessage(''), 3000);
  };

  const handleCustomColorInput = (key: keyof ThemeConfig, val: string | boolean) => {
    const updatedTheme = { ...themeColors, [key]: val };
    setThemeColors(updatedTheme);
    onUpdateConfig({ ...appConfig, theme: updatedTheme });
  };

  // ── GITHUB CONFIG PUSH ENGINE ─────────────────────────────────────────────
  /** Push updated AppConfig (as embedded in data.json) to GitHub */
  const pushConfigToGithub = async (updatedConfig: AppConfig) => {
    if (!GH_TOKEN) return;
    // We store config fields inside data.json under a special __config__ key
    // to avoid a separate config.json file. Merge with existing users payload.
    try {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}`;
      const getRes = await fetch(`${url}?ref=${BRANCH}`, {
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      const shaData = getRes.ok ? await getRes.json() : null;
      const currentSha: string | undefined = shaData?.sha;

      // Decode existing file to preserve users array, then inject __config__
      let existingUsers: UserRecord[] = users;
      if (shaData?.content) {
        try {
          const decoded = decodeURIComponent(escape(atob(shaData.content.replace(/\n/g, ''))));
          const parsed = JSON.parse(decoded);
          if (Array.isArray(parsed)) existingUsers = parsed;
          else if (Array.isArray(parsed?.users)) existingUsers = parsed.users;
        } catch (_) {}
      }

      const payload: Record<string, unknown> = {
        message: `chore: update site config [auto]`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify({
          users: existingUsers,
          __config__: {
            websiteTitle: updatedConfig.websiteTitle,
            logoBase64: updatedConfig.logoBase64,
            enableTitleAnimation: updatedConfig.enableTitleAnimation,
            theme: updatedConfig.theme,
            masterPasswordHash: updatedConfig.masterPasswordHash,
            whatsappNumbers: updatedConfig.whatsappNumbers,
            callNumbers: updatedConfig.callNumbers,
            customFloatingButtons: updatedConfig.customFloatingButtons,
            fieldsSchema: updatedConfig.fieldsSchema,
            localizationOverrides: updatedConfig.localizationOverrides,
            github: updatedConfig.github,
          }
        }, null, 2)))),
        branch: BRANCH,
      };
      if (currentSha) payload.sha = currentSha;

      await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('GitHub config push failed:', err);
    }
  };

  // 5B. SITE CUSTOMIZATION HANDLERS
  const handleSaveSiteCustomization = () => {
    // Optimistic UI: immediate update + background GitHub push
    const updatedConfig: AppConfig = {
      ...appConfig,
      websiteTitle: siteTitle.trim() || appConfig.websiteTitle,
      logoBase64: siteFaviconBase64,
      enableTitleAnimation: enableIconGlowSpin,
    };
    onUpdateConfig(updatedConfig);

    // Update browser title immediately
    if (siteTitle.trim()) {
      document.title = siteTitle.trim();
    }

    // Update favicon immediately if provided
    if (siteFaviconBase64) {
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = siteFaviconBase64;
      document.head.appendChild(link);
    }

    // Push to GitHub in background (Optimistic UI)
    pushConfigToGithub(updatedConfig);

    setSiteCustomMessage('✅ تم حفظ تخصيصات الموقع فوراً في المتصفح وجارٍ الرفع إلى جيت هاب...');
    setTimeout(() => setSiteCustomMessage(''), 3500);
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Compress to max 128×128 WebP before storing to keep data.json small
      const base64 = await compressImageToBase64(file, 128, 0.85);
      setSiteFaviconBase64(base64);
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = base64;
      document.head.appendChild(link);
    } catch {
      // Fallback: raw FileReader
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setSiteFaviconBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // 6. GITHUB REST PIPELINE HANDLERS
  const handleSaveGithubConfig = () => {
    // ✅ حفظ التوكن في localStorage بمفاتيح متعددة لضمان عدم الضياع
    if (ghToken.trim()) {
      localStorage.setItem('gh_token_fallback', ghToken.trim());
      localStorage.setItem('gh_token_primary',  ghToken.trim()); // مفتاح إضافي
    }
    const updatedConfig = {
      ...appConfig,
      websiteTitle,
      logoBase64,
      enableTitleAnimation,
      github: {
        token: ghToken.trim(),
        owner: ghOwner.trim(),
        repo: ghRepo.trim(),
        branch: ghBranch.trim(),
        dataPath: ghDataPath.trim(),
        configPath: ghConfigPath.trim(),
        isEnabled: ghEnabled,
      }
    };
    onUpdateConfig(updatedConfig);
    setGhMessage({ text: 'تمت كتابة التوكن والمستودع بنجاح، يمكنك تجربة الضغط على المزامنة الآن!', type: 'success' });
    setTimeout(() => setGhMessage({ text: '', type: 'success' }), 4000);
  };

  const triggerForceSync = async () => {
    setGhMessage({ text: 'جاري محاذاة ورفع الملفات والتأكد من عدم وجود تعارض...', type: 'success' });
    try {
      await onTriggerSync();
      setGhMessage({ text: 'رائع! تمت تصفية وتحديث جميع الحقول وقائمة الطلاب بنجاح في قاعدة البيانات السحابية (Complete)!', type: 'success' });
    } catch (err: any) {
      setGhMessage({ text: `فشل الاتصال: ${err?.message || 'تأكد من صلاحيات مفتاح الهوية (PAT)'}`, type: 'error' });
    }
    setTimeout(() => setGhMessage({ text: '', type: 'success' }), 5000);
  };

  // 7. SECURITY PASSWORD SYSTEM
  const handleSecurityPassUpdate = () => {
    
    if (!securityPassword.trim() || securityPassword !== confirmPassword) {
      setSecError('كلمتا المرور غير متطابقتين أو تحتوي حقولاً فارغة!');
      return;
    }
    onUpdateConfig({ ...appConfig, masterPasswordHash: securityPassword.trim() });
    setSecSuccess('تم تحديث الرقم السري لبوابة الإشراف وحفظ التعديلات أمنياً!');
    setSecurityPassword('');
    setConfirmPassword('');
    setSecError('');
    setTimeout(() => setSecSuccess(''), 3000);
  };

  // Gate Modal: Unauthorised Admin protection
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4" id="admin-lockscreen">
        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 text-right animate-in fade-in zoom-in duration-200" dir="rtl" id="settings-gate-card">
          <div className="p-6 text-center text-white flex flex-col items-center justify-center relative bg-slate-900" style={{ backgroundColor: themeColors.primary }}>
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-2.5">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-black">جهاز إدخال الهوية للمشرف</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">Admin Access Only · Restricted</p>
          </div>

          <div className="p-6 space-y-4" id="lockscreen-form">
            {authError && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-1.5" id="lockscreen-error">
                <AlertCircle size={14} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500">الرقم السري للمشرف</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuthClick()}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-center font-mono focus:ring-2 focus:ring-slate-800 transition text-slate-800 text-sm"
                autoFocus
                id="lockscreen-pass-input"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleAuthClick}
                className="flex-1 py-2.5 px-4 rounded-xl text-white font-bold transition text-xs cursor-pointer hover:opacity-90"
                style={{ backgroundColor: themeColors.primary }}
                id="lockscreen-submit"
              >
                دخول لوحة التحكم
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 font-bold border border-slate-200 hover:bg-slate-50 transition text-xs cursor-pointer"
                id="lockscreen-cancel"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4" id="admin-workspace-modal">
      <div className="bg-slate-50 rounded-3xl w-full max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in duration-200 text-right" dir="rtl" id="settings-admin-panel">
        
        {/* Title Navbar */}
        <header className="px-6 py-4 text-white flex items-center justify-between shadow-md shrink-0 select-none bg-slate-900" style={{ backgroundColor: themeColors.primary }} id="settings-header">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition duration-150 text-slate-100 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              id="admin-logout-btn"
            >
              <LogOut size={13} />
              <span>خروج المشرف</span>
            </button>
          </div>

          <div className="text-center">
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2 justify-center">
              <Settings className="w-5 h-5 animate-spin-slow" />
              منصة التحكم وإدارة استمارات الطلاب (CMS)
            </h2>
            <p className="text-[9px] text-slate-300">ADMIN CONTROL CENTER & COMPONENT MANAGER</p>
          </div>

          <div>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition duration-150 text-white cursor-pointer"
              id="admin-close-panel-btn"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Sync Status Overlay Indicator */}
        <div className="bg-white px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs font-semibold gap-2 shrink-0 text-slate-600" id="admin-sync-bar">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncStatus === 'syncing' ? 'bg-amber-400' : syncStatus === 'transient_fail' ? 'bg-orange-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${syncStatus === 'syncing' ? 'bg-amber-500' : syncStatus === 'transient_fail' ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-slate-600">شبكة الاتصال السحابي (GitHub Stream API):</span>
            <span className={`font-black ${syncStatus === 'syncing' ? 'text-amber-500' : syncStatus === 'success' ? 'text-emerald-500' : syncStatus === 'error' ? 'text-rose-500' : syncStatus === 'transient_fail' ? 'text-orange-500' : 'text-slate-600'}`}>
              {syncStatus === 'syncing' && 'جاري محاذاة ورفع المرفقات...'}
              {syncStatus === 'success' && 'محدث ومُزامن بالكامل مع جيت هاب!'}
              {syncStatus === 'error' && 'خطأ في الـ Token — تحقق من إعدادات GitHub'}
              {syncStatus === 'transient_fail' && 'تأخر في الاتصال بـ GitHub — البيانات محفوظة محلياً ✓ (اضغط مزامنة للمحاولة)'}
              {syncStatus === 'idle' && 'جاهز / تخزين محلي وتلقائي'}
            </span>
          </div>

          <button
            onClick={triggerForceSync}
            disabled={syncStatus === 'syncing'}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 cursor-pointer text-[10px] font-bold"
            id="admin-sync-trigger-btn"
          >
            <RefreshCw size={11} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            مزامنة السحابة الإجبارية الفورية
          </button>
        </div>

        {/* Main Dashboard Space split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden" id="admin-workspace-grid">
          
          {/* Right Columns Navigation sidebar tabs */}
          <nav className="w-full md:w-52 bg-white border-l border-slate-200 flex flex-row md:flex-col p-2 gap-1 overflow-x-auto md:overflow-x-visible shrink-0 select-none" id="admin-tabs">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'inbox' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'inbox' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-inbox"
            >
              <Users size={14} />
              <span>صندوق الوارد ({(users || []).length})</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'database' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'database' ? { backgroundColor: '#0d9488' } : {}}
              id="tab-database"
            >
              <Eye size={14} />
              <span>قاعدة البيانات الحية</span>
            </button>

            <button
              onClick={() => setActiveTab('installations')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'installations' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'installations' ? { backgroundColor: '#d97706' } : {}}
              id="tab-installations"
            >
              <Wrench size={14} />
              <span>صندوق التركيبات ({installations.reduce((s,r)=>s+(r.installationsCount||0),0)})</span>
            </button>

            <button
              onClick={() => setActiveTab('installSchema')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'installSchema' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'installSchema' ? { backgroundColor: '#7c3aed' } : {}}
              id="tab-installSchema"
            >
              <Package size={14} />
              <span>حقول التركيبات</span>
            </button>

            <button
              onClick={() => setActiveTab('schema')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'schema' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'schema' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-schema"
            >
              <Sliders size={14} />
              <span>المحاذاة ومصمم الاستمارة</span>
            </button>

            <button
              onClick={() => setActiveTab('localization')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'localization' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'localization' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-localization"
            >
              <Languages size={14} />
              <span>توطين وتثبيت العبارات</span>
            </button>

            <button
              onClick={() => setActiveTab('contacts')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'contacts' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'contacts' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-contacts"
            >
              <PhoneCall size={14} />
              <span>أرقام الأقراص الطافية</span>
            </button>

            <button
              onClick={() => setActiveTab('theme')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'theme' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'theme' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-theme"
            >
              <Palette size={14} />
              <span>تخصيص الهوية البصرية</span>
            </button>

            {/* ── NEW SITE CUSTOMIZATION TAB ── */}
            <button
              onClick={() => setActiveTab('site')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'site' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'site' ? { backgroundColor: '#7c3aed' } : {}}
              id="tab-site"
            >
              <Monitor size={14} />
              <span>مظهر الموقع (Site)</span>
            </button>

            <button
              onClick={() => setActiveTab('github')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'github' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'github' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-github"
            >
              <Github size={14} />
              <span>إعدادات الاتصال بالسحابة</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition duration-150 whitespace-nowrap cursor-pointer ${activeTab === 'security' ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              style={activeTab === 'security' ? { backgroundColor: themeColors.primary } : {}}
              id="tab-security"
            >
              <KeyRound size={14} />
              <span>الأمان والرمز السري</span>
            </button>
          </nav>

          {/* Tab Content Display */}
          <main className="flex-1 p-4 sm:p-5 overflow-y-auto" id="admin-workspace-body">
            
            {/* ====== TAB 1: INBOX REGISTERED GRID ====== */}
            {activeTab === 'inbox' && (
              <div className="space-y-4 text-right" id="tab-inbox-workspace">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800">صندوق الوارد وإدارة المسجلين</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">جدول عالي الكثافة لعرض تفاصيل المتقدمين واستخراج الطلبات وإجراء التعديلات والPurge.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handlePurgeAll}
                      disabled={(users || []).length === 0}
                      className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-rose-100 transition cursor-pointer flex items-center gap-1 shrink-0"
                      id="purge-all-btn"
                    >
                      <Trash2 size={13} />
                      تطهير كافة البيانات (Purge)
                    </button>

                    <button
                      onClick={() => exportToExcel(users)}
                      disabled={(users || []).length === 0}
                      className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-indigo-100 transition cursor-pointer flex items-center gap-1 shrink-0"
                      id="export-excel-inbox-btn"
                    >
                      <FileDown size={13} />
                      تصدير Excel
                    </button>

                    <button
                      onClick={() => exportToWord(users)}
                      disabled={(users || []).length === 0}
                      className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-blue-100 transition cursor-pointer flex items-center gap-1 shrink-0"
                      id="export-word-inbox-btn"
                    >
                      <FileDown size={13} />
                      تصدير Word
                    </button>

                    <div className="relative w-full sm:w-56" id="inbox-search">
                      <Search className="absolute right-3.5 top-2.5 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="ابحث بالاسم، الموبايل..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pr-9 pl-3.5 py-1.5 border border-slate-200 outline-none rounded-xl text-xs focus:border-slate-800 bg-white text-slate-700 font-sans"
                        id="inbox-search-input"
                      />
                    </div>
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 font-sans" id="inbox-empty">
                    <Users size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-bold">صندوق الاستمارات فارغ!</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto" id="inbox-table-card">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold select-none">
                            <th className="p-3 text-center">المستندات (4 صور)</th>
                            <th className="p-3">الاسم بالكامل</th>
                            <th className="p-3">رقم الهاتف</th>
                            <th className="p-3">العمر وتاريخ الميلاد</th>
                            <th className="p-3 text-center font-sans uppercase">Action Grid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                          {currentUsers.map((u) => {
                            const availablePhotosCount = [u.personalPhoto || u.idPhoto, u.nationalIdFront, u.nationalIdBack, u.birthCertificate].filter(Boolean).length;
                            return (
                              <tr key={u.id} className="hover:bg-slate-50/50 transition">
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => setFocusedUser(u)}
                                    className="px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 transition font-bold"
                                  >
                                    معاينة الصور ({availablePhotosCount}/4)
                                  </button>
                                </td>
                                <td className="p-3 font-bold text-slate-900">
                                  {u.fullName} {u.lastName}
                                  <p className="text-[9px] text-slate-400 font-normal">اسم الأب: {u.fatherName}</p>
                                </td>
                                <td className="p-3 font-mono text-left select-all" style={{ direction: 'ltr' }}>{u.phone}</td>
                                <td className="p-3 text-slate-600">
                                  {u.age} سنة <span className="text-[9px] text-slate-400 block">{u.dob}</span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => setFocusedUser(u)}
                                      className="p-1.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                                      title="عرض المستند والخيارات"
                                    >
                                      <Eye size={12} />
                                    </button>

                                    <div className="relative">
                                      <button
                                        onClick={() => setActiveExportDropdown(activeExportDropdown === u.id ? null : u.id)}
                                        className="p-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition cursor-pointer flex items-center gap-1 font-bold"
                                        title="خيارات تصدير الاستمارة"
                                      >
                                        <FileDown size={12} />
                                        <span className="text-[10px] font-sans">تصدير</span>
                                      </button>
                                      
                                      {activeExportDropdown === u.id && (
                                        <>
                                          <div className="fixed inset-0 z-30" onClick={() => setActiveExportDropdown(null)} />
                                          <div className="absolute left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-40 text-right font-sans divide-y divide-slate-50 animate-in fade-in slide-in-from-top-1 duration-100">
                                            <button
                                              onClick={() => {
                                                printUserProfile(u, appConfig.websiteTitle);
                                                setActiveExportDropdown(null);
                                              }}
                                              className="w-full px-3.5 py-1.5 text-[10px] text-emerald-700 hover:bg-emerald-50 transition flex items-center justify-between font-bold"
                                            >
                                              <span>تصدير كـ PDF رسمي (طباعة)</span>
                                              <Printer size={11} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                exportProfileAsHTML2Canvas(u, themeColors, appConfig.websiteTitle);
                                                setActiveExportDropdown(null);
                                              }}
                                              className="w-full px-3.5 py-1.5 text-[10px] text-blue-700 hover:bg-blue-50 transition flex items-center justify-between font-bold"
                                            >
                                              <span>تحميل كـ صورة PNG (عالي الدقة)</span>
                                              <FileDown size={11} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                exportProfileAsPNG(u, themeColors, appConfig.websiteTitle);
                                                setActiveExportDropdown(null);
                                              }}
                                              className="w-full px-3.5 py-1.5 text-[10px] text-slate-700 hover:bg-slate-50 transition flex items-center justify-between font-bold"
                                            >
                                              <span>بطاقة نيون كلاسيك (Canvas)</span>
                                              <Palette size={11} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                import('../utils/clientZipExport').then(m => m.downloadUserZip(u, appConfig.websiteTitle, appConfig.logoBase64));
                                                setActiveExportDropdown(null);
                                              }}
                                              className="w-full px-3.5 py-1.5 text-[10px] text-violet-700 hover:bg-violet-50 transition flex items-center justify-between font-bold"
                                            >
                                              <span>تحميل ملف ZIP شامل (صور + تقارير)</span>
                                              <Archive size={11} />
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => setEditingUser(u)}
                                      className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                                      title="تعديل يدوي للبيانات"
                                    >
                                      <Edit2 size={12} />
                                    </button>

                                    <button
                                      onClick={() => handleDeleteUserDirect(u.id, u.fullName)}
                                      className="p-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                                      title="حذف الاستمارة"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-3" id="inbox-pagination">
                      <div className="text-[10px] text-slate-500 font-sans">
                        عرض الصفحة {currentPage} من أصل {totalPages} (إجمالي {filteredUsers.length} استمارة)
                      </div>
                      <div className="flex items-center gap-1 select-none">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronLeft size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ====== TAB 2: LIVE DATABASE CONSOLE ====== */}
            {activeTab === 'database' && (() => {
              const dbFiltered = (users || []).filter((u) => {
                const q = dbSearchQuery.toLowerCase().trim();
                const genderOk = dbGenderFilter === 'all' || u.gender === dbGenderFilter;
                if (!q) return genderOk;
                return genderOk && (
                  u.fullName.toLowerCase().includes(q) ||
                  u.fatherName.toLowerCase().includes(q) ||
                  u.lastName.toLowerCase().includes(q) ||
                  u.phone.includes(q) ||
                  u.streetAddress.toLowerCase().includes(q) ||
                  u.schoolOrUniversity?.toLowerCase().includes(q) ||
                  u.nationality?.toLowerCase().includes(q) ||
                  (u.equipmentUsed || '').toLowerCase().includes(q)
                );
              });
              const dbTotalPages = Math.max(1, Math.ceil(dbFiltered.length / dbItemsPerPage));
              const dbSlice = dbFiltered.slice((dbCurrentPage - 1) * dbItemsPerPage, dbCurrentPage * dbItemsPerPage);
              const maleCount = (users || []).filter(u => u.gender === 'Male').length;
              const femaleCount = (users || []).filter(u => u.gender === 'Female').length;
              const withPhotos = (users || []).filter(u => u.personalPhoto || u.idPhoto).length;
              const today = new Date().toDateString();
              const todayCount = (users || []).filter(u => u.createdAt && new Date(u.createdAt).toDateString() === today).length;

              return (
                <div className="space-y-4 text-right" id="tab-database-workspace">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                        </span>
                        قاعدة البيانات الحية — LIVE DATABASE CONSOLE
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {appConfig.localizationOverrides?.['publicTableTitle'] || 'بيانات التسجيل والسجلات النشطة'} • تحديث فوري • مُصدِّر متعدد الصيغ
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="db-stats-grid">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-right">
                      <p className="text-2xl font-black text-slate-800">{(users || []).length}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">إجمالي المسجلين</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-3 text-right">
                      <p className="text-2xl font-black text-blue-700">{maleCount}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">ذكور / Males</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-3 text-right">
                      <p className="text-2xl font-black text-pink-600">{femaleCount}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">إناث / Females</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-teal-100 shadow-sm p-3 text-right">
                      <p className="text-2xl font-black text-teal-600">{todayCount}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">تسجيل اليوم</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-3 text-right sm:col-span-2">
                      <p className="text-2xl font-black text-amber-600">{withPhotos}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">يمتلكون صور مرفقة</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 text-right sm:col-span-2">
                      <p className="text-2xl font-black text-slate-500">{(users || []).length - withPhotos}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">بدون صور</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3" id="db-export-toolbar">
                    <p className="text-[10px] font-black text-slate-500 mb-2">تصدير قاعدة البيانات الكاملة — All Formats Export:</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => exportToCSV(users)} disabled={(users || []).length === 0} className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-emerald-100 transition cursor-pointer flex items-center gap-1.5">
                        <FileDown size={12} />CSV
                      </button>
                      <button onClick={() => exportToExcel(users)} disabled={(users || []).length === 0} className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-indigo-100 transition cursor-pointer flex items-center gap-1.5">
                        <FileDown size={12} />Excel
                      </button>
                      <button onClick={() => exportToWord(users)} disabled={(users || []).length === 0} className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-blue-100 transition cursor-pointer flex items-center gap-1.5">
                        <FileDown size={12} />Word
                      </button>
                      <button onClick={() => exportToImage(users, appConfig.websiteTitle)} disabled={(users || []).length === 0} className="px-3 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-teal-100 transition cursor-pointer flex items-center gap-1.5">
                        <Printer size={12} />PDF / صورة
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2">CSV: جدول نصي خام • Excel: جدول محسوب منسق • Word: ملف أرشيفي رسمي • PDF/صورة: تقرير مرئي قابل للطباعة</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-3" id="db-search-filter-row">
                    <div className="relative flex-1 min-w-48">
                      <Search className="absolute right-3 top-2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="بحث سريع بالاسم، الهاتف، العنوان، المدرسة..."
                        value={dbSearchQuery}
                        onChange={(e) => { setDbSearchQuery(e.target.value); setDbCurrentPage(1); }}
                        className="w-full pr-9 pl-3 py-1.5 border border-slate-200 outline-none rounded-xl text-xs focus:border-teal-500 bg-slate-50 text-slate-700 font-sans"
                      />
                    </div>
                    <select
                      value={dbGenderFilter}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setDbGenderFilter(e.target.value as 'all' | 'Male' | 'Female'); setDbCurrentPage(1); }}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-slate-50 text-slate-700"
                    >
                      <option value="all">كل الجنسين</option>
                      <option value="Male">ذكور فقط</option>
                      <option value="Female">إناث فقط</option>
                    </select>
                    {(dbSearchQuery || dbGenderFilter !== 'all') && (
                      <button
                        onClick={() => { setDbSearchQuery(''); setDbGenderFilter('all'); setDbCurrentPage(1); }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <X size={12} /> مسح الفلترة
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400 mr-auto">نتائج: {dbFiltered.length} سجل</span>
                  </div>

                  {dbFiltered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 font-sans">
                      <Users size={40} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-bold">لا توجد سجلات مطابقة!</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead>
                            <tr className="bg-gradient-to-l from-teal-900 to-slate-900 text-white font-bold select-none">
                              <th className="p-3 text-center">#</th>
                              <th className="p-3">الاسم الكامل</th>
                              <th className="p-3">اسم الأب</th>
                              <th className="p-3">رقم الهاتف</th>
                              <th className="p-3">العمر</th>
                              <th className="p-3">الجنس</th>
                              <th className="p-3">المدرسة/الجامعة</th>
                              <th className="p-3">العنوان</th>
                              <th className="p-3">الجنسية</th>
                              <th className="p-3">العُدَد</th>
                              <th className="p-3">الصور</th>
                              <th className="p-3">تاريخ التسجيل</th>
                              <th className="p-3 text-center">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                            {dbSlice.map((u, i) => {
                              const photosCount = [u.personalPhoto || u.idPhoto, u.nationalIdFront, u.nationalIdBack, u.birthCertificate].filter(Boolean).length;
                              const rowNum = (dbCurrentPage - 1) * dbItemsPerPage + i + 1;
                              return (
                                <tr key={u.id} className="hover:bg-teal-50/30 transition">
                                  <td className="p-3 text-center text-slate-400 font-mono text-[10px]">{rowNum}</td>
                                  <td className="p-3">
                                    <p className="font-bold text-slate-900">{u.fullName} {u.lastName}</p>
                                    <p className="text-[9px] text-slate-400 font-mono select-all">{u.id}</p>
                                  </td>
                                  <td className="p-3 text-slate-600">{u.fatherName}</td>
                                  <td className="p-3 font-mono text-left select-all" style={{ direction: 'ltr' }}>{u.phone}</td>
                                  <td className="p-3 text-center">{u.age}</td>
                                  <td className="p-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${u.gender === 'Male' ? 'bg-blue-50 text-blue-700' : u.gender === 'Female' ? 'bg-pink-50 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>
                                      {u.gender === 'Male' ? 'ذكر' : u.gender === 'Female' ? 'أنثى' : '-'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-slate-500 max-w-[120px] truncate">{u.schoolOrUniversity || '-'}</td>
                                  <td className="p-3 text-slate-500 max-w-[140px] truncate">{u.streetAddress}</td>
                                  <td className="p-3 text-slate-500">{u.nationality || '-'}</td>
                                  <td className="p-3 text-slate-500">{u.equipmentUsed ? <span className="font-bold text-teal-700">{u.equipmentUsed} ({u.equipmentQuantity ?? '-'})</span> : '-'}</td>
                                  <td className="p-3 text-center">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${photosCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                      {photosCount}/4
                                    </span>
                                  </td>
                                  <td className="p-3 text-[10px] text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : '-'}</td>
                                  <td className="p-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => setFocusedUser(u)} className="p-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-200 hover:bg-teal-100 transition cursor-pointer" title="عرض التفاصيل">
                                        <Eye size={11} />
                                      </button>
                                      <button onClick={() => setEditingUser(u)} className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-100 transition cursor-pointer" title="تعديل">
                                        <Edit2 size={11} />
                                      </button>
                                      <button onClick={() => handleDeleteUserDirect(u.id, u.fullName)} className="p-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-100 transition cursor-pointer" title="حذف">
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                        <div className="text-[10px] text-slate-500 font-sans">
                          صفحة {dbCurrentPage} من {dbTotalPages} • إجمالي {dbFiltered.length} سجل (من {(users || []).length})
                        </div>
                        <div className="flex items-center gap-1 select-none">
                          <button onClick={() => setDbCurrentPage(1)} disabled={dbCurrentPage === 1} className="px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-[10px] font-bold">أول</button>
                          <button onClick={() => setDbCurrentPage(p => Math.max(1, p - 1))} disabled={dbCurrentPage === 1} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer">
                            <ChevronRight size={14} />
                          </button>
                          <span className="px-2 py-1 text-[10px] font-bold text-slate-600">{dbCurrentPage}</span>
                          <button onClick={() => setDbCurrentPage(p => Math.min(dbTotalPages, p + 1))} disabled={dbCurrentPage === dbTotalPages} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer">
                            <ChevronLeft size={14} />
                          </button>
                          <button onClick={() => setDbCurrentPage(dbTotalPages)} disabled={dbCurrentPage === dbTotalPages} className="px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-[10px] font-bold">آخر</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* ══ TAB: INSTALLATIONS ══ */}
            {activeTab === 'installations' && (
              <div className="space-y-4 text-right">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><Wrench size={16} className="text-amber-600" />صندوق التركيبات الإداري</h3>
                    <p className="text-[10px] text-slate-400">إجمالي التركيبات: {installations.reduce((s, r) => s + (r.installationsCount || 0), 0)} تركيبة</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600">سعر التركيبة:</label>
                    <input type="number" value={installPrice} onChange={e => setInstallPrice(Number(e.target.value))}
                      className="w-20 px-2 py-1 border border-amber-200 rounded-lg text-xs font-bold text-amber-700 outline-none text-center" min={0} />
                    <span className="text-xs text-slate-500">ج</span>
                    <button onClick={handleSaveInstallPrice} className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 cursor-pointer">حفظ</button>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'list' as const, label: 'قائمة التركيبات', icon: <FileText size={12} /> },
                    { id: 'workers' as const, label: 'تجميع العمال', icon: <UserCheck size={12} /> },
                    { id: 'accounting' as const, label: 'الحسابات', icon: <Calculator size={12} /> },
                  ].map(t => (
                    <button key={t.id} onClick={() => setInstallTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${installTab === t.id ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {t.icon}{t.label}
                    </button>
                  ))}
                  <button onClick={() => exportInstallationsToCSV(installations)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 cursor-pointer transition ml-auto">
                    <Download size={12} />تصدير CSV
                  </button>
                  <button onClick={() => exportInstallationsToPDF(installations as InstallationExportRecord[], undefined, installPrice, appConfig.websiteTitle)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 cursor-pointer transition">
                    <FileText size={12} />PDF
                  </button>
                  <button onClick={() => exportInstallationsToExcel(installations as InstallationExportRecord[], undefined, installPrice)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 cursor-pointer transition">
                    <BarChart2 size={12} />Excel
                  </button>
                  <button onClick={() => exportInstallationsToWord(installations as InstallationExportRecord[], undefined, installPrice, appConfig.websiteTitle)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 cursor-pointer transition">
                    <FileDown size={12} />Word
                  </button>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute right-3 top-3 text-slate-400" />
                  <input value={installSearch} onChange={e => setInstallSearch(e.target.value)}
                    placeholder="بحث في التركيبات..." className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none" />
                </div>

                {installTab === 'list' && (
                  <div className="space-y-2">
                    {filteredInstalls.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-sm">لا توجد تركيبات</div>
                    ) : filteredInstalls.map(inst => (
                      <div key={inst.id} className="bg-white border border-amber-100 rounded-2xl p-4 hover:shadow-sm transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-800">{inst.workerName}</span>
                              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100">{inst.installationsCount} تركيبة</span>
                              {inst.isPaid && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">✓ مدفوع</span>}
                            </div>
                            <div className="text-[10px] text-slate-600 mt-1">{inst.clientName} · {inst.clientMobile} · {inst.area}</div>
                            {inst.notes && <div className="text-[10px] text-slate-400 mt-0.5 italic">{inst.notes}</div>}
                            <div className="text-[9px] text-slate-300 mt-0.5">{new Date(inst.createdAt).toLocaleDateString('ar-EG')}</div>
                          </div>
                          <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                            <DownloadZipButton
                              record={inst}
                              systemTitle={appConfig.websiteTitle}
                              logoBase64={appConfig.logoBase64}
                              size="sm"
                            />
                            <button onClick={() => setEditingInstall({...inst})} className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 cursor-pointer"><Edit2 size={12} /></button>
                            <button onClick={() => handleDeleteInstall(inst.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 cursor-pointer"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        {/* ── Media Strip: photos + video ── */}
                        {(inst.clientIdPhoto || inst.thermalPhoto || inst.boxPhoto || inst.mainBoxPhoto || inst.installationVideo) && (
                          <div className="flex gap-2 mt-2 flex-wrap items-end">
                            {/* صور */}
                            {([ 
                              { src: inst.clientIdPhoto,  label: 'بطاقة' },
                              { src: inst.thermalPhoto,   label: 'حرارة' },
                              { src: inst.boxPhoto,       label: 'بوكس' },
                              { src: inst.mainBoxPhoto,   label: 'البوكس الرئيسي' },
                            ] as { src?: string; label: string }[]).map(({ src, label }) =>
                              src ? (
                                <div key={label} className="relative group">
                                  <img
                                    src={src}
                                    alt={label}
                                    onClick={() => setLightboxPhoto(src)}
                                    className="w-12 h-10 rounded-lg object-cover cursor-zoom-in border border-slate-200 hover:opacity-90 transition"
                                  />
                                  <span className="absolute -bottom-4 left-0 right-0 text-center text-[8px] text-slate-400 font-bold opacity-0 group-hover:opacity-100 transition pointer-events-none">{label}</span>
                                </div>
                              ) : null
                            )}

                            {/* ── فيديو التركيبة ── */}
                            {inst.installationVideo && inst.installationVideo.startsWith('data:video') && (
                              <div className="relative group flex flex-col items-center gap-1">
                                {/* Thumbnail مصغّر قابل للضغط */}
                                <button
                                  type="button"
                                  onClick={() => setLightboxVideo(inst.installationVideo!)}
                                  className="w-14 h-10 rounded-lg bg-slate-800 flex flex-col items-center justify-center gap-0.5 cursor-pointer border border-slate-600 hover:bg-slate-700 transition relative overflow-hidden"
                                  title="تشغيل الفيديو"
                                >
                                  <Video size={14} className="text-amber-400" />
                                  <span className="text-[8px] text-slate-300 font-bold leading-none">فيديو</span>
                                  {/* Play overlay */}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                                    <div className="w-5 h-5 rounded-full bg-white/90 flex items-center justify-center">
                                      <span style={{ fontSize: 8, marginLeft: 1 }}>▶</span>
                                    </div>
                                  </div>
                                </button>

                                {/* زر تحميل الفيديو */}
                                <a
                                  href={inst.installationVideo}
                                  download={`video_${inst.clientName || inst.id}_${new Date(inst.createdAt).toLocaleDateString('ar-EG').replace(/\//g,'-')}.mp4`}
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition cursor-pointer"
                                  title="تحميل الفيديو"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <Download size={8} />تحميل
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {installTab === 'workers' && (
                  <div className="space-y-3">
                    {workerGroups.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">لا يوجد عمال حتى الآن</div>
                    ) : workerGroups.map(worker => (
                      <div key={worker.name} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="p-4 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                              <UserCheck size={18} className="text-amber-600" />
                            </div>
                            <div>
                              <div className="font-black text-slate-800 text-sm">{worker.name}</div>
                              <div className="text-[10px] text-slate-500">{worker.records.length} طلب · إجمالي: {worker.total} تركيبة · غير مدفوع: {worker.unpaid}</div>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => setSelectedWorker(selectedWorker === worker.name ? null : worker.name)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer flex items-center gap-1">
                              {selectedWorker === worker.name ? <ChevronUp size={12} /> : <ChevronDown size={12} />}التفاصيل
                            </button>
                            <button onClick={() => exportInstallationsToPrint(installations, worker.name, installPrice)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 cursor-pointer flex items-center gap-1">
                              <Printer size={12} />كشف حساب
                            </button>
                            <button onClick={() => exportInstallationsToCSV(installations, worker.name)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 cursor-pointer flex items-center gap-1">
                              <Download size={12} />CSV
                            </button>
                            <button onClick={() => exportInstallationsToPDF(installations as InstallationExportRecord[], worker.name, installPrice, appConfig.websiteTitle)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 cursor-pointer flex items-center gap-1">
                              <FileText size={12} />PDF
                            </button>
                            <button onClick={() => exportInstallationsToExcel(installations as InstallationExportRecord[], worker.name, installPrice)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 border border-teal-100 text-teal-600 hover:bg-teal-100 cursor-pointer flex items-center gap-1">
                              <BarChart2 size={12} />Excel
                            </button>
                            <button onClick={() => exportInstallationsToWord(installations as InstallationExportRecord[], worker.name, installPrice, appConfig.websiteTitle)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100 cursor-pointer flex items-center gap-1">
                              <FileDown size={12} />Word
                            </button>
                          </div>
                        </div>
                        {selectedWorker === worker.name && (
                          <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-1.5">
                            {worker.records.map(r => (
                              <div key={r.id} className="flex items-center justify-between bg-white rounded-xl p-2.5 text-xs border border-slate-100 gap-2 flex-wrap">
                                <div>
                                  <span className="font-bold text-slate-700">{r.clientName}</span>
                                  <span className="text-slate-400 mr-2">{r.area} · {r.installationsCount} تركيبة</span>
                                  {r.isPaid && <span className="text-emerald-500 mr-1 text-[9px]">✓ مدفوع</span>}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-300 text-[9px]">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</span>
                                  <DownloadZipButton
                                    record={r}
                                    systemTitle={appConfig.websiteTitle}
                                    logoBase64={appConfig.logoBase64}
                                    size="sm"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {installTab === 'accounting' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <h4 className="font-black text-amber-800 text-sm flex items-center gap-2 mb-1">
                        <DollarSign size={14} />السيستم الحسابي — تصفية الحسابات
                      </h4>
                      <p className="text-[10px] text-amber-600">سعر التركيبة الحالي: <strong>{installPrice} ج</strong></p>
                    </div>
                    {workerGroups.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">لا يوجد عمال حتى الآن</div>
                    ) : workerGroups.map(worker => {
                      const amount = worker.unpaid * installPrice;
                      return (
                        <div key={worker.name} className="bg-white border border-slate-200 rounded-2xl p-5">
                          <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                              <div className="font-black text-slate-800 text-sm">{worker.name}</div>
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-3 text-xs"><span className="text-slate-500">إجمالي التركيبات:</span><span className="font-bold text-slate-700">{worker.total}</span></div>
                                <div className="flex items-center gap-3 text-xs"><span className="text-slate-500">المدفوع:</span><span className="font-bold text-emerald-600">{worker.total - worker.unpaid}</span></div>
                                <div className="flex items-center gap-3 text-xs"><span className="text-slate-500">غير مدفوع:</span><span className="font-bold text-amber-600">{worker.unpaid}</span></div>
                                <div className="flex items-center gap-3 text-sm mt-2 pt-2 border-t border-slate-100">
                                  <span className="text-slate-600 font-bold">المبلغ المستحق:</span>
                                  <span className="font-black text-lg text-amber-700">{amount.toLocaleString('ar-EG')} ج</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button onClick={() => exportInstallationsToPrint(installations, worker.name, installPrice)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 cursor-pointer flex items-center gap-1.5">
                                <Printer size={12} />طباعة كشف الحساب
                              </button>
                              <button onClick={() => handleSettleWorker(worker.name)} disabled={worker.unpaid === 0}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                                <Check size={12} />تصفية الحساب وتصفير العداد
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {workerGroups.length > 0 && (
                      <div className="bg-slate-800 text-white rounded-2xl p-5">
                        <div className="text-xs text-slate-300 mb-1">إجمالي المستحقات لجميع العمال</div>
                        <div className="text-2xl font-black">{workerGroups.reduce((s,w)=>s+(w.unpaid*installPrice),0).toLocaleString('ar-EG')} ج</div>
                        <div className="text-[10px] text-slate-400 mt-1">{workerGroups.reduce((s,w)=>s+w.unpaid,0)} تركيبة غير مدفوعة × {installPrice} ج</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit Installation Modal */}
                {editingInstall && (
                  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingInstall(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
                      <h4 className="font-black text-slate-800">تعديل التركيبة</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editingInstall.clientName} onChange={e => setEditingInstall({...editingInstall, clientName: e.target.value})} placeholder="اسم العميل" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                        <input value={editingInstall.clientMobile} onChange={e => setEditingInstall({...editingInstall, clientMobile: e.target.value})} placeholder="موبايل" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                        <input value={editingInstall.area} onChange={e => setEditingInstall({...editingInstall, area: e.target.value})} placeholder="المنطقة" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none col-span-2" />
                        <input type="number" value={editingInstall.installationsCount} onChange={e => setEditingInstall({...editingInstall, installationsCount: Number(e.target.value)})} placeholder="عدد التركيبات" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" min={0} />
                        <textarea value={editingInstall.notes||''} onChange={e => setEditingInstall({...editingInstall, notes: e.target.value})} placeholder="ملحوظة" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none col-span-2 resize-none" rows={2} />
                      </div>

                      {/* ── إدارة فيديو التركيبة داخل التعديل ── */}
                      {editingInstall.installationVideo && editingInstall.installationVideo.startsWith('data:video') && (
                        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Video size={14} className="text-amber-600" />
                            <span className="text-xs font-bold text-slate-700">فيديو التركيبة مرفق</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setLightboxVideo(editingInstall.installationVideo!)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 transition cursor-pointer"
                            >
                              <Video size={10} />معاينة
                            </button>
                            <a
                              href={editingInstall.installationVideo}
                              download={`video_${editingInstall.clientName || editingInstall.id}.mp4`}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition cursor-pointer"
                              onClick={e => e.stopPropagation()}
                            >
                              <Download size={10} />تحميل
                            </a>
                            <button
                              type="button"
                              onClick={() => setEditingInstall({ ...editingInstall, installationVideo: undefined })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition cursor-pointer"
                            >
                              <Trash2 size={10} />حذف
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end mt-2">
                        <button onClick={() => setEditingInstall(null)} className="px-4 py-2 rounded-xl text-xs bg-slate-100 text-slate-600 cursor-pointer">إلغاء</button>
                        <button onClick={handleUpdateInstall} className="px-4 py-2 rounded-xl text-xs bg-amber-500 text-white font-bold cursor-pointer hover:bg-amber-600">حفظ التعديلات</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB: INSTALL FIELDS SCHEMA ══ */}
            {activeTab === 'installSchema' && (
              <div className="space-y-4 text-right">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><Package size={16} className="text-violet-600" />منشئ حقول التركيبات الديناميكي</h3>

                {/* ── إضافة حقل جديد ── */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black text-slate-700">إضافة حقل جديد لنموذج التركيبات</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newInstField.labelAr} onChange={e => setNewInstField(p => ({...p, labelAr: e.target.value}))}
                      placeholder="اسم الحقل بالعربية *" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none col-span-2" />
                    <select value={newInstField.type} onChange={e => setNewInstField(p => ({...p, type: e.target.value as InstallationFieldSchema['type']}))}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none">
                      <option value="text">نص</option>
                      <option value="number">رقم</option>
                      <option value="tel">هاتف</option>
                      <option value="select">قائمة اختيار</option>
                    </select>
                    {newInstField.type === 'select' && (
                      <input value={newInstField.optionsAr} onChange={e => setNewInstField(p => ({...p, optionsAr: e.target.value}))}
                        placeholder="خيارات مفصولة بفواصل" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setNewInstField(p => ({...p, required: !p.required}))}
                      className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer px-3 py-1.5 rounded-xl border transition ${newInstField.required ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {newInstField.required ? 'إجباري' : 'اختياري'}
                    </button>
                    <button onClick={handleAddInstallField} className="px-4 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 cursor-pointer flex items-center gap-1.5">
                      <PlusCircle size={12} />إضافة
                    </button>
                  </div>
                  {instFieldMsg && <div className="text-xs text-emerald-600 font-bold">{instFieldMsg}</div>}
                </div>

                {/* ── قائمة الحقول مع تعديل كامل ── */}
                <div className="space-y-2">
                  {installFieldSchema.map(field => (
                    <div key={field.id} className={`bg-white border rounded-2xl p-3 space-y-2 transition ${field.isEnabled ? 'border-violet-100' : 'border-slate-100 opacity-60'}`}>
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-700">{field.labelAr}</span>
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{field.type}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${field.required ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
                            {field.required ? 'إجباري' : 'اختياري'}
                          </span>
                        </div>
                        <div className="flex gap-1 items-center">
                          {/* Toggle enabled */}
                          <button onClick={() => {
                            const updated = installFieldSchema.map(f => f.id === field.id ? {...f, isEnabled: !f.isEnabled} : f);
                            setInstallFieldSchema(updated); onUpdateConfig({...appConfig, installationFieldsSchema: updated});
                          }} className="p-1.5 rounded-lg cursor-pointer" title={field.isEnabled ? 'تعطيل' : 'تفعيل'}>
                            {field.isEnabled ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} className="text-slate-400" />}
                          </button>
                          {/* Edit toggle */}
                          <button onClick={() => {
                            if (editingInstFieldId === field.id) { setEditingInstFieldId(null); setEditingInstFieldData({}); }
                            else { setEditingInstFieldId(field.id); setEditingInstFieldData({...field}); }
                          }} className={`p-1.5 rounded-lg cursor-pointer transition ${editingInstFieldId === field.id ? 'bg-violet-100 text-violet-600' : 'text-slate-400 hover:bg-slate-50'}`} title="تعديل">
                            <Edit2 size={13} />
                          </button>
                          {/* Delete */}
                          <button onClick={() => {
                            if (window.confirm('حذف الحقل نهائياً؟')) {
                              const updated = installFieldSchema.filter(f => f.id !== field.id);
                              setInstallFieldSchema(updated); onUpdateConfig({...appConfig, installationFieldsSchema: updated});
                            }
                          }} className="p-1.5 rounded-lg cursor-pointer text-rose-400 hover:bg-rose-50" title="حذف"><Trash2 size={13} /></button>
                        </div>
                      </div>

                      {/* Inline edit form */}
                      {editingInstFieldId === field.id && (
                        <div className="border-t border-slate-100 pt-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2 flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-500">اسم الحقل بالعربية</label>
                              <input value={editingInstFieldData.labelAr || ''} onChange={e => setEditingInstFieldData(p => ({...p, labelAr: e.target.value}))}
                                className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" placeholder="اسم الحقل بالعربية" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-500">نوع الحقل</label>
                              <select value={editingInstFieldData.type || 'text'} onChange={e => setEditingInstFieldData(p => ({...p, type: e.target.value as InstallationFieldSchema['type']}))}
                                className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none">
                                <option value="text">نص</option>
                                <option value="number">رقم</option>
                                <option value="tel">هاتف</option>
                                <option value="select">قائمة اختيار</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] font-bold text-slate-500">إجبارية الحقل</label>
                              <select value={editingInstFieldData.required ? 'true' : 'false'} onChange={e => setEditingInstFieldData(p => ({...p, required: e.target.value === 'true'}))}
                                className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none">
                                <option value="true">إجباري</option>
                                <option value="false">اختياري</option>
                              </select>
                            </div>
                            {(editingInstFieldData.type === 'select') && (
                              <div className="col-span-2 flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500">خيارات القائمة (مفصولة بفاصلة)</label>
                                <input value={editingInstFieldData.optionsAr || ''} onChange={e => setEditingInstFieldData(p => ({...p, optionsAr: e.target.value}))}
                                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" placeholder="خيار 1، خيار 2، خيار 3" />
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditingInstFieldId(null); setEditingInstFieldData({}); }}
                              className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer">إلغاء</button>
                            <button onClick={() => {
                              const updated = installFieldSchema.map(f => f.id === field.id ? {...f, ...editingInstFieldData} : f);
                              setInstallFieldSchema(updated);
                              onUpdateConfig({...appConfig, installationFieldsSchema: updated});
                              setEditingInstFieldId(null);
                              setEditingInstFieldData({});
                              setInstFieldMsg('تم حفظ التعديلات ✓');
                              setTimeout(() => setInstFieldMsg(''), 2500);
                            }} className="px-4 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 cursor-pointer flex items-center gap-1.5">
                              <Save size={12} />حفظ التعديل
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {installFieldSchema.length === 0 && <div className="text-center py-6 text-slate-400 text-xs">لا توجد حقول مخصصة حتى الآن</div>}
                </div>

                {/* ── تصدير حقول التركيبات ── */}
                {installFieldSchema.length > 0 && (
                  <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-violet-700 flex items-center gap-1.5"><Download size={13} />تصدير بيانات التركيبات</h4>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => exportInstallationsToPDF(installations as InstallationExportRecord[], undefined, installPrice, appConfig.websiteTitle)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer transition">
                        <FileText size={12} />تصدير PDF
                      </button>
                      <button onClick={() => exportInstallationsToExcel(installations as InstallationExportRecord[], undefined, installPrice)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 cursor-pointer transition">
                        <BarChart2 size={12} />تصدير Excel
                      </button>
                      <button onClick={() => exportInstallationsToWord(installations as InstallationExportRecord[], undefined, installPrice, appConfig.websiteTitle)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition">
                        <FileDown size={12} />تصدير Word
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ====== TAB 3: SCHEMA FORM BUILDERS (CMS) ====== */}
            {activeTab === 'schema' && (
              <div className="space-y-6 text-right" id="tab-schema-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-800">مصمم ومعدل بنية حقول الاستمارة (Schema Builder)</h3>
                  <p className="text-[10px] text-slate-400">يمكنك هنا حقن حقول جديدة في استمارة التسجيل ديناميكياً بدون المساس بالكود!</p>

                  {schemaMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>{schemaMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم المتغير في قاعدة البيانات (بالإنكليزية فريد)</label>
                      <input type="text" placeholder="مثال: city_select" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 font-mono" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم الحقل بالعربية (يظهر للجمهور)</label>
                      <input type="text" placeholder="مثال: اسم المحافظة" value={newFieldLabelAr} onChange={(e) => setNewFieldLabelAr(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم الحقل بالإنكليزية</label>
                      <input type="text" placeholder="مثال: Governorate" value={newFieldLabelEn} onChange={(e) => setNewFieldLabelEn(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">نوع الإدخال</label>
                      <select value={newFieldType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewFieldType(e.target.value as 'text' | 'number' | 'select' | 'tel' | 'date')} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700">
                        <option value="text">نص عادي / Text</option>
                        <option value="number">رقم عددي / Number</option>
                        <option value="tel">رقم هاتف / Tel</option>
                        <option value="date">تاريخ رزنامة / Date</option>
                        <option value="select">قائمة منسدلة / Dropdown Select</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">النص المساعد (Placeholder)</label>
                      <input type="text" placeholder="أدخل المحافظة..." value={newFieldPlaceholderAr} onChange={(e) => setNewFieldPlaceholderAr(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">خيارات القائمة المنسدلة (مفصولة بفاصلة ,)</label>
                      <input type="text" placeholder="القاهرة, الجيزة, المنصورة" value={newFieldOptionsAr} onChange={(e) => setNewFieldOptionsAr(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700" disabled={newFieldType !== 'select'} />
                    </div>
                    <div className="flex items-center gap-1.5 pt-4">
                      <input type="checkbox" id="field_required" checked={newFieldRequired} onChange={(e) => setNewFieldRequired(e.target.checked)} className="w-4 h-4 cursor-pointer text-slate-900 border-slate-300" />
                      <label htmlFor="field_required" className="text-xs font-bold text-slate-700 cursor-pointer select-none">حقل إلزامي التعبئة (Required)</label>
                    </div>
                  </div>

                  <button onClick={handleAddSchemaField} className="py-2 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer" style={{ backgroundColor: themeColors.primary }}>
                    <PlusCircle size={14} />
                    حقن وتضمين الحقل في الاستمارة فورياً
                  </button>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-slate-700">قائمة حقول الاستمارة (الافتراضية والمخصصة):</h4>
                  {fieldsSchemaList.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">لا توجد حقول حالياً بالاستمارة.</p>
                  ) : (
                    <div className="space-y-4">
                      {fieldsSchemaList.map((f) => (
                        <div key={f.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col gap-3">
                          <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-mono text-[10px]">{f.name}</span>
                              <span className="text-slate-400">|</span>
                              <span className="text-slate-500 text-[10px]">نوع الحقل: {f.type}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleUpdateSchemaFieldInline(f.id, { isEnabled: !f.isEnabled })} className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${f.isEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-600'}`}>
                                {f.isEnabled ? '● نشط بالاستمارة' : '○ معطل بالاستمارة'}
                              </button>
                              <button onClick={() => deleteSchemaField(f.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer" title="حذف الحقل">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-bold text-slate-400">اسم الحقل بالعربية</span>
                              <input type="text" value={f.labelAr} onChange={(e) => handleUpdateSchemaFieldInline(f.id, { labelAr: e.target.value })} className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs w-full bg-white text-slate-800" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-bold text-slate-400">اسم الحقل بالإنكليزية</span>
                              <input type="text" value={f.labelEn} onChange={(e) => handleUpdateSchemaFieldInline(f.id, { labelEn: e.target.value })} className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-[11px] font-mono text-left w-full bg-white text-slate-800" style={{ direction: 'ltr' }} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-bold text-slate-400">قاعدة التحقق (Validation)</span>
                              <select value={f.required ? "true" : "false"} onChange={(e) => handleUpdateSchemaFieldInline(f.id, { required: e.target.value === "true" })} className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 w-full">
                                <option value="true">إجباري / Required</option>
                                <option value="false">اختياري / Optional</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ====== TAB 4: LOCALIZATION OVERWRITES ====== */}
            {activeTab === 'localization' && (
              <div className="space-y-6 text-right" id="tab-localization-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-base font-black text-slate-800">توطين واستبدال نصوص ومصطلحات الموقع (Localization CMS)</h3>
                    <Languages className="text-slate-400 w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-slate-400">تتيح لك هذه المنصة إعادة كتابة وتغيير أي عبارة أو ترويسة تظهر للعموم على الموقع، بمرونة مطلقة وبدون تعديل سطر برمجي واحد!</p>

                  {locSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>{locSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-3.5 text-right">
                    {localizationKeys.map((item) => (
                      <div key={item.key} className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-700 flex justify-between">
                          <span>{item.label}</span>
                          <span className="font-mono text-[9px] text-slate-400">Tags: {item.key}</span>
                        </label>
                        <textarea
                          rows={1}
                          value={localizationMap[item.key] !== undefined ? localizationMap[item.key] : item.defaultVal}
                          onChange={(e) => handleLocMapChange(item.key, e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-slate-800 text-slate-800 font-sans"
                        />
                      </div>
                    ))}
                  </div>

                  <button onClick={handleSaveLocalizationOverrides} className="py-2.5 px-5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md hover:bg-opacity-95" style={{ backgroundColor: themeColors.primary }}>
                    <Save size={14} />
                    حفظ وتطبيق الكلمات الجديدة فورياً
                  </button>
                </div>
              </div>
            )}

            {/* ====== TAB 5: FLOATING PHONE/WHATSAPP MANAGEMENT ====== */}
            {activeTab === 'contacts' && (
              <div className="space-y-6 text-right" id="tab-contacts-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-800">أرقام التواصل والرد السريع</h3>
                  <p className="text-[10px] text-slate-400">تحكم بقائمة الأرقام والمسؤولين الذين تظهر محادثاتهم للمسجلين والطلاب بالأسفل.</p>

                  {contactMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={13} />
                      <span>{contactMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم المالك أو القسم</label>
                      <input type="text" placeholder="الأستاذ مصطفى / شؤون المسجلين" value={newContactLabel} onChange={(e) => setNewContactLabel(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">رقم الموبايل (الكود الدولي)</label>
                      <input type="text" placeholder="01091028501" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono bg-white text-slate-700" style={{ direction: 'ltr' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">قناة التواصل</label>
                      <select value={contactType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setContactType(e.target.value as 'whatsapp' | 'call')} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700">
                        <option value="whatsapp">محادثة واتساب / WhatsApp</option>
                        <option value="call">اتصال هاتفي مباشر / Direct Call</option>
                      </select>
                    </div>
                  </div>

                  <button onClick={addContactNumber} className="py-2.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-slate-950">
                    <Plus size={14} />
                    إدراج وحفظ الهاتف المساعد
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2.5">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      أرقام الواتساب النشطة:
                    </h5>
                    {whatsappList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">لا توجد أرقام مخصصة (تعتمد الواجهة الرقم الرئيسي: 01091028501).</p>
                    ) : (
                      <div className="space-y-1.5">
                        {whatsappList.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                            <div>
                              <p className="font-bold text-slate-700">{item.label}</p>
                              <p className="text-[10px] font-mono text-slate-400 select-all" style={{ direction: 'ltr' }}>{item.number}</p>
                            </div>
                            <button onClick={() => deleteContactNumber(item.id, 'whatsapp')} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2.5">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" style={{ backgroundColor: themeColors.primary }}></span>
                      أرقام الاتصال المباشر النشطة:
                    </h5>
                    {callList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">لا توجد أرقام مخصصة (تعتمد الواجهة الرقم الرئيسي: 01091028501).</p>
                    ) : (
                      <div className="space-y-1.5">
                        {callList.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                            <div>
                              <p className="font-bold text-slate-700">{item.label}</p>
                              <p className="text-[10px] font-mono text-slate-400 select-all" style={{ direction: 'ltr' }}>{item.number}</p>
                            </div>
                            <button onClick={() => deleteContactNumber(item.id, 'call')} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Floating Buttons section */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 mt-6 border-t-2 border-dashed border-slate-100">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                        <PlusCircle size={18} className="text-teal-600" />
                        إدارة أزرار التواصل العائمة والروابط الإضافية
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">أضف أي رابط أو منصة اجتماعية مخصصة (تليجرام، ماسنجر، موقعك الخاص) وتثبيته كزر طافٍ 3D.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex flex-col gap-1 col-span-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم أو تسمية الزر (ملاحظة)</label>
                      <input type="text" placeholder="قناتنا على تليجرام" value={newCustomLabel} onChange={(e) => setNewCustomLabel(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700" />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] font-bold text-slate-500">رابط توجيه الزر (URL بالتفصيل)</label>
                      <input type="url" placeholder="https://t.me/your_channel" value={newCustomUrl} onChange={(e) => setNewCustomUrl(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 text-left font-mono" style={{ direction: 'ltr' }} />
                    </div>
                    <div className="flex flex-col gap-1 col-span-1">
                      <label className="text-[10px] font-bold text-slate-500">شعار الأيقونة</label>
                      <select value={newCustomIcon} onChange={(e) => setNewCustomIcon(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 font-sans">
                        <option value="Send">طائرة ورقية تليجرام / Telegram (Send)</option>
                        <option value="MessageCircle">واتساب دردشة / WhatsApp</option>
                        <option value="Phone">سماعة اتصال هاتفى / Phone</option>
                        <option value="Globe">شعار ويب إنترنت / Globe</option>
                        <option value="Instagram">إنستجرام / Instagram</option>
                        <option value="Facebook">فيسبوك / Facebook</option>
                        <option value="Youtube">يوتيوب / Youtube</option>
                        <option value="Twitter">إكس جولد تويتر / Twitter (X)</option>
                        <option value="Info">أيقونة معلومات دائرية / Info</option>
                        <option value="Link">رابط دبوس ويب عام / Link</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 md:col-span-4 mt-1 border-t border-slate-200/50 pt-3 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                        <input type="checkbox" checked={newCustomIsFloating} onChange={(e) => setNewCustomIsFloating(e.target.checked)} className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer" />
                        <span>تثبيته كزر طافٍ منفصل 3D على الصفحة الرئيسية فوراً</span>
                      </label>
                      <div className="mr-auto flex gap-2">
                        {editingCustomId ? (
                          <>
                            <button onClick={saveEditCustomButton} className="py-1.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-md bg-teal-600 hover:bg-teal-700">
                              <Save size={12} />حفظ التعديل
                            </button>
                            <button onClick={cancelEditCustomButton} className="py-1.5 px-3 rounded-xl text-slate-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 bg-white hover:bg-slate-50">
                              <X size={12} />إلغاء
                            </button>
                          </>
                        ) : (
                          <button onClick={addCustomFloatingButton} className="py-1.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer bg-slate-950 hover:opacity-90">
                            <Plus size={12} />إدراج زر عائم مخصص
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-inner">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1 pb-1 border-b border-slate-50">قائمة أزرار التواصل المخصصة النشطة:</h5>
                    {customButtonsList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-4">لم تقم بإضافة أية أزرار تواصل أو روابط مخصصة بعد.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {customButtonsList.map((btn) => (
                          <div key={btn.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition text-xs">
                            <div className="space-y-1 overflow-hidden max-w-[70%]">
                              <p className="font-bold text-slate-700 flex items-center gap-1.5 truncate">
                                <span className="bg-white px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-slate-200 font-sans">{btn.icon}</span>
                                <span>{btn.label}</span>
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 truncate select-all" style={{ direction: 'ltr' }}>{btn.url}</p>
                              <div className="flex items-center gap-1 pt-0.5">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold ${btn.isFloating ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-slate-200/50 text-slate-500 border border-slate-200'}`}>
                                  {btn.isFloating ? 'زر طافٍ 3D نشط' : 'قائمة فرعية/مرتبط'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => toggleCustomFloatingState(btn.id)} className={`p-1.5 rounded-lg transition hover:bg-white text-xs font-bold ${btn.isFloating ? 'text-teal-600' : 'text-slate-400'}`} title="تغيير حالة ظهور الزر كزر طافٍ">
                                {btn.isFloating ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                              </button>
                              <button onClick={() => startEditCustomButton(btn)} className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg transition hover:bg-white" title="تعديل هذا الزر">
                                <Edit2 size={12} />
                              </button>
                              <button onClick={() => deleteCustomFloatingButton(btn.id)} className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg transition hover:bg-rose-50" title="حذف هذا الزر">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ====== TAB 6: GRAPHIC CUSTOMIZATION (THEME) ====== */}
            {activeTab === 'theme' && (
              <div className="space-y-6 text-right" id="tab-theme-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-1">
                    <Palette size={16} />
                    مطور وتنسيق السمة اللونية للسيستم
                  </h3>
                  <p className="text-[10px] text-slate-400">اختر من اللوحات الجاهزة أو اصنع طابعاً خاصاً بدمج تدرجات وأقطار الأزرار.</p>

                  {themeMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      <span>{themeMessage}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-500">القوالب والأمزجة المعدة مسبقاً (Presets):</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {colorPresets.map((p, idx) => (
                        <button key={idx} onClick={() => applyPresetTheme(p)} className="text-right p-3 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition flex flex-col justify-between cursor-pointer">
                          <span className="text-xs font-bold text-slate-800 block mb-2">{p.name}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full border shadow-sm block" style={{ backgroundColor: p.primary }}></span>
                            <span className="w-5 h-5 rounded-full border shadow-sm block" style={{ backgroundColor: p.secondary }}></span>
                            <span className="w-5 h-5 rounded-full border shadow-sm block" style={{ backgroundColor: p.accent }}></span>
                            <span className="w-5 h-5 rounded-full border shadow-sm block" style={{ backgroundColor: p.bgGradientStart }}></span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">اللون الأساسي للعلامة (Primary Headers)</label>
                      <input type="color" value={themeColors.primary} onChange={(e) => handleCustomColorInput('primary', e.target.value)} className="w-full h-8 cursor-pointer rounded-xl border border-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">اللون الثانوي للتفاصيل (Highlights)</label>
                      <input type="color" value={themeColors.secondary} onChange={(e) => handleCustomColorInput('secondary', e.target.value)} className="w-full h-8 cursor-pointer rounded-xl border border-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">لون الأزرار وزر الحفظ والأنشطة (Accent Action)</label>
                      <input type="color" value={themeColors.accent} onChange={(e) => handleCustomColorInput('accent', e.target.value)} className="w-full h-8 cursor-pointer rounded-xl border border-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">لون تدرج فريم الشاشة البادئ (Bg Gradient Start)</label>
                      <input type="color" value={themeColors.bgGradientStart} onChange={(e) => handleCustomColorInput('bgGradientStart', e.target.value)} className="w-full h-8 cursor-pointer rounded-xl border border-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">لون تدرج فريم الشاشة النهائي (Bg Gradient End)</label>
                      <input type="color" value={themeColors.bgGradientEnd} onChange={(e) => handleCustomColorInput('bgGradientEnd', e.target.value)} className="w-full h-8 cursor-pointer rounded-xl border border-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-500">مدى استدارة حواف القوالب والأزرار (Roundness)</label>
                      <select value={themeColors.borderRadius || 'rounded-xl'} onChange={(e) => handleCustomColorInput('borderRadius', e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700">
                        <option value="rounded-none">مربع حاد / Rounded None</option>
                        <option value="rounded-md">استدارة عادية / Rounded Md</option>
                        <option value="rounded-xl">شبه استدارة دائرية / Rounded Xl</option>
                        <option value="rounded-2xl">منحنيات ممتازة / Rounded 2Xl</option>
                        <option value="rounded-3xl">شكل بيضاوي فظ / Rounded 3Xl</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ====== TAB 7: SITE CUSTOMIZATION (NEW) ====== */}
            {activeTab === 'site' && (
              <div className="space-y-6 text-right" id="tab-site-workspace">
                {/* Inline CSS for glow+spin animation */}
                <style>{`
                  @keyframes neonGlowSpin {
                    0%   { transform: rotate(0deg);   filter: drop-shadow(0 0 6px #a855f7) drop-shadow(0 0 12px #6366f1); }
                    25%  { transform: rotate(90deg);  filter: drop-shadow(0 0 8px #ec4899) drop-shadow(0 0 16px #f43f5e); }
                    50%  { transform: rotate(180deg); filter: drop-shadow(0 0 10px #06b6d4) drop-shadow(0 0 20px #0ea5e9); }
                    75%  { transform: rotate(270deg); filter: drop-shadow(0 0 8px #10b981) drop-shadow(0 0 16px #84cc16); }
                    100% { transform: rotate(360deg); filter: drop-shadow(0 0 6px #a855f7) drop-shadow(0 0 12px #6366f1); }
                  }
                  .icon-glow-spin {
                    animation: neonGlowSpin 3s linear infinite;
                    transform-origin: center;
                  }
                  @keyframes neonPulseTitle {
                    0%, 100% { text-shadow: 0 0 8px #a855f7, 0 0 20px #6366f1, 0 0 40px #4f46e5; }
                    50%      { text-shadow: 0 0 16px #ec4899, 0 0 32px #f43f5e, 0 0 64px #e11d48; }
                  }
                  .title-neon-pulse {
                    animation: neonPulseTitle 2s ease-in-out infinite;
                  }
                `}</style>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Monitor size={18} className="text-violet-600" />
                    <div>
                      <h3 className="text-base font-black text-slate-800">تخصيص مظهر الموقع — Site Customization</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">تغيير اسم الموقع، الأيقونة (Favicon)، وتأثيرات الحركة — تُحفظ فوراً في data.json عبر GitHub Token</p>
                    </div>
                  </div>

                  {siteCustomMessage && (
                    <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 text-violet-800 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>{siteCustomMessage}</span>
                    </div>
                  )}

                  {/* 1. Website Title */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-violet-500" />
                      <label className="text-sm font-black text-slate-800">اسم الموقع (Website Title)</label>
                    </div>
                    <p className="text-[10px] text-slate-400 mr-5">يظهر في تبويب المتصفح وفي الهيدر الرئيسي للموقع — يُحدَّث فورياً عند الحفظ.</p>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={siteTitle}
                        onChange={(e) => setSiteTitle(e.target.value)}
                        placeholder="مثال: Group M — منظومة التسجيل"
                        className="flex-1 px-4 py-2.5 border border-violet-200 rounded-xl text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 text-slate-800 font-bold bg-white transition"
                      />
                      {enableIconGlowSpin && siteTitle && (
                        <span className="text-xs font-black text-violet-600 title-neon-pulse px-3 py-1 rounded-xl bg-violet-50 border border-violet-100 whitespace-nowrap">
                          {siteTitle}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400">الحالي المحفوظ: <span className="font-bold text-slate-600">{appConfig.websiteTitle}</span></p>
                  </div>

                  {/* 2. Favicon / Logo Upload */}
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2">
                      <Image size={15} className="text-violet-500" />
                      <label className="text-sm font-black text-slate-800">أيقونة الموقع (Favicon / Logo)</label>
                    </div>
                    <p className="text-[10px] text-slate-400 mr-5">ارفع أيقونة PNG أو SVG لتظهر في التبويب والهيدر. يُوصى بحجم 64×64 بكسل على الأقل.</p>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border border-violet-100 bg-violet-50/30">
                      {/* Preview */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-violet-300 flex items-center justify-center bg-white overflow-hidden">
                          {siteFaviconBase64 ? (
                            <img
                              src={siteFaviconBase64}
                              alt="Favicon Preview"
                              loading="lazy"
                              className={`w-12 h-12 object-contain ${enableIconGlowSpin ? 'icon-glow-spin' : ''}`}
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400 text-center font-bold leading-tight">لا توجد<br/>أيقونة</span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold">معاينة الأيقونة</span>
                        {enableIconGlowSpin && siteFaviconBase64 && (
                          <span className="text-[8px] text-violet-600 font-black bg-violet-100 px-1.5 py-0.5 rounded-full animate-pulse">✨ Glow + Spin</span>
                        )}
                      </div>

                      {/* Upload Controls */}
                      <div className="flex-1 space-y-2">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                          onChange={handleFaviconUpload}
                          className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-violet-600 file:text-white hover:file:bg-violet-700 cursor-pointer"
                        />
                        <p className="text-[9px] text-slate-400">يدعم: PNG, JPG, SVG, WEBP • حجم موصى به: 64×64px أو 128×128px • سيتم ضغط الصور تلقائياً (Lazy Compress)</p>
                        {siteFaviconBase64 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSiteFaviconBase64('');
                              // Remove favicon from browser
                              const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
                              if (link) link.href = '/favicon.ico';
                            }}
                            className="text-[10px] text-rose-500 font-bold hover:underline flex items-center gap-1"
                          >
                            <Trash2 size={11} />
                            إزالة الأيقونة الحالية وإعادة تعيين الافتراضي
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. Glow + Spin Animation Toggle */}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap size={15} className="text-violet-500" />
                      <label className="text-sm font-black text-slate-800">تأثير الحركة الإبداعية (Creative Motion Effect)</label>
                    </div>
                    <p className="text-[10px] text-slate-400 mr-5">عند التفعيل، تبدأ الأيقونة في الدوران المستمر بهالة ضوئية نيون RGB ملونة (Neon Glow + Infinite Rotation) — CSS متطور 100%.</p>

                    <div className="flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 bg-white"
                      style={{ borderColor: enableIconGlowSpin ? '#7c3aed' : '#e2e8f0' }}>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                          {enableIconGlowSpin && <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-ping"></span>}
                          الأيقونة "بتلف وتنوّر" (Glowing & Rotating)
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {enableIconGlowSpin
                            ? '✅ تأثير Neon Glow + Infinite Rotation مُفعَّل الآن على الأيقونة'
                            : '⭕ التأثير معطَّل حالياً — فعّله لمنح موقعك طابعاً حيوياً ومبهراً'}
                        </p>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => setEnableIconGlowSpin(prev => !prev)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none cursor-pointer shrink-0 ${enableIconGlowSpin ? 'bg-violet-600' : 'bg-slate-300'}`}
                        role="switch"
                        aria-checked={enableIconGlowSpin}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${enableIconGlowSpin ? '-translate-x-8' : '-translate-x-1'}`}
                          style={{ marginLeft: enableIconGlowSpin ? undefined : '4px', transform: enableIconGlowSpin ? 'translateX(32px)' : 'translateX(4px)' }}
                        />
                      </button>
                    </div>

                    {/* Live Demo */}
                    {enableIconGlowSpin && (
                      <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950 border border-violet-900/50 animate-in fade-in duration-300">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                          {siteFaviconBase64 ? (
                            <img src={siteFaviconBase64} alt="Live preview" className="w-8 h-8 object-contain icon-glow-spin" loading="lazy" />
                          ) : (
                            <Settings size={20} className="text-violet-400 icon-glow-spin" />
                          )}
                        </div>
                        <div>
                          <p className={`text-sm font-black text-white ${enableIconGlowSpin ? 'title-neon-pulse' : ''}`}>{siteTitle || appConfig.websiteTitle}</p>
                          <p className="text-[9px] text-slate-400">معاينة حية للهيدر مع تأثير النيون</p>
                        </div>
                        <span className="mr-auto text-[9px] text-violet-400 font-black animate-pulse bg-violet-900/30 px-2 py-1 rounded-full">LIVE PREVIEW</span>
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSaveSiteCustomization}
                      className="py-3 px-6 rounded-2xl text-white font-black text-sm transition flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-violet-200 hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }}
                    >
                      <Save size={16} />
                      حفظ تخصيصات الموقع في جيت هاب (Optimistic UI)
                    </button>
                    <p className="text-[10px] text-slate-400">
                      سيتم تحديث العنوان والأيقونة فوراً في المتصفح + حفظ دائم في <span className="font-mono font-bold">data.json</span> عبر <span className="font-mono font-bold">VITE_GITHUB_TOKEN</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ====== TAB 8: GITHUB PIPELINE (DATABASE BACKEND) ====== */}
            {activeTab === 'github' && (
              <div className="space-y-6 text-right" id="tab-github-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-1">
                      <Github size={16} />
                      إعدادات مزامنة الملفات وقاعدة البيانات بـ GitHub Storage API
                    </h3>
                    <input type="checkbox" id="gh_channel_enabled" checked={ghEnabled} onChange={(e) => setGhEnabled(e.target.checked)} className="w-4 h-4 cursor-pointer text-slate-900" />
                  </div>
                  <p className="text-[10px] text-slate-400">قم بربط هذا التطبيق السحابي بمستودع جيت هاب خاص بك لحفظ استمارات وبيانات المسجلين مع المرفقات ثانية بثانية بدون سيرفر خارجي.</p>

                  {ghMessage.text && (
                    <div className={`p-3 rounded-xl justify-start text-xs font-semibold flex items-center gap-2 ${ghMessage.type === 'error' ? 'bg-rose-50 border border-rose-100 text-rose-700' : 'bg-emerald-50 border border-emerald-100 text-emerald-800'}`}>
                      {ghMessage.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{ghMessage.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-right">
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500">رمز هويتك المعتمد (GitHub Personal Access Token - PAT)</label>
                      <input type="password" autoComplete="off" placeholder="ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" value={ghToken} onChange={(e) => setGhToken(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none font-mono text-left" style={{ direction: 'ltr' }} />
                      {/* Emergency LocalStorage fallback token saver */}
                      <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                        <p className="text-[10px] font-black text-amber-700 flex items-center gap-1">
                          ⚠️ احتياطي طارئ — إذا لم يعمل VITE_GITHUB_TOKEN من Vercel، الصق التوكن هنا لحفظه في LocalStorage:
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            id="ls_token_input"
                            autoComplete="off"
                            placeholder="ghp_... (سيُحفظ في LocalStorage كـ Fallback)"
                            defaultValue={localStorage.getItem('gh_token_fallback') || ''}
                            className="flex-1 px-3 py-1.5 border border-amber-300 rounded-xl text-xs outline-none font-mono text-left bg-white"
                            style={{ direction: 'ltr' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('ls_token_input') as HTMLInputElement;
                              if (el?.value?.trim()) {
                                localStorage.setItem('gh_token_fallback', el.value.trim());
                                setGhToken(el.value.trim());
                                alert('✅ تم حفظ التوكن في LocalStorage! سيُستخدم تلقائياً عند كل عملية مزامنة.');
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                          >
                            حفظ احتياطي
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              localStorage.removeItem('gh_token_fallback');
                              const el = document.getElementById('ls_token_input') as HTMLInputElement;
                              if (el) el.value = '';
                              alert('تم مسح التوكن الاحتياطي من LocalStorage.');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                          >
                            مسح
                          </button>
                        </div>
                        <p className="text-[9px] text-amber-600">
                          الأولوية: VITE_GITHUB_TOKEN (Vercel env) ← ghToken (الحقل أعلاه) ← LocalStorage ← فارغ
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم حسابك / منظمتك (Repo Owner)</label>
                      <input type="text" placeholder="مثال: AhmedAli" value={ghOwner} onChange={(e) => setGhOwner(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono" style={{ direction: 'ltr' }} required={ghEnabled} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم مستودع الرفع (Repository Name)</label>
                      <input type="text" placeholder="مثال: custom-enroll-db" value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono" style={{ direction: 'ltr' }} required={ghEnabled} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">اسم الغصن أو الفرع (Branch)</label>
                      <input type="text" placeholder="main / master" value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono" style={{ direction: 'ltr' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">مسمى ملف الطلاب النهائي (Users File)</label>
                      <input type="text" placeholder="src/data.json" value={ghDataPath} onChange={(e) => setGhDataPath(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-left font-mono" style={{ direction: 'ltr' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">عنوان المنفذ الرئيسي للموقع (Custom Port / Website Title)</label>
                      <input type="text" placeholder="Group m" value={websiteTitle} onChange={(e) => setWebsiteTitle(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white text-slate-700 font-sans" required />
                    </div>

                    <div className="flex flex-col gap-1 sm:col-span-2 border-t border-slate-100 pt-3 mt-2">
                      <span className="text-xs font-black text-slate-800 mb-2">الشعار المخصص وهوية الشاشات (Custom Icon & RGB Glow Effects)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-slate-500">رفع شعار الموقع والمقود (Favicon Logo Upload Slot)</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                compressImageToBase64(file, 128, 0.85).then((base64) => {
                                  setLogoBase64(base64);
                                  onUpdateConfig({ ...appConfig, logoBase64: base64 });
                                }).catch(() => {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const b64 = event.target?.result as string;
                                    setLogoBase64(b64);
                                    onUpdateConfig({ ...appConfig, logoBase64: b64 });
                                  };
                                  reader.readAsDataURL(file);
                                });
                              }
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-600 outline-none w-full"
                          />
                          <p className="text-[9px] text-slate-400">يدعم صيغ الصور PNG, JPG, JPEG, SVG. سيتم تدويرها ببعد ثلاثي وإكسابها تدرج RGB نيون مضيء ومبهر تلقائياً.</p>
                        </div>

                        <div className="flex flex-col justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">تفعيل تحريك اسم الموقع (Enable Dynamic Title Animation)</span>
                            <input
                              type="checkbox"
                              checked={enableTitleAnimation}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEnableTitleAnimation(checked);
                                onUpdateConfig({ ...appConfig, enableTitleAnimation: checked });
                              }}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </div>
                          <p className="text-[9px] text-slate-400">عند التفعيل، سيتم إكساب اسم الموقع ترويسة نيون متحركة ثلاثية الأبعاد (Futuristic Pulse Theme) لإبهار الزوار.</p>
                          
                          {logoBase64 && (
                            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                              <span className="text-[10px] text-slate-500">معاينة الشعار المرفوع حالياً:</span>
                              <div className="flex items-center gap-2">
                                <img src={logoBase64} alt="Preview Logo" loading="lazy" className="w-8 h-8 object-contain rounded-lg border border-slate-200 animate-3d-spin-float animate-rgb-glow" referrerPolicy="no-referrer" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLogoBase64('');
                                    onUpdateConfig({ ...appConfig, logoBase64: '' });
                                  }}
                                  className="text-[10px] text-rose-500 font-bold hover:underline"
                                >
                                  حذف ومسح الشعار
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button type="button" onClick={handleSaveGithubConfig} className="py-2.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer hover:opacity-95" style={{ backgroundColor: themeColors.primary }}>
                      <Save size={13} />
                      حفظ إعدادات المستودع محلياً
                    </button>
                    <button type="button" onClick={triggerForceSync} disabled={syncStatus === 'syncing' || !ghToken} className="py-2.5 px-4 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-bold border border-slate-200 transition flex items-center gap-1 cursor-pointer">
                      <RefreshCw size={13} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                      تزامن وصهر الكشوفات سحابياً بالكامل الآن (Reconcile)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ====== TAB 9: ADMINISTRATIVE SECURITY ====== */}
            {activeTab === 'security' && (
              <div className="space-y-6 text-right" id="tab-security-workspace">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-1">
                    <KeyRound size={16} />
                    حماية بوابات السيستم وتحديث الرمز الأمني للمسؤل
                  </h3>
                  <p className="text-[10px] text-slate-400">تعديل الرمز السري المستخدم للاستيثاق ودخول لوحات التحكم عبر الأجهزة المشغلة للبرنامج.</p>

                  {secSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={13} />
                      <span>{secSuccess}</span>
                    </div>
                  )}

                  {secError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                      <AlertCircle size={13} />
                      <span>{secError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">كلمة المرور الجديدة</label>
                      <input type="password" autoComplete="new-password" placeholder="••••••••" value={securityPassword} onChange={(e) => setSecurityPassword(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-center font-mono bg-white text-slate-700" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500">تأكيد كلمة المرور</label>
                      <input type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-center font-mono bg-white text-slate-700" />
                    </div>
                  </div>

                  <button type="button" onClick={handleSecurityPassUpdate} className="py-2.5 px-4 rounded-xl text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer hover:scale-[1.01]" style={{ backgroundColor: themeColors.primary }}>
                    <Save size={13} />
                    تحديث الرمز السري لبوابة الإشراف آمنياً
                  </button>
                </div>
              </div>
            )}
            
          </main>
        </div>
      </div>

      {/* --- INLINE DETAIL SELECTION MODAL WITH 4 PHOTO GRID OVERLAYS --- */}
      {focusedUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" id="applicant-modal">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 text-right flex flex-col max-h-[90vh]">
            <header className="px-5 py-3 text-white flex items-center justify-between select-none" style={{ backgroundColor: themeColors.primary }}>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => printUserProfile(focusedUser, appConfig.websiteTitle)} className="flex items-center gap-1 cursor-pointer bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold border border-white/10 transition">
                  <Printer size={12} />
                  <span>تصدير PDF</span>
                </button>
                <button type="button" onClick={() => exportProfileAsHTML2Canvas(focusedUser, themeColors, appConfig.websiteTitle)} className="flex items-center gap-1 cursor-pointer bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold border border-white/10 transition">
                  <FileDown size={12} />
                  <span>تنزيل PNG (عالي الدقة)</span>
                </button>
              </div>
              <div className="text-center">
                <span className="text-xs font-black">صحيفة تسجيل: {focusedUser.fullName}</span>
                <span className="text-[9px] text-slate-300 block">ID: {focusedUser.id}</span>
              </div>
              <button onClick={() => setFocusedUser(null)} className="text-white hover:text-slate-100 cursor-pointer">
                <X size={15} />
              </button>
            </header>

            <div className="p-5 overflow-y-auto space-y-5" dir="rtl">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-right">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">الاسم الكامل</p>
                  <p className="font-extrabold text-slate-800">{focusedUser.fullName} {focusedUser.lastName}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">اسم الأب</p>
                  <p className="font-extrabold text-slate-800">{focusedUser.fatherName}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">رقم الهاتف</p>
                  <p className="font-mono text-slate-800 tracking-wide font-bold" style={{ direction: 'ltr' }}>{focusedUser.phone}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">تاريخ الميلاد</p>
                  <p className="font-bold text-slate-800">{focusedUser.dob} ({focusedUser.age} سنة)</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">المدرسة/الجامعة</p>
                  <p className="font-bold text-slate-800">{focusedUser.schoolOrUniversity || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">الحالة والنوع</p>
                  <p className="font-bold text-slate-800">{focusedUser.gender === 'Male' ? 'ذكر' : 'أنثى'} / {focusedUser.maritalStatus}</p>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-[9px] text-slate-400 font-bold">العنوان بالكامل</p>
                  <p className="font-bold text-slate-800">{focusedUser.streetAddress}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">اسم العُدَد المستخدمة (EQUIPMENT USED)</p>
                  <p className="font-bold text-slate-800">{focusedUser.equipmentUsed || '-'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold">عددها كام (QUANTITY)</p>
                  <p className="font-bold text-slate-800">{focusedUser.equipmentQuantity !== undefined ? focusedUser.equipmentQuantity : '-'}</p>
                </div>
                {focusedUser.customFields && Object.entries(focusedUser.customFields).map(([k, v]) => (
                  <div key={k} className="col-span-1 bg-amber-50 p-2 rounded-lg border border-amber-100">
                    <p className="text-[9px] text-amber-700 font-black">{k}</p>
                    <p className="font-bold text-slate-800 mt-0.5">{v || '-'}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-700 mb-2.5">المستندات والوثائق المرفقة (اضغط للتكبير):</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex flex-col gap-1 text-center">
                    <p className="text-[9px] text-slate-500 font-bold">1. صورة شخصية</p>
                    {focusedUser.personalPhoto || focusedUser.idPhoto ? (
                      <img src={focusedUser.personalPhoto || focusedUser.idPhoto} alt="Personal Photo" loading="lazy" onClick={() => setLightboxPhoto(focusedUser.personalPhoto || focusedUser.idPhoto)} className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 active:scale-95 transition" />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 rounded-xl text-[10px] font-bold border border-dashed border-slate-200">غير مرفقة</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-center">
                    <p className="text-[9px] text-slate-500 font-bold">2. بطاقة (وجه)</p>
                    {focusedUser.nationalIdFront ? (
                      <img src={focusedUser.nationalIdFront} alt="National ID Front" loading="lazy" onClick={() => setLightboxPhoto(focusedUser.nationalIdFront!)} className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 active:scale-95 transition" />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 rounded-xl text-[10px] font-bold border border-dashed border-slate-200">غير مرفقة</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-center">
                    <p className="text-[9px] text-slate-500 font-bold">3. بطاقة (ظهر)</p>
                    {focusedUser.nationalIdBack ? (
                      <img src={focusedUser.nationalIdBack} alt="National ID Back" loading="lazy" onClick={() => setLightboxPhoto(focusedUser.nationalIdBack!)} className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 active:scale-95 transition" />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 rounded-xl text-[10px] font-bold border border-dashed border-slate-200">غير مرفقة</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-center">
                    <p className="text-[9px] text-slate-500 font-bold">4. شهادة ميلاد</p>
                    {focusedUser.birthCertificate ? (
                      <img src={focusedUser.birthCertificate} alt="Birth Certificate" loading="lazy" onClick={() => setLightboxPhoto(focusedUser.birthCertificate!)} className="w-full h-24 object-cover rounded-xl border border-slate-200 cursor-zoom-in hover:opacity-90 active:scale-95 transition" />
                    ) : (
                      <div className="w-full h-24 bg-slate-100 flex items-center justify-center text-slate-400 rounded-xl text-[10px] font-bold border border-dashed border-slate-200">غير مرفقة</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <footer className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setFocusedUser(null)} className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer">
                إغلاق الكشف
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* --- INLINE EDIT USER MODAL WITH TEXT OVERWRITE FIELDS --- */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" id="editing-modal">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-100 text-right flex flex-col max-h-[88vh]" id="editing-form">
            <header className="px-5 py-3 text-white flex items-center justify-between bg-amber-600">
              <span className="text-xs font-black">تحرير وتصحيح بيانات: {editingUser.fullName}</span>
              <button type="button" onClick={() => setEditingUser(null)} className="text-white hover:text-slate-100 cursor-pointer">
                <X size={15} />
              </button>
            </header>

            <div className="p-5 overflow-y-auto space-y-3 text-xs" dir="rtl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">الاسم الأول والوسطى</label>
                  <input type="text" value={editingUser.fullName} onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-800 font-sans" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">اسم الأب</label>
                  <input type="text" value={editingUser.fatherName} onChange={(e) => setEditingUser({ ...editingUser, fatherName: e.target.value })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-800 font-sans" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">اسم العائلة</label>
                  <input type="text" value={editingUser.lastName} onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-800 font-sans" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">رقم الهاتف</label>
                  <input type="text" value={editingUser.phone} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} className="px-3 py-2 border rounded-xl outline-none text-left font-mono bg-slate-50 text-slate-800 focus:bg-white focus:border-slate-800" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">العمر</label>
                  <input type="number" value={editingUser.age} onChange={(e) => setEditingUser({ ...editingUser, age: parseInt(e.target.value) || 0 })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">تاريخ الميلاد</label>
                  <input type="date" value={editingUser.dob} onChange={(e) => setEditingUser({ ...editingUser, dob: e.target.value })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white text-right" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-500">المدرسة أو الجامعة</label>
                  <input type="text" value={editingUser.schoolOrUniversity} onChange={(e) => setEditingUser({ ...editingUser, schoolOrUniversity: e.target.value })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white" />
                </div>
                <div className="flex flex-col gap-1 font-sans">
                  <label className="font-bold text-slate-500">العنوان بالتفصيل</label>
                  <input type="text" value={editingUser.streetAddress} onChange={(e) => setEditingUser({ ...editingUser, streetAddress: e.target.value })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white" required />
                </div>
                <div className="flex flex-col gap-1 font-sans">
                  <label className="font-bold text-slate-500">اسم العُدَد المستخدمة (EQUIPMENT USED)</label>
                  <input type="text" value={editingUser.equipmentUsed || ''} onChange={(e) => setEditingUser({ ...editingUser, equipmentUsed: e.target.value })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white" />
                </div>
                <div className="flex flex-col gap-1 font-sans">
                  <label className="font-bold text-slate-500">عددها كام (QUANTITY)</label>
                  <input type="number" value={editingUser.equipmentQuantity !== undefined ? editingUser.equipmentQuantity : ''} onChange={(e) => setEditingUser({ ...editingUser, equipmentQuantity: e.target.value ? parseInt(e.target.value) : undefined })} className="px-3 py-2 border rounded-xl outline-none bg-slate-50 text-slate-800 focus:bg-white" />
                </div>
              </div>
            </div>

            <footer className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 bg-white font-bold cursor-pointer">
                إلغاء التعديل
              </button>
              <button onClick={handleUpdateUserValue} type="button" className="px-5 py-2 rounded-xl text-white font-bold bg-amber-600 hover:bg-amber-700 hover:opacity-95 shadow-md cursor-pointer">
                تطبيق وحفظ التعديلات رياديـاً
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── VIDEO LIGHTBOX ── */}
      {lightboxVideo && (
        <div
          className="fixed inset-0 bg-black/95 z-[70] flex flex-col items-center justify-center p-4 select-none"
          onClick={() => setLightboxVideo(null)}
        >
          {/* إغلاق */}
          <button
            type="button"
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition z-10"
            onClick={() => setLightboxVideo(null)}
          >
            <X size={20} />
          </button>

          {/* مشغّل الفيديو */}
          <video
            src={lightboxVideo}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-[78vh] rounded-2xl shadow-2xl object-contain bg-black"
            onClick={e => e.stopPropagation()}
            style={{ minWidth: 260 }}
          />

          {/* أزرار التحكم */}
          <div className="flex items-center gap-3 mt-4" onClick={e => e.stopPropagation()}>
            {/* تحميل */}
            <a
              href={lightboxVideo}
              download="installation_video.mp4"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer"
            >
              <Download size={14} />تحميل الفيديو
            </a>
            {/* إغلاق */}
            <button
              type="button"
              onClick={() => setLightboxVideo(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition cursor-pointer"
            >
              <X size={14} />إغلاق
            </button>
          </div>

          <p className="text-slate-500 text-[10px] mt-3 font-bold">
            اضغط خارج الفيديو للإغلاق
          </p>
        </div>
      )}

      {/* --- IMMERSIVE SINGLE LIGHTBOX EXPANSION FOR PHOTOMETRIC CHECKS --- */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col items-center justify-center p-4 cursor-zoom-out select-none animate-in fade-in min-h-screen" onClick={() => setLightboxPhoto(null)}>
          <button className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition" onClick={() => setLightboxPhoto(null)}>
            <X size={20} />
          </button>
          <img
            src={lightboxPhoto}
            alt="Expanded certified file preview zoom"
            loading="lazy"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
          />
          <p className="text-slate-400 font-bold font-sans text-xs mt-3 select-all">Base64 Certified Stream Active • Click anywhere to exit zoom</p>
        </div>
      )}

    </div>
  );
}

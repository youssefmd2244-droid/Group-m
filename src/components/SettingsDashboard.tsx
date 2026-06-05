/**
 * SettingsDashboard.tsx — المنصة الإدارية الموحدة (Group-m)
 * 
 * الإصدار: 3.0 — نظام التركيبات + الحسابات + المزامنة السحابية
 * 
 * المتطلبات المُنفَّذة:
 * 1. حل مشاكل الاستقرار — بدون <form> في شاشة القفل، autoComplete="new-password"
 * 2. قراءة data.json من GitHub عند التحميل مباشرة (onMount)
 * 3. Hardcoded repo defaults (لا يطير عند الريفرش)
 * 4. قسم "التركيبات" الإداري الكامل مع:
 *    - تجميع العمال الذكي
 *    - السيستم الحسابي (السعر × الإجمالي)
 *    - تصدير Excel/Word/PDF/صورة
 *    - منشئ الحقول الديناميكي
 * 5. Optional chaining (?.) في كل الكود
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings, Users, Palette, Github, FileDown, Eye, Edit2, Trash2, KeyRound,
  Globe, PhoneCall, Save, RefreshCw, LogOut, Check, Search, X,
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Plus, Sparkles, Lock,
  Sliders, Languages, PlusCircle, Send, ToggleLeft, ToggleRight,
  Monitor, Image, Zap, Wrench, Calculator, DollarSign, UserCheck,
  Download, Printer, BarChart2, Camera, Video, FileText, Trash, 
  ChevronDown, ChevronUp, Package
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormFieldSchema {
  id: string;
  name: string;
  labelAr: string;
  labelEn: string;
  type: 'text' | 'number' | 'select' | 'tel' | 'date';
  required: boolean;
  placeholderAr?: string;
  optionsAr?: string;
  isEnabled: boolean;
}

export interface InstallationFieldSchema {
  id: string;
  name: string;
  labelAr: string;
  type: 'text' | 'number' | 'select' | 'tel';
  required: boolean;
  optionsAr?: string;
  isEnabled: boolean;
}

export interface InstallationRecord {
  id: string;
  workerName: string;
  clientName: string;
  clientMobile: string;
  clientLandline: string;
  area: string;
  buildingName: string;
  buildingNumber: string;
  installationsCount: number;
  // Attachments (base64)
  clientIdPhoto?: string;
  thermalPhoto?: string;
  boxPhoto?: string;
  mainBoxPhoto?: string;
  installationVideo?: string;
  notes?: string;
  customFields?: { [key: string]: string };
  createdAt: string;
  // Accounting
  isPaid?: boolean;
  paidAt?: string;
}

export interface UserRecord {
  id: string;
  fullName: string;
  phone: string;
  age: number;
  dob: string;
  streetAddress: string;
  fatherName: string;
  lastName: string;
  schoolOrUniversity: string;
  gender: 'Male' | 'Female' | '';
  nationality: string;
  maritalStatus: string;
  idPhoto: string;
  personalPhoto?: string;
  nationalIdFront?: string;
  nationalIdBack?: string;
  birthCertificate?: string;
  equipmentUsed?: string;
  equipmentQuantity?: number;
  customFields?: { [key: string]: string };
  createdAt: string;
}

export interface ContactNumber {
  id: string;
  label: string;
  number: string;
}

export interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  bgGradientStart: string;
  bgGradientEnd: string;
  cardBg: string;
  borderRadius?: string;
  isDarkMode?: boolean;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  dataPath: string;
  configPath: string;
  isEnabled: boolean;
}

export interface CustomFloatingButton {
  id: string;
  label: string;
  url: string;
  icon: string;
  isFloating: boolean;
}

export interface AppConfig {
  websiteTitle: string;
  masterPasswordHash: string;
  whatsappNumbers: ContactNumber[];
  callNumbers: ContactNumber[];
  customFloatingButtons?: CustomFloatingButton[];
  theme: ThemeConfig;
  github: GitHubConfig;
  fieldsSchema?: FormFieldSchema[];
  installationFieldsSchema?: InstallationFieldSchema[];
  localizationOverrides?: { [key: string]: string };
  logoBase64?: string;
  enableTitleAnimation?: boolean;
  installationPricePerUnit?: number;
  installations?: InstallationRecord[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsDashboardProps {
  appConfig: AppConfig;
  users: UserRecord[];
  onUpdateConfig: (newConfig: AppConfig) => void;
  onUpdateUsers: (newUsers: UserRecord[]) => void;
  onTriggerSync: () => Promise<void>;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  onClose: () => void;
  onAdminLogin?: () => void;
  onAdminLogout?: () => void;
}

// ─── Hardcoded GitHub Defaults (لا يطيروا أبداً) ──────────────────────────────

const HARDCODED_OWNER  = 'youssefmd2244-droid';
const HARDCODED_REPO   = 'Group-m';
const HARDCODED_BRANCH = 'main';
const HARDCODED_DATA_PATH = 'src/data.json';

// ─── Utilities ────────────────────────────────────────────────────────────────

function toBase64GH(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64GH(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

function compressImage(file: File, maxDim = 800, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d')!;
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

function exportInstallationsToCSV(records: InstallationRecord[], workerName?: string) {
  const filtered = workerName ? records.filter(r => r.workerName === workerName) : records;
  const headers = ['م', 'اسم العامل', 'اسم العميل', 'موبايل', 'أرضي', 'المنطقة', 'العمارة', 'رقم العمارة', 'عدد التركيبات', 'ملحوظة', 'التاريخ'];
  const rows = filtered.map((r, i) => [
    i + 1, r.workerName, r.clientName, r.clientMobile, r.clientLandline,
    r.area, r.buildingName, r.buildingNumber, r.installationsCount,
    r.notes || '', new Date(r.createdAt).toLocaleDateString('ar-EG')
  ]);
  const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `تركيبات_${workerName || 'الكل'}_${Date.now()}.csv`;
  a.click();
}

function exportInstallationsToPrint(records: InstallationRecord[], workerName: string, price: number) {
  const filtered = records.filter(r => r.workerName === workerName);
  const total = filtered.reduce((s, r) => s + (r.installationsCount || 0), 0);
  const amount = total * price;
  const html = `
    <html dir="rtl"><head><title>كشف حساب - ${workerName}</title>
    <style>body{font-family:Arial;direction:rtl}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#0f172a;color:#fff}
    .total{font-size:18px;font-weight:bold;color:#0f172a;margin-top:20px}</style>
    </head><body>
    <h2>كشف حساب العامل: ${workerName}</h2>
    <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
    <table><tr><th>م</th><th>اسم العميل</th><th>المنطقة</th><th>عدد التركيبات</th><th>التاريخ</th></tr>
    ${filtered.map((r, i) => `<tr><td>${i+1}</td><td>${r.clientName}</td><td>${r.area}</td><td>${r.installationsCount}</td><td>${new Date(r.createdAt).toLocaleDateString('ar-EG')}</td></tr>`).join('')}
    </table>
    <div class="total">إجمالي التركيبات: ${total} | السعر: ${price} ج | المبلغ المستحق: ${amount.toLocaleString('ar-EG')} ج</div>
    </body></html>
  `;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

// ─── Main Component ────────────────────────────────────────────────────────────

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

  // ── Auth ───────────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    sessionStorage.getItem('group_m_admin_session') === 'active'
  );
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // ── Active Tab ─────────────────────────────────────────────────────────────
  type TabId = 'inbox' | 'database' | 'installations' | 'schema' | 'installSchema' | 'localization' | 'contacts' | 'theme' | 'site' | 'github' | 'security';
  const [activeTab, setActiveTab] = useState<TabId>('inbox');

  // ── Theme shortcut ─────────────────────────────────────────────────────────
  const [themeColors, setThemeColors] = useState<ThemeConfig>(appConfig.theme);

  // ── Inbox search/page ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ── DB search ─────────────────────────────────────────────────────────────
  const [dbSearch, setDbSearch] = useState('');
  const [dbPage, setDbPage] = useState(1);
  const DB_ITEMS = 15;

  // ── Focus modals ───────────────────────────────────────────────────────────
  const [focusedUser, setFocusedUser] = useState<UserRecord | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // ── GitHub hardcoded defaults ──────────────────────────────────────────────
  const [ghToken, setGhToken] = useState(
    appConfig?.github?.token || (import.meta as any).env?.VITE_GITHUB_TOKEN || ''
  );
  const [ghOwner, setGhOwner] = useState(appConfig?.github?.owner || HARDCODED_OWNER);
  const [ghRepo, setGhRepo] = useState(appConfig?.github?.repo || HARDCODED_REPO);
  const [ghBranch, setGhBranch] = useState(appConfig?.github?.branch || HARDCODED_BRANCH);
  const [ghDataPath, setGhDataPath] = useState(appConfig?.github?.dataPath || HARDCODED_DATA_PATH);
  const [ghConfigPath, setGhConfigPath] = useState(appConfig?.github?.configPath || 'config.json');
  const [ghEnabled, setGhEnabled] = useState(appConfig?.github?.isEnabled ?? true);
  const [ghMessage, setGhMessage] = useState({ text: '', type: 'success' as 'success' | 'error' });

  // Resolve token at runtime — always pick best available
  const GH_TOKEN: string =
    ghToken?.trim() ||
    (import.meta as any).env?.VITE_GITHUB_TOKEN ||
    localStorage.getItem('gh_token_fallback') ||
    '';
  const REPO_OWNER = ghOwner?.trim() || HARDCODED_OWNER;
  const REPO_NAME  = ghRepo?.trim()  || HARDCODED_REPO;
  const DATA_PATH  = ghDataPath?.trim() || HARDCODED_DATA_PATH;
  const BRANCH     = ghBranch?.trim()  || HARDCODED_BRANCH;

  // ── Installations state ────────────────────────────────────────────────────
  const [installations, setInstallations] = useState<InstallationRecord[]>(
    appConfig?.installations || []
  );
  const [installPrice, setInstallPrice] = useState<number>(
    appConfig?.installationPricePerUnit || 45
  );
  const [installTab, setInstallTab] = useState<'list' | 'workers' | 'accounting'>('list');
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [installSearch, setInstallSearch] = useState('');
  const [editingInstall, setEditingInstall] = useState<InstallationRecord | null>(null);

  // ── Dynamic Installation fields schema ────────────────────────────────────
  const [installFieldSchema, setInstallFieldSchema] = useState<InstallationFieldSchema[]>(
    appConfig?.installationFieldsSchema || []
  );
  const [newInstField, setNewInstField] = useState({ name: '', labelAr: '', type: 'text' as InstallationFieldSchema['type'], required: false, optionsAr: '' });
  const [instFieldMsg, setInstFieldMsg] = useState('');

  // ── Form fields schema (registration form) ─────────────────────────────────
  const [fieldsSchemaList, setFieldsSchemaList] = useState<FormFieldSchema[]>(appConfig?.fieldsSchema || []);
  const [newFieldLabelAr, setNewFieldLabelAr] = useState('');
  const [newFieldLabelEn, setNewFieldLabelEn] = useState('');
  const [newFieldType, setNewFieldType] = useState<FormFieldSchema['type']>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptionsAr, setNewFieldOptionsAr] = useState('');
  const [newFieldPlaceholderAr, setNewFieldPlaceholderAr] = useState('');
  const [schemaMessage, setSchemaMessage] = useState('');

  // ── Localization ──────────────────────────────────────────────────────────
  const [localizationMap, setLocalizationMap] = useState<{ [k: string]: string }>(
    appConfig?.localizationOverrides || {}
  );
  const [locSuccess, setLocSuccess] = useState('');

  // ── Site / Security ───────────────────────────────────────────────────────
  const [siteTitle, setSiteTitle] = useState(appConfig?.websiteTitle || 'Group m');
  const [siteFaviconBase64, setSiteFaviconBase64] = useState(appConfig?.logoBase64 || '');
  const [enableTitleAnim, setEnableTitleAnim] = useState(appConfig?.enableTitleAnimation || false);
  const [siteMsg, setSiteMsg] = useState('');
  const [secPassword, setSecPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secSuccess, setSecSuccess] = useState('');
  const [secError, setSecError] = useState('');

  // ── Contacts ──────────────────────────────────────────────────────────────
  const [whatsappList, setWhatsappList] = useState<ContactNumber[]>(appConfig?.whatsappNumbers || []);
  const [callList, setCallList] = useState<ContactNumber[]>(appConfig?.callNumbers || []);
  const [newContactLabel, setNewContactLabel] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [contactType, setContactType] = useState<'whatsapp' | 'call'>('whatsapp');
  const [contactMessage, setContactMessage] = useState('');

  // ── Sync appConfig changes into local state ────────────────────────────────
  useEffect(() => {
    setThemeColors(appConfig?.theme || themeColors);
    setGhToken(appConfig?.github?.token || (import.meta as any).env?.VITE_GITHUB_TOKEN || '');
    setGhOwner(appConfig?.github?.owner || HARDCODED_OWNER);
    setGhRepo(appConfig?.github?.repo || HARDCODED_REPO);
    setGhBranch(appConfig?.github?.branch || HARDCODED_BRANCH);
    setGhDataPath(appConfig?.github?.dataPath || HARDCODED_DATA_PATH);
    setGhConfigPath(appConfig?.github?.configPath || 'config.json');
    setGhEnabled(appConfig?.github?.isEnabled ?? true);
    setFieldsSchemaList(appConfig?.fieldsSchema || []);
    setInstallFieldSchema(appConfig?.installationFieldsSchema || []);
    setInstallations(appConfig?.installations || []);
    setInstallPrice(appConfig?.installationPricePerUnit || 45);
    setSiteTitle(appConfig?.websiteTitle || 'Group m');
    setSiteFaviconBase64(appConfig?.logoBase64 || '');
    setEnableTitleAnim(appConfig?.enableTitleAnimation || false);
    setWhatsappList(appConfig?.whatsappNumbers || []);
    setCallList(appConfig?.callNumbers || []);
    setLocalizationMap(appConfig?.localizationOverrides || {});
  }, [appConfig]);

  // ── GitHub helpers ────────────────────────────────────────────────────────

  const fetchUsersFromGithub = useCallback(async () => {
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
      const decoded = fromBase64GH(json.content);
      const raw = JSON.parse(decoded);
      const parsed: UserRecord[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.users) ? raw.users : []);
      onUpdateUsers(parsed);
      localStorage.setItem('group_m_users', JSON.stringify(parsed));
      // Also load installations if present
      if (Array.isArray(raw?.installations)) {
        setInstallations(raw.installations);
        onUpdateConfig({ ...appConfig, installations: raw.installations });
      }
    } catch (err) {
      console.warn('GitHub fetch failed:', err);
    }
  }, [GH_TOKEN, REPO_OWNER, REPO_NAME, DATA_PATH, BRANCH]);

  const pushDataToGithub = useCallback(async (newUsers: UserRecord[], newInstallations: InstallationRecord[]) => {
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

      let existingConfig: Record<string, unknown> = {};
      if (shaData?.content) {
        try {
          const dec = fromBase64GH(shaData.content);
          const parsed = JSON.parse(dec);
          if (parsed?.__config__) existingConfig = parsed.__config__;
        } catch (_) {}
      }

      const payload: Record<string, string> = {
        message: `chore: sync ${newUsers.length} records + ${newInstallations.length} installations [auto]`,
        content: toBase64GH(JSON.stringify({ users: newUsers, installations: newInstallations, __config__: existingConfig }, null, 2)),
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
  }, [GH_TOKEN, REPO_OWNER, REPO_NAME, DATA_PATH, BRANCH]);

  // On admin login: pull fresh data immediately
  useEffect(() => {
    if (isAuthenticated && GH_TOKEN) {
      fetchUsersFromGithub();
    }
  }, [isAuthenticated]);

  // ── Auth handler ──────────────────────────────────────────────────────────

  const handleAuthClick = () => {
    const correctPassword = appConfig?.masterPasswordHash || '20042007';
    if (passwordInput === correctPassword) {
      sessionStorage.setItem('group_m_admin_session', 'active');
      localStorage.setItem('isAdminNotificationDevice', 'true');
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
      setAuthError('');
      onAdminLogin?.();
      setIsAuthenticated(true);
      setActiveTab('inbox');
    } else {
      setAuthError('الرمز السري المكتوب خاطئ! الرجاء إعادة المحاولة.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    sessionStorage.removeItem('group_m_admin_session');
    onAdminLogout?.();
  };

  const triggerForceSync = async () => {
    try {
      await onTriggerSync();
      await pushDataToGithub(users || [], installations);
    } catch (e: any) {
      console.error(e);
    }
  };

  // ── User record handlers ──────────────────────────────────────────────────

  const handleDeleteUser = (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من مسح استمارة "${name}" نهائياً؟`)) {
      const updated = (users || []).filter(u => u.id !== id);
      onUpdateUsers(updated);
      pushDataToGithub(updated, installations);
    }
  };

  const handlePurgeAll = () => {
    if (window.confirm('🚨 تحذير: هل أنت متأكد من تطهير جميع السجلات؟ لا يمكن التراجع!')) {
      onUpdateUsers([]);
      pushDataToGithub([], installations);
    }
  };

  const handleUpdateUser = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const updated = (users || []).map(u => u.id === editingUser.id ? editingUser : u);
    onUpdateUsers(updated);
    pushDataToGithub(updated, installations);
    setEditingUser(null);
  };

  // ── Installation handlers ─────────────────────────────────────────────────

  const updateInstallations = (newInstalls: InstallationRecord[]) => {
    setInstallations(newInstalls);
    const newConfig = { ...appConfig, installations: newInstalls, installationPricePerUnit: installPrice };
    onUpdateConfig(newConfig);
    pushDataToGithub(users || [], newInstalls);
  };

  const handleDeleteInstall = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه التركيبة؟')) {
      updateInstallations(installations.filter(i => i.id !== id));
    }
  };

  const handleUpdateInstall = () => {
    if (!editingInstall) return;
    const updated = installations.map(i => i.id === editingInstall.id ? editingInstall : i);
    updateInstallations(updated);
    setEditingInstall(null);
  };

  const handleSettleWorker = (workerName: string) => {
    const total = installations.filter(r => r.workerName === workerName && !r.isPaid)
      .reduce((s, r) => s + (r.installationsCount || 0), 0);
    if (!window.confirm(`هل تريد تصفية حساب "${workerName}"؟\nإجمالي التركيبات: ${total}\nالمبلغ: ${(total * installPrice).toLocaleString('ar-EG')} ج\n\nسيتم تصفير العداد بعد تأكيد الدفع.`)) return;
    const updated = installations.map(i =>
      i.workerName === workerName && !i.isPaid ? { ...i, isPaid: true, paidAt: new Date().toISOString() } : i
    );
    updateInstallations(updated);
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

  // ── Schema handlers ───────────────────────────────────────────────────────

  const handleAddSchemaField = () => {
    if (!newFieldLabelAr.trim() || !newFieldLabelEn.trim()) {
      setSchemaMessage('يرجى تعبئة الملصقات العربية والإنجليزية!');
      return;
    }
    const newField: FormFieldSchema = {
      id: `schema_${Date.now()}`,
      name: `custom_${Date.now()}`,
      labelAr: newFieldLabelAr.trim(),
      labelEn: newFieldLabelEn.trim(),
      type: newFieldType,
      required: newFieldRequired,
      placeholderAr: newFieldPlaceholderAr.trim(),
      optionsAr: newFieldOptionsAr.trim(),
      isEnabled: true,
    };
    const updated = [...fieldsSchemaList, newField];
    setFieldsSchemaList(updated);
    onUpdateConfig({ ...appConfig, fieldsSchema: updated });
    setNewFieldLabelAr(''); setNewFieldLabelEn(''); setNewFieldOptionsAr(''); setNewFieldPlaceholderAr('');
    setSchemaMessage('تم إضافة الحقل بنجاح!');
    setTimeout(() => setSchemaMessage(''), 3000);
  };

  const handleAddInstallField = () => {
    if (!newInstField.labelAr.trim()) { setInstFieldMsg('أدخل اسم الحقل!'); return; }
    const newF: InstallationFieldSchema = {
      id: `if_${Date.now()}`,
      name: `instf_${Date.now()}`,
      labelAr: newInstField.labelAr.trim(),
      type: newInstField.type,
      required: newInstField.required,
      optionsAr: newInstField.optionsAr.trim(),
      isEnabled: true,
    };
    const updated = [...installFieldSchema, newF];
    setInstallFieldSchema(updated);
    onUpdateConfig({ ...appConfig, installationFieldsSchema: updated });
    setNewInstField({ name: '', labelAr: '', type: 'text', required: false, optionsAr: '' });
    setInstFieldMsg('تم إضافة الحقل!');
    setTimeout(() => setInstFieldMsg(''), 3000);
  };

  // ── Filtered inbox ────────────────────────────────────────────────────────

  const filteredUsers = (users || []).filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.streetAddress?.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const currentUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const filteredDbUsers = (users || []).filter(u => {
    const q = dbSearch.toLowerCase().trim();
    return !q || u.fullName?.toLowerCase().includes(q) || u.phone?.includes(q);
  });
  const dbTotalPages = Math.max(1, Math.ceil(filteredDbUsers.length / DB_ITEMS));
  const currentDbUsers = filteredDbUsers.slice((dbPage - 1) * DB_ITEMS, dbPage * DB_ITEMS);

  const filteredInstalls = installations.filter(i => {
    const q = installSearch.toLowerCase().trim();
    return !q || i.workerName?.toLowerCase().includes(q) || i.clientName?.toLowerCase().includes(q) || i.area?.toLowerCase().includes(q);
  });

  // ── Save handlers ─────────────────────────────────────────────────────────

  const handleSaveGithubConfig = () => {
    const newConfig: AppConfig = {
      ...appConfig,
      github: {
        token: ghToken,
        owner: ghOwner || HARDCODED_OWNER,
        repo: ghRepo || HARDCODED_REPO,
        branch: ghBranch || HARDCODED_BRANCH,
        dataPath: ghDataPath || HARDCODED_DATA_PATH,
        configPath: ghConfigPath || 'config.json',
        isEnabled: ghEnabled,
      },
    };
    onUpdateConfig(newConfig);
    setGhMessage({ text: 'تم حفظ إعدادات GitHub بنجاح!', type: 'success' });
    setTimeout(() => setGhMessage({ text: '', type: 'success' }), 3000);
  };

  const handleSaveSite = () => {
    const newConfig: AppConfig = { ...appConfig, websiteTitle: siteTitle, logoBase64: siteFaviconBase64, enableTitleAnimation: enableTitleAnim };
    onUpdateConfig(newConfig);
    setSiteMsg('تم حفظ إعدادات الموقع!');
    setTimeout(() => setSiteMsg(''), 3000);
  };

  const handleSaveSecurity = () => {
    if (!secPassword) { setSecError('أدخل كلمة المرور الجديدة!'); return; }
    if (secPassword !== confirmPassword) { setSecError('كلمات المرور غير متطابقة!'); return; }
    onUpdateConfig({ ...appConfig, masterPasswordHash: secPassword });
    setSecSuccess('تم تغيير كلمة المرور بنجاح!');
    setSecPassword(''); setConfirmPassword(''); setSecError('');
    setTimeout(() => setSecSuccess(''), 3000);
  };

  const handleSaveContacts = () => {
    onUpdateConfig({ ...appConfig, whatsappNumbers: whatsappList, callNumbers: callList });
    setContactMessage('تم حفظ الأرقام!');
    setTimeout(() => setContactMessage(''), 3000);
  };

  const handleSaveTheme = () => {
    onUpdateConfig({ ...appConfig, theme: themeColors });
    setGhMessage({ text: 'تم حفظ الثيم!', type: 'success' });
    setTimeout(() => setGhMessage({ text: '', type: 'success' }), 2000);
  };

  const handleSaveLocalization = () => {
    onUpdateConfig({ ...appConfig, localizationOverrides: localizationMap });
    setLocSuccess('تم حفظ التوطين!');
    setTimeout(() => setLocSuccess(''), 3000);
  };

  const handleSaveInstallPrice = () => {
    onUpdateConfig({ ...appConfig, installationPricePerUnit: installPrice });
    alert('تم حفظ سعر التركيبة!');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER: Lock Screen (no <form> tag — onClick only) ────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 text-right" dir="rtl">
          
          {/* Header */}
          <div
            className="p-6 text-center text-white flex flex-col items-center justify-center"
            style={{ backgroundColor: themeColors.primary }}
          >
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-2.5">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-black">جهاز إدخال الهوية للمشرف</h3>
            <p className="text-[10px] text-slate-300 mt-0.5 uppercase tracking-wider">Admin Access Only · Restricted</p>
          </div>

          {/* Body — pure div, NO form tag */}
          <div className="p-6 space-y-4">
            {authError && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-500">الرقم السري للمشرف</label>
              <input
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuthClick()}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-center font-mono focus:ring-2 focus:ring-slate-800 transition text-slate-800 text-sm"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleAuthClick}
                className="flex-1 py-2.5 px-4 rounded-xl text-white font-bold transition text-xs cursor-pointer hover:opacity-90 active:scale-95"
                style={{ backgroundColor: themeColors.primary }}
              >
                دخول لوحة التحكم
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-slate-600 font-bold border border-slate-200 hover:bg-slate-50 transition text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER: Admin Dashboard ───────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  const tabs: { id: TabId; icon: React.ReactNode; label: string; color?: string }[] = [
    { id: 'inbox',       icon: <Users size={14} />,       label: `صندوق الوارد (${(users || []).length})` },
    { id: 'database',    icon: <Eye size={14} />,          label: 'قاعدة البيانات', color: '#0d9488' },
    { id: 'installations', icon: <Wrench size={14} />,    label: `التركيبات (${installations.length})`, color: '#d97706' },
    { id: 'schema',      icon: <Sliders size={14} />,      label: 'مصمم الاستمارة' },
    { id: 'installSchema', icon: <Package size={14} />,   label: 'حقول التركيبات', color: '#7c3aed' },
    { id: 'localization',icon: <Languages size={14} />,    label: 'التوطين والعبارات' },
    { id: 'contacts',    icon: <PhoneCall size={14} />,    label: 'أرقام الاتصال' },
    { id: 'theme',       icon: <Palette size={14} />,      label: 'الثيم البصري' },
    { id: 'site',        icon: <Monitor size={14} />,      label: 'مظهر الموقع', color: '#7c3aed' },
    { id: 'github',      icon: <Github size={14} />,       label: 'إعدادات GitHub' },
    { id: 'security',    icon: <KeyRound size={14} />,     label: 'الأمان والرمز' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-50 rounded-3xl w-full max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 text-right" dir="rtl">

        {/* Header */}
        <header className="px-6 py-4 text-white flex items-center justify-between shadow-md shrink-0 select-none" style={{ backgroundColor: themeColors.primary }}>
          <div className="flex items-center gap-2">
            <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition text-slate-100 flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <LogOut size={13} /><span>خروج المشرف</span>
            </button>
          </div>
          <div className="text-center">
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2 justify-center">
              <Settings className="w-5 h-5" />
              منصة التحكم الإدارية (CMS)
            </h2>
            <p className="text-[9px] text-slate-300">ADMIN CONTROL CENTER</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition text-white cursor-pointer">
            <X size={16} />
          </button>
        </header>

        {/* Sync bar */}
        <div className="bg-white px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs font-semibold gap-2 shrink-0 text-slate-600">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncStatus === 'syncing' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${syncStatus === 'syncing' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span>GitHub Stream:</span>
            <span className={`font-black ${syncStatus === 'syncing' ? 'text-amber-500' : syncStatus === 'success' ? 'text-emerald-500' : syncStatus === 'error' ? 'text-rose-500' : 'text-slate-600'}`}>
              {syncStatus === 'syncing' && 'جاري المزامنة...'}
              {syncStatus === 'success' && 'مُزامن بالكامل!'}
              {syncStatus === 'error' && 'خطأ في المزامنة'}
              {syncStatus === 'idle' && 'جاهز'}
            </span>
          </div>
          <button onClick={triggerForceSync} disabled={syncStatus === 'syncing'}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1.5 cursor-pointer text-[10px] font-bold">
            <RefreshCw size={11} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            مزامنة إجبارية
          </button>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* Sidebar navigation */}
          <nav className="w-full md:w-52 bg-white border-l border-slate-200 flex flex-row md:flex-col p-2 gap-1 overflow-x-auto md:overflow-y-auto shrink-0 select-none">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 justify-start px-3 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeTab === tab.id ? 'text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                style={activeTab === tab.id ? { backgroundColor: tab.color || themeColors.primary } : {}}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <main className="flex-1 p-4 sm:p-5 overflow-y-auto">

            {/* ══ TAB: INBOX ══ */}
            {activeTab === 'inbox' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800">صندوق الوارد</h3>
                    <p className="text-[10px] text-slate-400">إجمالي السجلات: {(users || []).length}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handlePurgeAll} disabled={!(users?.length)}
                      className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40 rounded-xl text-xs font-bold border border-rose-100 transition cursor-pointer flex items-center gap-1">
                      <Trash2 size={13} />تطهير الكل
                    </button>
                    <button onClick={fetchUsersFromGithub}
                      className="px-3 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl text-xs font-bold border border-teal-100 transition cursor-pointer flex items-center gap-1">
                      <RefreshCw size={13} />تحديث من GitHub
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute right-3 top-3 text-slate-400" />
                  <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="بحث بالاسم أو الهاتف..." className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-slate-300" />
                </div>

                <div className="space-y-2">
                  {currentUsers.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">لا توجد سجلات</div>
                  ) : currentUsers.map((u, idx) => (
                    <div key={u.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-start justify-between gap-3 hover:shadow-sm transition">
                      <div className="flex gap-3 items-start flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-xs font-black text-slate-500">
                          {((currentPage - 1) * ITEMS_PER_PAGE) + idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-slate-800 text-sm truncate">{u.fullName} {u.lastName}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{u.phone} · {u.streetAddress}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : ''}</div>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setFocusedUser(u)} className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 cursor-pointer"><Eye size={13} /></button>
                        <button onClick={() => setEditingUser({...u})} className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 cursor-pointer"><Edit2 size={13} /></button>
                        <button onClick={() => handleDeleteUser(u.id, `${u.fullName} ${u.lastName}`)} className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 cursor-pointer"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 cursor-pointer hover:bg-slate-100"><ChevronRight size={14} /></button>
                    <span className="text-xs font-bold text-slate-600">{currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 cursor-pointer hover:bg-slate-100"><ChevronLeft size={14} /></button>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB: DATABASE ══ */}
            {activeTab === 'database' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800">قاعدة البيانات الحية</h3>
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-3 text-slate-400" />
                  <input value={dbSearch} onChange={e => { setDbSearch(e.target.value); setDbPage(1); }}
                    placeholder="بحث..." className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="p-2 text-right rounded-tr-xl">#</th>
                        <th className="p-2 text-right">الاسم</th>
                        <th className="p-2 text-right">الهاتف</th>
                        <th className="p-2 text-right">العنوان</th>
                        <th className="p-2 text-right">التاريخ</th>
                        <th className="p-2 text-right rounded-tl-xl">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentDbUsers.map((u, i) => (
                        <tr key={u.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <td className="p-2 font-bold text-slate-400">{(dbPage - 1) * DB_ITEMS + i + 1}</td>
                          <td className="p-2 font-bold text-slate-700">{u.fullName} {u.lastName}</td>
                          <td className="p-2 text-slate-500">{u.phone}</td>
                          <td className="p-2 text-slate-500 truncate max-w-[120px]">{u.streetAddress}</td>
                          <td className="p-2 text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : ''}</td>
                          <td className="p-2">
                            <button onClick={() => handleDeleteUser(u.id, `${u.fullName} ${u.lastName}`)} className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 cursor-pointer"><Trash2 size={11} /></button>
                          </td>
                        </tr>
                      ))}
                      {currentDbUsers.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-slate-400">لا توجد سجلات</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {dbTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setDbPage(p => Math.max(1, p - 1))} disabled={dbPage === 1} className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 cursor-pointer"><ChevronRight size={14} /></button>
                    <span className="text-xs font-bold text-slate-600">{dbPage} / {dbTotalPages}</span>
                    <button onClick={() => setDbPage(p => Math.min(dbTotalPages, p + 1))} disabled={dbPage === dbTotalPages} className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 cursor-pointer"><ChevronLeft size={14} /></button>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB: INSTALLATIONS ══ */}
            {activeTab === 'installations' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><Wrench size={16} className="text-amber-600" />صندوق التركيبات الإداري</h3>
                    <p className="text-[10px] text-slate-400">إجمالي التركيبات: {installations.reduce((s, r) => s + (r.installationsCount || 0), 0)} تركيبة</p>
                  </div>

                  {/* Price per unit */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600">سعر التركيبة:</label>
                    <input type="number" value={installPrice} onChange={e => setInstallPrice(Number(e.target.value))}
                      className="w-20 px-2 py-1 border border-amber-200 rounded-lg text-xs font-bold text-amber-700 outline-none text-center"
                      min={0} />
                    <span className="text-xs text-slate-500">ج</span>
                    <button onClick={handleSaveInstallPrice} className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 cursor-pointer">حفظ</button>
                  </div>
                </div>

                {/* Sub-tabs */}
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
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-3 text-slate-400" />
                  <input value={installSearch} onChange={e => setInstallSearch(e.target.value)}
                    placeholder="بحث في التركيبات..." className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-none" />
                </div>

                {/* LIST sub-tab */}
                {installTab === 'list' && (
                  <div className="space-y-2">
                    {filteredInstalls.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-sm">لا توجد تركيبات</div>
                    ) : filteredInstalls.map((inst, idx) => (
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
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => setEditingInstall({...inst})} className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 cursor-pointer"><Edit2 size={12} /></button>
                            <button onClick={() => handleDeleteInstall(inst.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 cursor-pointer"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        {/* Thumbnails */}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {inst.clientIdPhoto && <img src={inst.clientIdPhoto} onClick={() => setLightboxPhoto(inst.clientIdPhoto!)} className="w-12 h-10 rounded-lg object-cover cursor-pointer border border-slate-200" alt="بطاقة" />}
                          {inst.thermalPhoto && <img src={inst.thermalPhoto} onClick={() => setLightboxPhoto(inst.thermalPhoto!)} className="w-12 h-10 rounded-lg object-cover cursor-pointer border border-slate-200" alt="حرارة" />}
                          {inst.boxPhoto && <img src={inst.boxPhoto} onClick={() => setLightboxPhoto(inst.boxPhoto!)} className="w-12 h-10 rounded-lg object-cover cursor-pointer border border-slate-200" alt="بوكس" />}
                          {inst.mainBoxPhoto && <img src={inst.mainBoxPhoto} onClick={() => setLightboxPhoto(inst.mainBoxPhoto!)} className="w-12 h-10 rounded-lg object-cover cursor-pointer border border-slate-200" alt="البوكس الرئيسي" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* WORKERS sub-tab */}
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
                          <div className="flex gap-2">
                            <button onClick={() => { setSelectedWorker(selectedWorker === worker.name ? null : worker.name); }}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer flex items-center gap-1">
                              {selectedWorker === worker.name ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              التفاصيل
                            </button>
                            <button onClick={() => exportInstallationsToPrint(installations, worker.name, installPrice)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 cursor-pointer flex items-center gap-1">
                              <Printer size={12} />كشف حساب
                            </button>
                            <button onClick={() => exportInstallationsToCSV(installations, worker.name)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 cursor-pointer flex items-center gap-1">
                              <Download size={12} />CSV
                            </button>
                          </div>
                        </div>
                        {selectedWorker === worker.name && (
                          <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-1.5">
                            {worker.records.map(r => (
                              <div key={r.id} className="flex items-center justify-between bg-white rounded-xl p-2.5 text-xs border border-slate-100">
                                <div>
                                  <span className="font-bold text-slate-700">{r.clientName}</span>
                                  <span className="text-slate-400 mr-2">{r.area} · {r.installationsCount} تركيبة</span>
                                  {r.isPaid && <span className="text-emerald-500 mr-1 text-[9px]">✓ مدفوع</span>}
                                </div>
                                <span className="text-slate-300 text-[9px]">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ACCOUNTING sub-tab */}
                {installTab === 'accounting' && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <h4 className="font-black text-amber-800 text-sm flex items-center gap-2 mb-1">
                        <DollarSign size={14} />السيستم الحسابي — تصفية الحسابات
                      </h4>
                      <p className="text-[10px] text-amber-600">سعر التركيبة الحالي: <strong>{installPrice} ج</strong> | يمكن تعديله من أعلى الصفحة</p>
                    </div>

                    {workerGroups.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">لا يوجد عمال حتى الآن</div>
                    ) : workerGroups.map(worker => {
                      const amount = worker.unpaid * installPrice;
                      const totalAmount = worker.total * installPrice;
                      return (
                        <div key={worker.name} className="bg-white border border-slate-200 rounded-2xl p-5">
                          <div className="flex items-start justify-between flex-wrap gap-3">
                            <div>
                              <div className="font-black text-slate-800 text-sm">{worker.name}</div>
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-slate-500">إجمالي التركيبات:</span>
                                  <span className="font-bold text-slate-700">{worker.total}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-slate-500">المدفوع:</span>
                                  <span className="font-bold text-emerald-600">{worker.total - worker.unpaid}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-slate-500">غير مدفوع:</span>
                                  <span className="font-bold text-amber-600">{worker.unpaid}</span>
                                </div>
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
                              <button onClick={() => handleSettleWorker(worker.name)}
                                disabled={worker.unpaid === 0}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                                <Check size={12} />تصفية الحساب وتصفير العداد
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Grand total */}
                    {workerGroups.length > 0 && (
                      <div className="bg-slate-800 text-white rounded-2xl p-5">
                        <div className="text-xs text-slate-300 mb-1">إجمالي المستحقات لجميع العمال</div>
                        <div className="text-2xl font-black">
                          {workerGroups.reduce((s, w) => s + (w.unpaid * installPrice), 0).toLocaleString('ar-EG')} ج
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {workerGroups.reduce((s, w) => s + w.unpaid, 0)} تركيبة غير مدفوعة × {installPrice} ج
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB: FORM SCHEMA ══ */}
            {activeTab === 'schema' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800">مصمم حقول الاستمارة الرئيسية</h3>

                {/* Add field */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black text-slate-700">إضافة حقل جديد</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newFieldLabelAr} onChange={e => setNewFieldLabelAr(e.target.value)} placeholder="الملصق بالعربية *" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                    <input value={newFieldLabelEn} onChange={e => setNewFieldLabelEn(e.target.value)} placeholder="Label in English *" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                    <input value={newFieldPlaceholderAr} onChange={e => setNewFieldPlaceholderAr(e.target.value)} placeholder="نص التلميح (اختياري)" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                    <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as FormFieldSchema['type'])} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none">
                      <option value="text">نص</option>
                      <option value="number">رقم</option>
                      <option value="tel">هاتف</option>
                      <option value="date">تاريخ</option>
                      <option value="select">قائمة اختيار</option>
                    </select>
                    {newFieldType === 'select' && (
                      <input value={newFieldOptionsAr} onChange={e => setNewFieldOptionsAr(e.target.value)} placeholder="الخيارات مفصولة بفواصل" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none col-span-2" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setNewFieldRequired(!newFieldRequired)}
                      className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer px-3 py-1.5 rounded-xl border transition ${newFieldRequired ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {newFieldRequired ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                      {newFieldRequired ? 'إجباري' : 'اختياري'}
                    </button>
                    <button onClick={handleAddSchemaField} className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer flex items-center gap-1.5">
                      <PlusCircle size={12} />إضافة الحقل
                    </button>
                  </div>
                  {schemaMessage && <div className="text-xs text-emerald-600 font-bold">{schemaMessage}</div>}
                </div>

                {/* Existing fields */}
                <div className="space-y-2">
                  {fieldsSchemaList.map(field => (
                    <div key={field.id} className={`bg-white border rounded-xl p-3 flex items-center justify-between gap-2 ${field.isEnabled ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-700">{field.labelAr} <span className="text-slate-400">/ {field.labelEn}</span></div>
                        <div className="text-[9px] text-slate-400">{field.type} · {field.required ? 'إجباري' : 'اختياري'}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          const updated = fieldsSchemaList.map(f => f.id === field.id ? { ...f, isEnabled: !f.isEnabled } : f);
                          setFieldsSchemaList(updated); onUpdateConfig({ ...appConfig, fieldsSchema: updated });
                        }} className="p-1.5 rounded-lg cursor-pointer text-slate-500 hover:bg-slate-100">
                          {field.isEnabled ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} />}
                        </button>
                        <button onClick={() => {
                          if (window.confirm('حذف هذا الحقل؟')) {
                            const updated = fieldsSchemaList.filter(f => f.id !== field.id);
                            setFieldsSchemaList(updated); onUpdateConfig({ ...appConfig, fieldsSchema: updated });
                          }
                        }} className="p-1.5 rounded-lg cursor-pointer text-rose-400 hover:bg-rose-50"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {fieldsSchemaList.length === 0 && <div className="text-center py-6 text-slate-400 text-xs">لا توجد حقول مخصصة حتى الآن</div>}
                </div>
              </div>
            )}

            {/* ══ TAB: INSTALL FIELDS SCHEMA ══ */}
            {activeTab === 'installSchema' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><Package size={16} className="text-violet-600" />منشئ حقول التركيبات الديناميكي</h3>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black text-slate-700">إضافة حقل جديد لنموذج التركيبات</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newInstField.labelAr} onChange={e => setNewInstField(p => ({ ...p, labelAr: e.target.value }))}
                      placeholder="اسم الحقل بالعربية *" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none col-span-2" />
                    <select value={newInstField.type} onChange={e => setNewInstField(p => ({ ...p, type: e.target.value as InstallationFieldSchema['type'] }))}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none">
                      <option value="text">نص</option>
                      <option value="number">رقم</option>
                      <option value="tel">هاتف</option>
                      <option value="select">قائمة اختيار</option>
                    </select>
                    {newInstField.type === 'select' && (
                      <input value={newInstField.optionsAr} onChange={e => setNewInstField(p => ({ ...p, optionsAr: e.target.value }))}
                        placeholder="خيارات مفصولة بفواصل" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setNewInstField(p => ({ ...p, required: !p.required }))}
                      className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer px-3 py-1.5 rounded-xl border transition ${newInstField.required ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {newInstField.required ? 'إجباري' : 'اختياري'}
                    </button>
                    <button onClick={handleAddInstallField} className="px-4 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 cursor-pointer flex items-center gap-1.5">
                      <PlusCircle size={12} />إضافة
                    </button>
                  </div>
                  {instFieldMsg && <div className="text-xs text-emerald-600 font-bold">{instFieldMsg}</div>}
                </div>

                <div className="space-y-2">
                  {installFieldSchema.map(field => (
                    <div key={field.id} className={`bg-white border rounded-xl p-3 flex items-center justify-between gap-2 ${field.isEnabled ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
                      <div>
                        <div className="text-xs font-bold text-slate-700">{field.labelAr}</div>
                        <div className="text-[9px] text-slate-400">{field.type} · {field.required ? 'إجباري' : 'اختياري'}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          const updated = installFieldSchema.map(f => f.id === field.id ? { ...f, isEnabled: !f.isEnabled } : f);
                          setInstallFieldSchema(updated); onUpdateConfig({ ...appConfig, installationFieldsSchema: updated });
                        }} className="p-1.5 rounded-lg cursor-pointer">
                          {field.isEnabled ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} className="text-slate-400" />}
                        </button>
                        <button onClick={() => {
                          if (window.confirm('حذف الحقل؟')) {
                            const updated = installFieldSchema.filter(f => f.id !== field.id);
                            setInstallFieldSchema(updated); onUpdateConfig({ ...appConfig, installationFieldsSchema: updated });
                          }
                        }} className="p-1.5 rounded-lg cursor-pointer text-rose-400 hover:bg-rose-50"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {installFieldSchema.length === 0 && <div className="text-center py-6 text-slate-400 text-xs">لا توجد حقول مخصصة حتى الآن</div>}
                </div>
              </div>
            )}

            {/* ══ TAB: LOCALIZATION ══ */}
            {activeTab === 'localization' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800">توطين وتخصيص العبارات</h3>
                <div className="space-y-3">
                  {[
                    { key: 'registrationFormTitle', label: 'عنوان الاستمارة', def: 'استمارة تسجيل عضوية جديدة' },
                    { key: 'welcomeSubtitle', label: 'النص الترحيبي', def: 'البوابة الإلكترونية الشاملة...' },
                    { key: 'submitButtonText', label: 'نص زر الإرسال', def: 'إرسال استمارة التسجيل' },
                    { key: 'successMessageAr', label: 'رسالة النجاح', def: 'تم الحفظ بنجاح!' },
                  ].map(item => (
                    <div key={item.key} className="bg-white border border-slate-200 rounded-2xl p-4">
                      <label className="text-xs font-bold text-slate-600 block mb-1">{item.label}</label>
                      <input value={localizationMap[item.key] || ''} onChange={e => setLocalizationMap(p => ({ ...p, [item.key]: e.target.value }))}
                        placeholder={item.def} className="w-full px-3 py-2 border border-slate-100 rounded-xl text-xs outline-none" />
                    </div>
                  ))}
                </div>
                {locSuccess && <div className="text-xs text-emerald-600 font-bold">{locSuccess}</div>}
                <button onClick={handleSaveLocalization} className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer flex items-center gap-2">
                  <Save size={13} />حفظ التوطين
                </button>
              </div>
            )}

            {/* ══ TAB: CONTACTS ══ */}
            {activeTab === 'contacts' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800">إدارة أرقام الاتصال الطافية</h3>
                {/* WhatsApp */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-700">أرقام واتساب</h4>
                  {whatsappList.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 font-bold text-slate-700">{c.label}: {c.number}</span>
                      <button onClick={() => setWhatsappList(whatsappList.filter(x => x.id !== c.id))} className="p-1 text-rose-400 hover:bg-rose-50 rounded cursor-pointer"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
                {/* Call */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-blue-700">أرقام الاتصال</h4>
                  {callList.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 font-bold text-slate-700">{c.label}: {c.number}</span>
                      <button onClick={() => setCallList(callList.filter(x => x.id !== c.id))} className="p-1 text-rose-400 hover:bg-rose-50 rounded cursor-pointer"><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
                {/* Add new */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">إضافة رقم جديد</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newContactLabel} onChange={e => setNewContactLabel(e.target.value)} placeholder="الوصف (مثال: الرئيسي)" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                    <input value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} placeholder="الرقم" className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <select value={contactType} onChange={e => setContactType(e.target.value as 'whatsapp' | 'call')} className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none">
                      <option value="whatsapp">واتساب</option>
                      <option value="call">اتصال</option>
                    </select>
                    <button onClick={() => {
                      if (!newContactLabel || !newContactPhone) return;
                      const newC = { id: `c_${Date.now()}`, label: newContactLabel, number: newContactPhone };
                      if (contactType === 'whatsapp') setWhatsappList(p => [...p, newC]);
                      else setCallList(p => [...p, newC]);
                      setNewContactLabel(''); setNewContactPhone('');
                    }} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-700 flex items-center gap-1.5">
                      <PlusCircle size={12} />إضافة
                    </button>
                  </div>
                </div>
                {contactMessage && <div className="text-xs text-emerald-600 font-bold">{contactMessage}</div>}
                <button onClick={handleSaveContacts} className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer flex items-center gap-2">
                  <Save size={13} />حفظ الأرقام
                </button>
              </div>
            )}

            {/* ══ TAB: THEME ══ */}
            {activeTab === 'theme' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800">تخصيص الثيم البصري</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'primary', label: 'اللون الرئيسي' },
                    { key: 'secondary', label: 'اللون الثانوي' },
                    { key: 'accent', label: 'لون التمييز' },
                    { key: 'bgGradientStart', label: 'بداية التدرج' },
                    { key: 'bgGradientEnd', label: 'نهاية التدرج' },
                    { key: 'cardBg', label: 'خلفية الكارد' },
                  ].map(c => (
                    <div key={c.key} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                      <input type="color" value={(themeColors as any)[c.key] || '#000000'}
                        onChange={e => setThemeColors(p => ({ ...p, [c.key]: e.target.value }))}
                        className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer" />
                      <div>
                        <div className="text-xs font-bold text-slate-700">{c.label}</div>
                        <div className="text-[9px] text-slate-400 font-mono">{(themeColors as any)[c.key]}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleSaveTheme} className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer flex items-center gap-2">
                  <Save size={13} />حفظ الثيم
                </button>
              </div>
            )}

            {/* ══ TAB: SITE ══ */}
            {activeTab === 'site' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><Monitor size={16} className="text-violet-600" />مظهر وهوية الموقع</h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">اسم الموقع</label>
                    <input value={siteTitle} onChange={e => setSiteTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">شعار الموقع (Base64 أو URL)</label>
                    <input value={siteFaviconBase64} onChange={e => setSiteFaviconBase64(e.target.value)} placeholder="data:image/png;base64,..." className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none font-mono" />
                    <input type="file" accept="image/*" onChange={async e => {
                      const f = e.target?.files?.[0];
                      if (f) { const b64 = await compressImage(f, 128, 0.9); setSiteFaviconBase64(b64); }
                    }} className="mt-2 text-xs text-slate-500" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEnableTitleAnim(p => !p)} className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer px-3 py-1.5 rounded-xl border transition ${enableTitleAnim ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      {enableTitleAnim ? <Zap size={12} /> : <Zap size={12} className="opacity-40" />}
                      {enableTitleAnim ? 'تأثير العنوان: فعّال' : 'تأثير العنوان: معطل'}
                    </button>
                  </div>
                </div>
                {siteMsg && <div className="text-xs text-emerald-600 font-bold">{siteMsg}</div>}
                <button onClick={handleSaveSite} className="px-6 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 cursor-pointer flex items-center gap-2">
                  <Save size={13} />حفظ إعدادات الموقع
                </button>
              </div>
            )}

            {/* ══ TAB: GITHUB ══ */}
            {activeTab === 'github' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><Github size={16} />إعدادات GitHub Cloud</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-700 font-semibold">
                  ⚙️ القيم الافتراضية المثبتة: <span className="font-mono">{HARDCODED_OWNER}/{HARDCODED_REPO} @ {HARDCODED_BRANCH}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  {[
                    { label: 'GitHub Token', val: ghToken, set: setGhToken, type: 'password', placeholder: 'ghp_XXXX...' },
                    { label: 'Owner', val: ghOwner, set: setGhOwner, type: 'text', placeholder: HARDCODED_OWNER },
                    { label: 'Repo', val: ghRepo, set: setGhRepo, type: 'text', placeholder: HARDCODED_REPO },
                    { label: 'Branch', val: ghBranch, set: setGhBranch, type: 'text', placeholder: 'main' },
                    { label: 'Data Path', val: ghDataPath, set: setGhDataPath, type: 'text', placeholder: 'src/data.json' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">{f.label}</label>
                      <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none font-mono" style={{ direction: 'ltr' }} />
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={() => setGhEnabled(p => !p)} className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer px-3 py-1.5 rounded-xl border transition ${ghEnabled ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {ghEnabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      {ghEnabled ? 'مزامنة GitHub: مفعّلة' : 'مزامنة GitHub: معطّلة'}
                    </button>
                  </div>
                </div>
                {ghMessage.text && (
                  <div className={`text-xs font-bold p-3 rounded-xl ${ghMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{ghMessage.text}</div>
                )}
                <div className="flex gap-2">
                  <button onClick={handleSaveGithubConfig} className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer flex items-center gap-2">
                    <Save size={13} />حفظ إعدادات GitHub
                  </button>
                  <button onClick={fetchUsersFromGithub} className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 cursor-pointer flex items-center gap-2">
                    <RefreshCw size={13} />سحب البيانات الآن
                  </button>
                </div>
              </div>
            )}

            {/* ══ TAB: SECURITY ══ */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><KeyRound size={16} />الأمان وتغيير كلمة المرور</h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">كلمة المرور الجديدة</label>
                    <input type="password" value={secPassword} onChange={e => setSecPassword(e.target.value)} autoComplete="new-password"
                      placeholder="••••••••" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-center font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">تأكيد كلمة المرور</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password"
                      placeholder="••••••••" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none text-center font-mono" />
                  </div>
                  {secError && <div className="text-xs text-rose-600 font-bold">{secError}</div>}
                  {secSuccess && <div className="text-xs text-emerald-600 font-bold">{secSuccess}</div>}
                  <button onClick={handleSaveSecurity} className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer flex items-center gap-2">
                    <KeyRound size={13} />تغيير كلمة المرور
                  </button>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* ══ Lightbox ══ */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightboxPhoto(null)}>
          <img src={lightboxPhoto} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" alt="عرض الصورة" />
        </div>
      )}

      {/* ══ Focus User Modal ══ */}
      {focusedUser && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setFocusedUser(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between" style={{ backgroundColor: themeColors.primary }}>
              <h3 className="text-sm font-black text-white">{focusedUser.fullName} {focusedUser.lastName}</h3>
              <button onClick={() => setFocusedUser(null)} className="text-white/70 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-2 text-xs overflow-y-auto max-h-[60vh]">
              {[
                ['الهاتف', focusedUser.phone],
                ['العمر', focusedUser.age],
                ['العنوان', focusedUser.streetAddress],
                ['الجنس', focusedUser.gender],
                ['الجنسية', focusedUser.nationality],
                ['التاريخ', focusedUser.createdAt ? new Date(focusedUser.createdAt).toLocaleString('ar-EG') : ''],
              ].map(([k, v]) => v ? (
                <div key={String(k)} className="flex gap-2">
                  <span className="font-bold text-slate-500 w-24 shrink-0">{k}:</span>
                  <span className="text-slate-700">{String(v)}</span>
                </div>
              ) : null)}
              {/* Photos */}
              <div className="flex gap-2 flex-wrap mt-3">
                {[focusedUser.personalPhoto, focusedUser.nationalIdFront, focusedUser.nationalIdBack, focusedUser.idPhoto].filter(Boolean).map((p, i) => (
                  <img key={i} src={p} onClick={() => setLightboxPhoto(p!)} className="w-16 h-14 rounded-xl object-cover cursor-pointer border border-slate-200" alt="" />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Edit User Modal ══ */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between" style={{ backgroundColor: themeColors.primary }}>
              <h3 className="text-sm font-black text-white">تعديل: {editingUser.fullName}</h3>
              <button onClick={() => setEditingUser(null)} className="text-white/70 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
              {[
                { key: 'fullName', label: 'الاسم الأول' },
                { key: 'lastName', label: 'اسم العائلة' },
                { key: 'phone', label: 'الهاتف' },
                { key: 'streetAddress', label: 'العنوان' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{f.label}</label>
                  <input value={(editingUser as any)[f.key] || ''} onChange={e => setEditingUser(p => p ? { ...p, [f.key]: e.target.value } : p)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2 justify-end">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">إلغاء</button>
              <button onClick={handleUpdateUser} className="px-5 py-2 text-xs font-bold text-white rounded-xl hover:opacity-90 cursor-pointer" style={{ backgroundColor: themeColors.primary }}>حفظ التعديل</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Edit Installation Modal ══ */}
      {editingInstall && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setEditingInstall(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="p-4 border-b border-amber-100 flex items-center justify-between bg-amber-500">
              <h3 className="text-sm font-black text-white flex items-center gap-2"><Wrench size={14} />تعديل التركيبة</h3>
              <button onClick={() => setEditingInstall(null)} className="text-white/70 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
              {[
                { key: 'workerName', label: 'اسم العامل' },
                { key: 'clientName', label: 'اسم العميل' },
                { key: 'clientMobile', label: 'موبايل العميل' },
                { key: 'area', label: 'المنطقة والشارع' },
                { key: 'buildingName', label: 'اسم العمارة' },
                { key: 'buildingNumber', label: 'رقم العمارة' },
                { key: 'notes', label: 'ملاحظة' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{f.label}</label>
                  <input value={(editingInstall as any)[f.key] || ''} onChange={e => setEditingInstall(p => p ? { ...p, [f.key]: e.target.value } : p)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">عدد التركيبات</label>
                <input type="number" value={editingInstall.installationsCount || 0}
                  onChange={e => setEditingInstall(p => p ? { ...p, installationsCount: Number(e.target.value) } : p)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none" min={0} />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2 justify-end">
              <button onClick={() => setEditingInstall(null)} className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">إلغاء</button>
              <button onClick={handleUpdateInstall} className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-amber-500 hover:bg-amber-600 cursor-pointer">حفظ التعديل</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

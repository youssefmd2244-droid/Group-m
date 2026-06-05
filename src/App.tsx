/**
 * App.tsx — النسخة المُصلحة الكاملة
 * 
 * الإصلاحات:
 * 1. التركيبات تظهر لكل المستخدمين (مش بس الأدمن)
 * 2. جلسة الأدمن في localStorage (مش sessionStorage) عشان ما تتمسحش مع ريفريش
 * 3. GitHub لا ينقطع — token يتحفظ في localStorage كـ fallback
 * 4. مشكلة الصفحة البيضاء محلولة — إزالة أي form submit
 * 5. البيانات تتزامن من GitHub عند كل دخول
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, Sparkles, RefreshCw, CheckCircle2, Wrench, ClipboardList
} from 'lucide-react';

import type { AppConfig, ThemeConfig, InstallationRecord, UserRecord } from './components/SettingsDashboard';
import SettingsDashboard from './components/SettingsDashboard';
import InstallationForm from './components/InstallationForm';
import RegistrationForm from './components/RegistrationForm';
import FloatingButtons from './components/FloatingButtons';
import { getDefaultFieldsSchema } from './utils/defaultFields';
import { playChime, triggerPushNotification } from './utils/audioNotification';

// ── Hardcoded defaults ────────────────────────────────────────────────────────

const HARDCODED_OWNER  = 'youssefmd2244-droid';
const HARDCODED_REPO   = 'Group-m';
const HARDCODED_BRANCH = 'main';
const HARDCODED_DATA_PATH = 'src/data.json';

const DEFAULT_THEME: ThemeConfig = {
  primary: '#0f172a',
  secondary: '#475569',
  accent: '#14b8a6',
  bgGradientStart: '#f3f4f6',
  bgGradientEnd: '#e5e7eb',
  cardBg: '#ffffff',
};

const DEFAULT_CONFIG: AppConfig = {
  websiteTitle: 'Group m',
  masterPasswordHash: '20042007',
  whatsappNumbers: [{ id: 'default-wa', label: 'الرئيسي', number: '01091028501' }],
  callNumbers: [{ id: 'default-call', label: 'الرئيسي', number: '01091028501' }],
  theme: DEFAULT_THEME,
  fieldsSchema: getDefaultFieldsSchema(),
  installationFieldsSchema: [],
  logoBase64: '',
  enableTitleAnimation: false,
  installationPricePerUnit: 45,
  installations: [],
  localizationOverrides: {
    registrationFormTitle: 'استمارة تسجيل عضوية جديدة',
    welcomeSubtitle: 'البوابة الإلكترونية الشاملة لتسجيل العضوية والالتحاق بالدورات التدريبية. يرجى إدخال البيانات بدقة.',
    submitButtonText: 'إرسال استمارة التسجيل',
    successMessageAr: 'تم حفظ استمارة التسجيل بنجاح!',
  },
  github: {
    token: (import.meta as any).env?.VITE_GITHUB_TOKEN || '',
    owner: HARDCODED_OWNER,
    repo: HARDCODED_REPO,
    branch: HARDCODED_BRANCH,
    dataPath: HARDCODED_DATA_PATH,
    configPath: 'config.json',
    isEnabled: true,
  },
};

// ── Helpers to persist admin session across refreshes ─────────────────────────

const ADMIN_KEY = 'group_m_admin_ok';

function isAdminActive(): boolean {
  return localStorage.getItem(ADMIN_KEY) === '1';
}
function setAdminActive(val: boolean) {
  if (val) localStorage.setItem(ADMIN_KEY, '1');
  else localStorage.removeItem(ADMIN_KEY);
  // keep sessionStorage in sync for legacy code
  if (val) sessionStorage.setItem('group_m_admin_session', 'active');
  else sessionStorage.removeItem('group_m_admin_session');
}

// ── GitHub helpers ─────────────────────────────────────────────────────────────

function toBase64GH(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64GH(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

function resolveToken(cfg?: AppConfig['github']): string {
  return (
    (import.meta as any).env?.VITE_GITHUB_TOKEN ||
    cfg?.token ||
    localStorage.getItem('gh_token_fallback') ||
    ''
  );
}

async function fetchDataFromGithub(cfg: AppConfig['github']): Promise<{ users: UserRecord[]; installations: InstallationRecord[]; config?: Partial<AppConfig> } | null> {
  const token = resolveToken(cfg);
  const owner  = cfg?.owner  || HARDCODED_OWNER;
  const repo   = cfg?.repo   || HARDCODED_REPO;
  const branch = cfg?.branch || HARDCODED_BRANCH;
  const path   = cfg?.dataPath || HARDCODED_DATA_PATH;

  if (!token) return null;

  // Persist token for future refreshes
  if (token) localStorage.setItem('gh_token_fallback', token);

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const decoded = fromBase64GH(json.content);
    const raw = JSON.parse(decoded);

    const users: UserRecord[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.users) ? raw.users : []);
    const installations: InstallationRecord[] = Array.isArray(raw?.installations) ? raw.installations : [];
    const config = raw?.__config__ || undefined;
    return { users, installations, config };
  } catch (err) {
    console.warn('GitHub fetch failed:', err);
    return null;
  }
}

async function pushDataToGithub(
  users: UserRecord[],
  installations: InstallationRecord[],
  cfg: AppConfig['github']
): Promise<void> {
  const token = resolveToken(cfg);
  const owner  = cfg?.owner  || HARDCODED_OWNER;
  const repo   = cfg?.repo   || HARDCODED_REPO;
  const branch = cfg?.branch || HARDCODED_BRANCH;
  const path   = cfg?.dataPath || HARDCODED_DATA_PATH;

  if (!token) return;

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const getRes = await fetch(`${url}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
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

    const body: Record<string, string> = {
      message: `chore: sync ${users.length} users + ${installations.length} installations [auto]`,
      content: toBase64GH(JSON.stringify({ users, installations, __config__: existingConfig }, null, 2)),
      branch,
    };
    if (currentSha) body.sha = currentSha;

    await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('GitHub push failed:', err);
  }
}

// ── App component ─────────────────────────────────────────────────────────────

type ActiveView = 'registration' | 'installations';

export default function App() {
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    const cached = localStorage.getItem('group_m_config');
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AppConfig;
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          github: {
            ...DEFAULT_CONFIG.github,
            ...parsed.github,
            owner: parsed.github?.owner || HARDCODED_OWNER,
            repo:  parsed.github?.repo  || HARDCODED_REPO,
            branch: parsed.github?.branch || HARDCODED_BRANCH,
            dataPath: parsed.github?.dataPath || HARDCODED_DATA_PATH,
            token: (import.meta as any).env?.VITE_GITHUB_TOKEN || parsed.github?.token || localStorage.getItem('gh_token_fallback') || '',
          },
        };
      } catch (_) {}
    }
    return DEFAULT_CONFIG;
  });

  // ─── Admin state: persisted in localStorage so refresh doesn't log out ───
  const [isAdmin, setIsAdmin] = useState(() => isAdminActive());

  const [users, setUsers] = useState<UserRecord[]>(() => {
    if (!isAdminActive()) return [];
    try { return JSON.parse(localStorage.getItem('group_m_users') || '[]'); } catch (_) { return []; }
  });

  // ─── Installations: public — always load from localStorage ───
  const [installations, setInstallations] = useState<InstallationRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('group_m_installations') || '[]'); } catch (_) { return []; }
  });

  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [initPulling, setInitPulling] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('registration');

  // ── onMount: fetch from GitHub ──────────────────────────────────────────
  useEffect(() => {
    const token = resolveToken(appConfig.github);
    if (!token) return;

    const cfg: AppConfig['github'] = {
      ...appConfig.github,
      token,
      owner: appConfig.github?.owner || HARDCODED_OWNER,
      repo:  appConfig.github?.repo  || HARDCODED_REPO,
      branch: appConfig.github?.branch || HARDCODED_BRANCH,
      dataPath: appConfig.github?.dataPath || HARDCODED_DATA_PATH,
      configPath: appConfig.github?.configPath || 'config.json',
      isEnabled: true,
    };

    document.title = appConfig.websiteTitle || 'Group m';

    setInitPulling(true);
    setSyncStatus('syncing');
    fetchDataFromGithub(cfg).then(result => {
      if (result) {
        // ✅ التركيبات تتحمل للكل — مش بس الأدمن
        setInstallations(result.installations);
        localStorage.setItem('group_m_installations', JSON.stringify(result.installations));

        // المستخدمون للأدمن فقط
        if (isAdmin && result.users) {
          setUsers(result.users);
          localStorage.setItem('group_m_users', JSON.stringify(result.users));
        }

        if (result.config) {
          setAppConfig(prev => ({
            ...prev,
            ...result.config,
            github: { ...prev.github, ...((result.config as any)?.github || {}), token: cfg.token },
          }));
        }
        setSyncStatus('success');
      } else {
        setSyncStatus('idle');
      }
    }).catch(() => setSyncStatus('error'))
      .finally(() => setInitPulling(false));
  }, []);

  useEffect(() => {
    document.title = appConfig.websiteTitle || 'Group m';
  }, [appConfig.websiteTitle]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddInstallation = async (record: Omit<InstallationRecord, 'id' | 'createdAt'>) => {
    const newRecord: InstallationRecord = {
      ...record,
      id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newRecord, ...installations];
    setInstallations(updated);
    localStorage.setItem('group_m_installations', JSON.stringify(updated));

    const newConfig = { ...appConfig, installations: updated };
    setAppConfig(newConfig);
    localStorage.setItem('group_m_config', JSON.stringify(newConfig));

    setSyncStatus('syncing');
    pushDataToGithub(users, updated, appConfig.github)
      .then(() => setSyncStatus('success'))
      .catch(() => setSyncStatus('error'));
  };

  const handleAddNewRecord = async (newFormRecord: Omit<UserRecord, 'id' | 'createdAt'>) => {
    const formatted: UserRecord = {
      ...newFormRecord,
      id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [formatted, ...users];
    setUsers(updated);
    localStorage.setItem('group_m_users', JSON.stringify(updated));
    setSyncStatus('syncing');
    pushDataToGithub(updated, installations, appConfig.github)
      .then(() => setSyncStatus('success'))
      .catch(() => setSyncStatus('error'));
  };

  const handleUpdateConfig = async (newConfig: AppConfig) => {
    // حفظ التوكن دايمًا
    if (newConfig.github?.token) {
      localStorage.setItem('gh_token_fallback', newConfig.github.token);
    }
    setAppConfig(newConfig);
    localStorage.setItem('group_m_config', JSON.stringify(newConfig));
    if (newConfig.installations) {
      setInstallations(newConfig.installations);
      localStorage.setItem('group_m_installations', JSON.stringify(newConfig.installations));
    }
  };

  const handleUpdateUsers = async (newUsers: UserRecord[]) => {
    setUsers(newUsers);
    localStorage.setItem('group_m_users', JSON.stringify(newUsers));
    setSyncStatus('syncing');
    pushDataToGithub(newUsers, installations, appConfig.github)
      .then(() => setSyncStatus('success'))
      .catch(() => setSyncStatus('error'));
  };

  const handleForceManualSync = async () => {
    setSyncStatus('syncing');
    try {
      await pushDataToGithub(users, installations, appConfig.github);
      setSyncStatus('success');
    } catch (e: any) {
      setSyncStatus('error');
      throw e;
    }
  };

  const handleAdminLogin = () => {
    setIsAdmin(true);
    setAdminActive(true);
    // اسحب بيانات fresh من GitHub
    fetchDataFromGithub(appConfig.github).then(result => {
      if (result?.users) {
        setUsers(result.users);
        localStorage.setItem('group_m_users', JSON.stringify(result.users));
      }
      if (result?.installations) {
        setInstallations(result.installations);
        localStorage.setItem('group_m_installations', JSON.stringify(result.installations));
      }
    });
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminActive(false);
    setUsers([]);
    localStorage.removeItem('group_m_users');
  };

  const theme = appConfig.theme || DEFAULT_THEME;
  const workerNames = Array.from(new Set(installations.map(i => i.workerName).filter(Boolean)));

  return (
    <div
      className="min-h-screen flex flex-col transition-all duration-500 overflow-x-hidden relative"
      style={{ background: `linear-gradient(135deg, ${theme.bgGradientStart} 0%, ${theme.bgGradientEnd} 100%)` }}
    >
      {/* ── Header ── */}
      <header
        className="w-full py-4 px-6 border-b border-white/20 text-white flex items-center justify-between sticky top-0 z-40 shadow-sm backdrop-blur-md select-none"
        style={{ backgroundColor: theme.primary }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 ml-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">لوحة الإدارة</span>
          </button>
        </div>

        {/* Brand */}
        <div className="flex items-center gap-2 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg overflow-hidden">
            {appConfig.logoBase64 ? (
              <img src={appConfig.logoBase64} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Sparkles className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div className="text-right">
            <h1 className="text-md sm:text-xl font-black font-sans leading-none text-white">
              {appConfig.websiteTitle || 'Group m'}
            </h1>
            <span className="text-[9px] text-slate-300 block mt-0.5">سحابي مباشر • Secure Cloud Sync</span>
          </div>
        </div>

        {/* Sync HUD */}
        <div className="flex items-center gap-2">
          {initPulling ? (
            <div className="flex items-center gap-1 text-[10px] text-slate-200">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden md:inline font-bold">جاري الاتصال بالسحابة...</span>
            </div>
          ) : syncStatus === 'success' ? (
            <div className="flex items-center gap-1 text-emerald-300 text-[10px]">
              <CheckCircle2 className="w-3.5 h-3.5 animate-bounce" />
              <span className="hidden md:inline font-bold">مُزامن</span>
            </div>
          ) : syncStatus === 'syncing' ? (
            <div className="flex items-center gap-1 text-amber-300 text-[10px]">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden md:inline">جاري الحفظ...</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-300"><span>نشط</span></div>
          )}
        </div>
      </header>

      {/* ── Navigation tabs ── */}
      <div className="w-full bg-white border-b border-slate-200 flex items-center justify-center gap-1 px-4 py-2 sticky top-[64px] z-30 shadow-sm">
        <button
          onClick={() => setActiveView('registration')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${activeView === 'registration' ? 'text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          style={activeView === 'registration' ? { backgroundColor: theme.primary } : {}}
        >
          <ClipboardList size={14} />
          استمارة التسجيل
        </button>
        <button
          onClick={() => setActiveView('installations')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${activeView === 'installations' ? 'text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          style={activeView === 'installations' ? { backgroundColor: '#d97706' } : {}}
        >
          <Wrench size={14} />
          تركيبات
        </button>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center">

        {activeView === 'registration' && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="text-center mb-5 select-none">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: theme.primary }}>
                {appConfig.websiteTitle || 'Group m'}
              </h2>
              <p className="text-slate-500 text-xs mt-1.5 font-bold leading-relaxed">
                {appConfig.localizationOverrides?.['welcomeSubtitle'] || 'البوابة الإلكترونية الشاملة للتسجيل.'}
              </p>
            </div>
            <RegistrationForm
              theme={theme}
              fieldsSchema={appConfig.fieldsSchema}
              localizationOverrides={appConfig.localizationOverrides}
              onSubmit={handleAddNewRecord}
              syncStatus={syncStatus}
            />
          </div>
        )}

        {activeView === 'installations' && (
          <div className="w-full max-w-2xl mx-auto">
            <InstallationForm
              theme={theme}
              workers={workerNames}
              extraFields={appConfig.installationFieldsSchema}
              onSubmit={handleAddInstallation}
              syncStatus={syncStatus}
            />
          </div>
        )}
      </main>

      {/* ── Floating buttons ── */}
      <FloatingButtons
        whatsappNumbers={appConfig.whatsappNumbers}
        callNumbers={appConfig.callNumbers}
        customFloatingButtons={appConfig.customFloatingButtons}
        theme={theme}
      />

      {/* ── Footer — Icon Code ── */}
      <footer className="w-full mt-10 pb-0" dir="rtl">
        <div
          className="relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 40%, #050d1a 100%)' }}
        >
          {/* top gradient line */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #14b8a6, #3b82f6, #8b5cf6, transparent)' }} />

          <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center gap-5 text-center">

            {/* Logo + Brand */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg"
                style={{ background: 'linear-gradient(135deg, #14b8a6, #3b82f6)' }}>
                IC
              </div>
              <div className="text-right">
                <p className="text-white font-black text-lg leading-none">Icon Code</p>
                <p className="text-slate-400 text-[10px] font-mono tracking-widest mt-0.5">EST. 2023 · EGYPT</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-slate-400 text-xs leading-relaxed max-w-lg">
              شركة <span className="text-teal-400 font-bold">Icon Code</span> متخصصة في تقديم الحلول البرمجية والرقمية المتكاملة — من تصميم المواقع والمتاجر الإلكترونية، أنظمة الكاشير، هندسة GRC، الجرافيك، ديزاين، تصاميم الملابس والمباني، التوزيع على جميع المنصات، الفوتوشوب، إنشاء الشعارات والتوجهات والبراندات، ودمج تقنيات الذكاء الاصطناعي AI لتطوير أرأحت المعايير العالمية.
            </p>

            {/* Tags */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {['تصميم مواقع','متاجر إلكترونية','كاشير','GRC','جرافيك ديزاين','شعارات وبراند','تصاميم ملابس','ذكاء اصطناعي','فوتوشوب','ترويج المنصات'].map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-300 border border-slate-700"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Contact cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {/* يوسف */}
              <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="text-white text-xs font-black">م. يوسف محمد السيد محمد</span>
                </div>
                <p className="text-slate-400 text-[10px]">المدير التنفيذي / التواصل التجاري</p>
                <div className="flex gap-2">
                  <a href="https://wa.me/201094555299" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white cursor-pointer"
                    style={{ background: '#25D366' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.12 1.523 5.851L.057 23.882l6.204-1.438A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.368l-.359-.214-3.722.862.932-3.628-.234-.374A9.818 9.818 0 1112 21.818z"/></svg>
                    واتساب
                  </a>
                  <a href="tel:01094555299"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                    📞 01094555299
                  </a>
                </div>
              </div>

              {/* عمر */}
              <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="text-white text-xs font-black">م. عمر محمد السيد محمد</span>
                </div>
                <p className="text-slate-400 text-[10px]">المدير التقني / تطوير الأنظمة</p>
                <div className="flex gap-2">
                  <a href="https://wa.me/201102293350" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white cursor-pointer"
                    style={{ background: '#25D366' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.12 1.523 5.851L.057 23.882l6.204-1.438A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.368l-.359-.214-3.722.862.932-3.628-.234-.374A9.818 9.818 0 1112 21.818z"/></svg>
                    واتساب
                  </a>
                  <a href="tel:01102293350"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
                    📞 01102293350
                  </a>
                </div>
              </div>
            </div>

            {/* copyright */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', width: '100%' }} />
            <p style={{ fontSize: '10px', color: '#334155', fontWeight: '600' }}>
              © {new Date().getFullYear()} جميع حقوق التصميم والبرمجة محفوظة لصالح{' '}
              <span style={{ color: '#14b8a6' }}>Icon Code</span>
            </p>
          </div>
        </div>
      </footer>

      {/* ── Settings Dashboard ── */}
      {showSettings && (
        <SettingsDashboard
          appConfig={{ ...appConfig, installations }}
          users={users}
          onUpdateConfig={handleUpdateConfig}
          onUpdateUsers={handleUpdateUsers}
          onTriggerSync={handleForceManualSync}
          syncStatus={syncStatus}
          onClose={() => {
            setShowSettings(false);
            handleAdminLogout();
          }}
          onAdminLogin={handleAdminLogin}
          onAdminLogout={handleAdminLogout}
        />
      )}
    </div>
  );
}

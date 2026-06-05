/**
 * App.tsx — النسخة المحدثة الكاملة مع قسم التركيبات
 * 
 * التحديثات:
 * 1. قسم "تركيبات" علني في القائمة الرئيسية
 * 2. قراءة data.json من GitHub عند التحميل (onMount)
 * 3. Hardcoded repo defaults
 * 4. بدون <form> في شاشة القفل
 * 5. Optional chaining في كل مكان
 */

import React, { useState, useEffect } from 'react';
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

// ── GitHub helpers ─────────────────────────────────────────────────────────────

function toBase64GH(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64GH(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

async function fetchDataFromGithub(cfg: AppConfig['github']): Promise<{ users: UserRecord[]; installations: InstallationRecord[]; config?: Partial<AppConfig> } | null> {
  const token = cfg?.token || (import.meta as any).env?.VITE_GITHUB_TOKEN || '';
  const owner  = cfg?.owner  || HARDCODED_OWNER;
  const repo   = cfg?.repo   || HARDCODED_REPO;
  const branch = cfg?.branch || HARDCODED_BRANCH;
  const path   = cfg?.dataPath || HARDCODED_DATA_PATH;

  if (!token) return null;

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
  const token = cfg?.token || (import.meta as any).env?.VITE_GITHUB_TOKEN || '';
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
        // Always ensure hardcoded defaults are present
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
            token: (import.meta as any).env?.VITE_GITHUB_TOKEN || parsed.github?.token || '',
          },
        };
      } catch (_) {}
    }
    return DEFAULT_CONFIG;
  });

  const [users, setUsers] = useState<UserRecord[]>(() => {
    const isAdmin = sessionStorage.getItem('group_m_admin_session') === 'active';
    if (!isAdmin) return [];
    try { return JSON.parse(localStorage.getItem('group_m_users') || '[]'); } catch (_) { return []; }
  });

  const [installations, setInstallations] = useState<InstallationRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('group_m_installations') || '[]'); } catch (_) { return []; }
  });

  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [initPulling, setInitPulling] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('group_m_admin_session') === 'active');
  const [activeView, setActiveView] = useState<ActiveView>('registration');

  // ── onMount: fetch from GitHub directly ────────────────────────────────────
  useEffect(() => {
    const envToken = (import.meta as any).env?.VITE_GITHUB_TOKEN || '';
    const cfg: AppConfig['github'] = {
      ...appConfig.github,
      token: envToken || appConfig.github?.token || '',
      owner: appConfig.github?.owner || HARDCODED_OWNER,
      repo:  appConfig.github?.repo  || HARDCODED_REPO,
      branch: appConfig.github?.branch || HARDCODED_BRANCH,
      dataPath: appConfig.github?.dataPath || HARDCODED_DATA_PATH,
      configPath: appConfig.github?.configPath || 'config.json',
      isEnabled: true,
    };

    document.title = appConfig.websiteTitle || 'Group m';

    if (cfg.token) {
      setInitPulling(true);
      setSyncStatus('syncing');
      fetchDataFromGithub(cfg).then(result => {
        if (result) {
          // Update installations for everyone (public data)
          setInstallations(result.installations);
          localStorage.setItem('group_m_installations', JSON.stringify(result.installations));

          // Update users only for admins
          if (isAdmin && result.users) {
            setUsers(result.users);
            localStorage.setItem('group_m_users', JSON.stringify(result.users));
          }

          // Merge config if available
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
    }
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

    // Also update config so admin panel sees the data
    const newConfig = { ...appConfig, installations: updated };
    setAppConfig(newConfig);
    localStorage.setItem('group_m_config', JSON.stringify(newConfig));

    // Push to GitHub in background
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
    setAppConfig(newConfig);
    localStorage.setItem('group_m_config', JSON.stringify(newConfig));
    // Also sync installations from config
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

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setUsers([]);
    localStorage.removeItem('group_m_users');
    sessionStorage.removeItem('group_m_admin_session');
  };

  const theme = appConfig.theme || DEFAULT_THEME;

  // Worker names from existing installations (for the public form)
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

      {/* ── Navigation tabs (Registration / Installations) ── */}
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

      {/* ── Footer (unchanged from original) ── */}
      <footer className="w-full mt-10 pb-0">
        <div
          className="relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 40%, #050d1a 100%)' }}
        >
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #14b8a6, #3b82f6, #8b5cf6, transparent)' }} />
          <div className="max-w-4xl mx-auto px-6 py-8 text-center">
            <p style={{ fontSize: '11px', color: '#334155', fontWeight: '600' }}>
              © {new Date().getFullYear()} <span style={{ color: '#14b8a6' }}>Icon Code</span> — جميع الحقوق محفوظة.
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
          onAdminLogin={() => {
            setIsAdmin(true);
            sessionStorage.setItem('group_m_admin_session', 'active');
            // Pull fresh data for admin
            fetchDataFromGithub(appConfig.github).then(result => {
              if (result?.users) {
                setUsers(result.users);
                localStorage.setItem('group_m_users', JSON.stringify(result.users));
              }
              if (result?.installations) {
                setInstallations(result.installations);
              }
            });
          }}
          onAdminLogout={handleAdminLogout}
        />
      )}
    </div>
  );
}

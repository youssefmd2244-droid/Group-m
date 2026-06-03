import React, { useState, useEffect } from 'react';
import { 
  Settings, Users, Sparkles, RefreshCw, CheckCircle2, ChevronDown, Check, 
  Lock, Unlock, Eye, Trash2, Phone, Search, ChevronRight, ChevronLeft, 
  FileDown, Printer, Shield, Trash
} from 'lucide-react';
import { UserRecord, AppConfig, ThemeConfig, ContactNumber } from './types';
import RegistrationForm from './components/RegistrationForm';
import SettingsDashboard from './components/SettingsDashboard';
import FloatingButtons from './components/FloatingButtons';
import { syncUsersToGithub, syncConfigToGithub, pullFromGithub, getGithubFile } from './utils/githubSync';
import { printUserProfile } from './utils/exportProfile';
import { exportToExcel, exportToWord } from './utils/advancedExports';
import { playChime, triggerPushNotification } from './utils/audioNotification';
import { getDefaultFieldsSchema } from './utils/defaultFields';

// Base Default Initial State Constants
const DEFAULT_THEME: ThemeConfig = {
  primary: '#0f172a',    // Slate 900
  secondary: '#475569',  // Slate 600
  accent: '#14b8a6',     // Teal 500
  bgGradientStart: '#f3f4f6',
  bgGradientEnd: '#e5e7eb',
  cardBg: '#ffffff',
};

const DEFAULT_WHATSAPP: ContactNumber[] = [
  { id: 'default-wa', label: 'الرئيسي / Primary', number: '01091028501' }
];

const DEFAULT_CALLS: ContactNumber[] = [
  { id: 'default-call', label: 'الرئيسي / Primary', number: '01091028501' }
];

const DEFAULT_CONFIG: AppConfig = {
  websiteTitle: 'Group m',
  masterPasswordHash: '',
  whatsappNumbers: DEFAULT_WHATSAPP,
  callNumbers: DEFAULT_CALLS,
  theme: DEFAULT_THEME,
  fieldsSchema: getDefaultFieldsSchema(),
  logoBase64: '',
  enableTitleAnimation: false,
  localizationOverrides: {
    registrationFormTitle: 'استمارة تسجيل عضوية جديدة',
    welcomeSubtitle: 'البوابة الإلكترونية الشاملة لتسجيل العضوية والالتحاق بالدورات التدريبية والتعليمية. يرجى إدخال البيانات بدقة.',
    submitButtonText: 'إرسال استمارة التسجيل والمزامنة',
    successMessageAr: 'تم حفظ استمارة التسجيل بنجاح في قاعدة البيانات المحلية!',
    publicTableTitle: 'بيانات التسجيل والسجلات النشطة'
  },
  github: {
    token: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN) || '',
    owner: 'youssefmd2244-droid',
    repo: 'المجموعة-م',
    branch: 'main',
    dataPath: 'أصول/data.json',
    configPath: 'config.json',
    isEnabled: !!(typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GITHUB_TOKEN),
  }
};

export default function App() {
  // Primary State Engine
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [initPulling, setInitPulling] = useState(false);

  // High Density Area state engines
  // Restore admin session across page refreshes via sessionStorage (tab-scoped, cleared on tab close)
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('group_m_admin_session') === 'active';
  });

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setUsers([]);
    localStorage.removeItem('group_m_users');
    sessionStorage.removeItem('group_m_admin_session');
  };

  // 1. Initial Load of Configurations from LocalStorage & Pull from GitHub
  useEffect(() => {
    // A. Load local configurations first for immediate instant load
    const cachedConfig = localStorage.getItem('group_m_config');
    let loadedConfig = DEFAULT_CONFIG;

    if (cachedConfig) {
      try {
        loadedConfig = JSON.parse(cachedConfig);
        setAppConfig(loadedConfig);
      } catch (e) {
        console.error('Error parsing cached configs from LocalStorage:', e);
      }
    }

    // B. Check if a valid admin session is alive in this browser tab
    const hasActiveAdminSession = sessionStorage.getItem('group_m_admin_session') === 'active';

    if (!hasActiveAdminSession) {
      // Non-admin visitor: wipe any cached user data for privacy protection
      localStorage.removeItem('group_m_users');
      setUsers([]);
    }

    // C. Dynamically update document layout properties
    document.title = loadedConfig.websiteTitle || 'Group m';

    // D. Inject env token so Vercel VITE_GITHUB_TOKEN always takes effect
    const envToken = (import.meta as any).env?.VITE_GITHUB_TOKEN || '';
    if (envToken && (!loadedConfig.github?.token)) {
      loadedConfig = {
        ...loadedConfig,
        github: {
          ...loadedConfig.github,
          token: envToken,
          owner: loadedConfig.github?.owner || 'youssefmd2244-droid',
          repo: loadedConfig.github?.repo || 'المجموعة-م',
          branch: loadedConfig.github?.branch || 'main',
          dataPath: loadedConfig.github?.dataPath || 'أصول/data.json',
          isEnabled: true,
        }
      };
      setAppConfig(loadedConfig);
    }

    // E. Pull from GitHub on load.
    //    If admin session is active → fetch users too (isAdminPull=true).
    //    If visitor → only fetch config (isAdminPull=false, excludeUsers=true).
    if (loadedConfig.github && loadedConfig.github.isEnabled && loadedConfig.github.token) {
      triggerGithubInitialPull(loadedConfig.github, hasActiveAdminSession);
    }
  }, []);

  // Update Website title dynamically when config modifies
  useEffect(() => {
    document.title = appConfig.websiteTitle || 'Group m';
  }, [appConfig.websiteTitle]);

  // Real-Time Background Worker & Notification Engine (Admin-Only Devices)
  useEffect(() => {
    const isNotifyDevice = localStorage.getItem('isAdminNotificationDevice') === 'true';
    if (!isNotifyDevice) return;

    let isPolling = false;
    let lastKnownRecordCount: number | null = null;
    let lastKnownIds: string[] = [];

    // Lightweight high speed background sync pooler (e.g. checks every 5 seconds)
    const pollInterval = setInterval(async () => {
      // Prevent parallel overlap execution
      if (isPolling) return;

      const github = appConfig.github;
      if (!github || !github.isEnabled || !github.token || !github.owner || !github.repo) {
        return;
      }

      isPolling = true;
      try {
        const fileResult = await getGithubFile(github, github.dataPath || 'data.json');
        if (fileResult && fileResult.content) {
          const remoteUsers = JSON.parse(fileResult.content) as UserRecord[];
          if (Array.isArray(remoteUsers)) {
            // First run baseline initialization
            if (lastKnownRecordCount === null) {
              lastKnownRecordCount = remoteUsers.length;
              lastKnownIds = remoteUsers.map(u => u.id);
            } else if (remoteUsers.length > lastKnownRecordCount) {
              // Delta detected! Identify new user registration records
              const newUsers = remoteUsers.filter(u => !lastKnownIds.includes(u.id));
              
              if (newUsers.length > 0) {
                // Play HTML5 synthesizer chime
                playChime();

                // Fire native browser notification
                const targetU = newUsers[0];
                const cleanName = targetU ? `${targetU.fullName} ${targetU.lastName}` : `${newUsers.length} طلب جديد`;
                triggerPushNotification(cleanName);

                // If currently authenticated as admin on this direct screen session, update UI live
                if (isAdmin) {
                  setUsers(remoteUsers);
                  localStorage.setItem('group_m_users', JSON.stringify(remoteUsers));
                }
              }

              lastKnownRecordCount = remoteUsers.length;
              lastKnownIds = remoteUsers.map(u => u.id);
            } else if (remoteUsers.length < lastKnownRecordCount) {
              // Synchronize to lower counts too in case of deletion
              lastKnownRecordCount = remoteUsers.length;
              lastKnownIds = remoteUsers.map(u => u.id);
            }
          }
        }
      } catch (err) {
        console.warn('Silent background polling sync error:', err);
      } finally {
        isPolling = false;
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [appConfig.github, isAdmin]);

  /**
   * Performs an initial background pull reconcile with GitHub API,
   * updating local records seamlessly.
   */
  const triggerGithubInitialPull = async (githubCreds: any, isAdminPull: boolean) => {
    setInitPulling(true);
    setSyncStatus('syncing');
    try {
      // If of type non-admin, excludeUsers is set to true to protect database privacy
      const result = await pullFromGithub(githubCreds, !isAdminPull);
      if (result) {
        let hasMergedUpdates = false;

        if (isAdminPull && result.users && Array.isArray(result.users)) {
          let mergedUsers = [...result.users];

          // Reconcile and merge any pending offline/visitor registration submissions securely!
          const pendingStr = localStorage.getItem('group_m_pending_submissions');
          if (pendingStr) {
            try {
              const pendingList: UserRecord[] = JSON.parse(pendingStr);
              if (pendingList.length > 0) {
                const databaseMap = new Map<string, UserRecord>();
                // Load existing remote entries first
                mergedUsers.forEach(u => databaseMap.set(u.id, u));
                // Load and layer pending registration entries on top
                pendingList.forEach(u => databaseMap.set(u.id, u));

                mergedUsers = Array.from(databaseMap.values()).sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                // Clean the outgoing pending queue now that we successfully merged
                localStorage.removeItem('group_m_pending_submissions');
                console.log(`Successfully merged ${pendingList.length} local registrations with GitHub database.`);

                // Commit the unified database changes back to GitHub
                await syncUsersToGithub(mergedUsers, githubCreds);
              }
            } catch (mergeErr) {
              console.error('Failed to parse or reconcile pending configurations:', mergeErr);
            }
          }

          setUsers(mergedUsers);
          localStorage.setItem('group_m_users', JSON.stringify(mergedUsers));
          hasMergedUpdates = true;
        }

        if (result.appConfig) {
          const mergedConfig: AppConfig = {
            ...appConfig,
            ...result.appConfig,
            github: {
              ...appConfig.github,
              ...result.appConfig.github,
              token: githubCreds.token, // preserve local secret PAT token
            }
          };
          setAppConfig(mergedConfig);
          localStorage.setItem('group_m_config', JSON.stringify(mergedConfig));
          hasMergedUpdates = true;
        }

        if (hasMergedUpdates) {
          console.log('Successfully synchronized system state with latest GitHub revisions.');
        }
        setSyncStatus('success');
      } else {
        setSyncStatus('idle');
      }
    } catch (error) {
      console.warn('Initial GitHub sync pull failed (possibly no internet or new repository):', error);
      setSyncStatus('error');
    } finally {
      setInitPulling(false);
    }
  };

  /**
   * Real-Time Synchronization & Micro-polling Engine
   * Detects changes in the background on GitHub repo, merging states without page refreshes.
   */
  useEffect(() => {
    // SECURITY GUARD: Stop polling or calling Git data.json for non-authenticated regular visitors!
    if (!isAdmin) return;
    if (!appConfig.github || !appConfig.github.isEnabled || !appConfig.github.token) return;

    const interval = setInterval(async () => {
      // Avoid overlapping writes
      if (syncStatus === 'syncing') return;

      try {
        const result = await pullFromGithub(appConfig.github, false);
        if (result) {
          // Background compare & merge users database array
          if (result.users && Array.isArray(result.users)) {
            const hasDatabaseChanges = JSON.stringify(result.users) !== JSON.stringify(users);
            if (hasDatabaseChanges) {
              setUsers(result.users);
              localStorage.setItem('group_m_users', JSON.stringify(result.users));
              console.log('Real-Time Sync: Merged active registration database from remote GitHub Page.');
            }
          }

          // Background compare & merge website settings
          if (result.appConfig) {
            const remoteConfigToCompare = {
              ...result.appConfig,
              github: {
                ...result.appConfig.github,
                token: appConfig.github.token // exclude local state security PAT
              }
            };
            const localConfigToCompare = {
              ...appConfig,
              github: {
                ...appConfig.github,
                token: appConfig.github.token
              }
            };

            const hasConfigChanges = JSON.stringify(remoteConfigToCompare) !== JSON.stringify(localConfigToCompare);
            if (hasConfigChanges) {
              const reconciledConfig: AppConfig = {
                ...appConfig,
                ...result.appConfig,
                github: {
                  ...appConfig.github,
                  ...result.appConfig.github,
                  token: appConfig.github.token
                }
              };
              setAppConfig(reconciledConfig);
              localStorage.setItem('group_m_config', JSON.stringify(reconciledConfig));
              console.log('Real-Time Sync: Merged updated layout styling, localization tags, or custom form schemas.');
            }
          }
        }
      } catch (err) {
        console.warn('Real-Time Sync interval fetch deferred slightly:', err);
      }
    }, 12000); // Poll for updates every 12 seconds in desktop/main user scenarios

    return () => clearInterval(interval);
  }, [appConfig.github, users, appConfig, syncStatus, isAdmin]);

  /**
   * Action: Saves a brand-new registration record locally and schedules background commit
   */
  const handleAddNewRecord = async (newFormRecord: Omit<UserRecord, 'id' | 'createdAt'>) => {
    const formattedRecord: UserRecord = {
      ...newFormRecord,
      id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    // ── OPTIMISTIC UI: update state + localStorage IMMEDIATELY ──────────────
    const updatedUsers = [formattedRecord, ...users];
    setUsers(updatedUsers);
    localStorage.setItem('group_m_users', JSON.stringify(updatedUsers));

    if (isAdmin) {
      // Admin path: fire GitHub push in background — never block UI
      if (appConfig.github.isEnabled && appConfig.github.token) {
        setSyncStatus('syncing');
        syncUsersToGithub(updatedUsers, appConfig.github)
          .then(() => setSyncStatus('success'))
          .catch((err) => {
            console.error('Background GitHub push failed:', err);
            setSyncStatus('error');
            // Preserve in pending queue so next sync picks it up
            try {
              const pStr = localStorage.getItem('group_m_pending_submissions');
              const pList: UserRecord[] = pStr ? JSON.parse(pStr) : [];
              pList.push(formattedRecord);
              localStorage.setItem('group_m_pending_submissions', JSON.stringify(pList));
            } catch (_) {}
          });
      }
    } else {
      // Normal visitor: also already set state above — just queue for later merge

      const pendingStr = localStorage.getItem('group_m_pending_submissions');
      let pendingList: UserRecord[] = [];
      if (pendingStr) {
        try {
          pendingList = JSON.parse(pendingStr);
        } catch (err) {}
      }
      pendingList.push(formattedRecord);
      localStorage.setItem('group_m_pending_submissions', JSON.stringify(pendingList));

      console.log('Optimistic submission saved locally in pending outgoing queue.');
      setSyncStatus('success');
    }
  };

  /**
   * Action: Commits new administrative settings (master, theme, website metadata)
   */
  const handleUpdateConfig = async (newConfig: AppConfig) => {
    setAppConfig(newConfig);
    localStorage.setItem('group_m_config', JSON.stringify(newConfig));

    // Pull database updates to GitHub asynchronously in background
    if (newConfig.github.isEnabled && newConfig.github.token) {
      setSyncStatus('syncing');
      try {
        await syncConfigToGithub(newConfig, newConfig.github);
        setSyncStatus('success');
      } catch (err) {
        console.error('Failed to sync new configuration properties with GitHub:', err);
        setSyncStatus('error');
      }
    }
  };

  /**
   * Action: Handles admin mutations (Inline edits, direct deletions, purging) inside Settings
   */
  const handleUpdateUsers = async (newUsers: UserRecord[]) => {
    setUsers(newUsers);
    localStorage.setItem('group_m_users', JSON.stringify(newUsers));

    // Sync database with GitHub
    if (appConfig.github.isEnabled && appConfig.github.token) {
      setSyncStatus('syncing');
      try {
        await syncUsersToGithub(newUsers, appConfig.github);
        setSyncStatus('success');
      } catch (e) {
        console.error('Admin changes sync push failed:', e);
        setSyncStatus('error');
      }
    }
  };

  /**
   * Force Sync manual trigger from the Dashboard HUD
   */
  const handleForceManualSync = async () => {
    if (!appConfig.github.isEnabled || !appConfig.github.token) {
      throw new Error('ميزة المزامنة معطلة أو لم يتم إعداد التوكن الخاص بجيت هاب بعد!');
    }
    setSyncStatus('syncing');
    try {
      // 1. Send configurations
      await syncConfigToGithub(appConfig, appConfig.github);
      // 2. Send current database records
      await syncUsersToGithub(users, appConfig.github);
      setSyncStatus('success');
    } catch (e: any) {
      setSyncStatus('error');
      throw e;
    }
  };

  const theme = appConfig.theme || DEFAULT_THEME;

  return (
    <div 
      className={`min-h-screen flex flex-col transition-all duration-500 overflow-x-hidden relative ${theme.borderRadius || 'rounded-xl'}`}
      style={{
        background: `linear-gradient(135deg, ${theme.bgGradientStart} 0%, ${theme.bgGradientEnd} 100%)`,
      }}
      id="main-applet-root"
    >
      {/* Top Professional Header Navigation */}
      <header 
        className="w-full py-4 px-6 border-b border-white/20 text-white flex items-center justify-between sticky top-0 z-40 shadow-sm backdrop-blur-md select-none"
        style={{ backgroundColor: theme.primary }}
        id="applet-main-header"
      >
        <div className="flex items-center gap-2">
          {/* Settings Admin button on Left */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 ml-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition duration-150 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="الإدارة والإعدادات"
            id="header-settings-btn"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">لوحة الإدارة / Admin Panel</span>
          </button>
        </div>

        {/* Dynamic App Brand Name */}
        <div className="flex items-center gap-2 text-center animate-pulse-light" id="brand-container">
          <div 
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg overflow-hidden animate-3d-spin-float animate-rgb-glow"
            id="dynamic-brand-icon-wrapper"
          >
            {appConfig.logoBase64 ? (
              <img 
                src={appConfig.logoBase64} 
                alt="Logo" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                id="header-favicon-logo"
              />
            ) : (
              <Sparkles className="w-5 h-5 text-amber-400" id="header-fallback-sparkles" />
            )}
          </div>
          <div className="text-right">
            <h1 
              className={`text-md sm:text-xl font-black font-sans leading-none ${appConfig.enableTitleAnimation ? 'animate-title-futuristic' : 'text-white'}`}
              id="header-app-title"
            >
              {appConfig.websiteTitle || 'Group m'}
            </h1>
            <span className="text-[9px] text-slate-300 block mt-0.5" id="header-app-sub">سحابي مباشر • Secure Cloud Sync</span>
          </div>
        </div>

        {/* Sync loading hud indicators on Right */}
        <div className="flex items-center gap-2" id="sync-hud-indicator">
          {initPulling ? (
            <div className="flex items-center gap-1 text-[10px] text-slate-200" id="hud-loading">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden md:inline font-bold">جاري الاتصال بالسحابة...</span>
            </div>
          ) : syncStatus === 'success' ? (
            <div className="flex items-center gap-1 text-emerald-300 text-[10px]" id="hud-synced">
              <CheckCircle2 className="w-3.5 h-3.5 animate-bounce" />
              <span className="hidden md:inline font-bold">مُزامن بالكامل</span>
            </div>
          ) : syncStatus === 'syncing' ? (
            <div className="flex items-center gap-1 text-amber-300 text-[10px]" id="hud-syncing">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden md:inline">جاري الحفظ والتحميل...</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-300" id="hud-offline">
              <span>نشط محلياً</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Frame container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center justify-center animate-in fade-in duration-350" id="applet-main-frame">
        
        {/* Registration form (Strictly Isolated & Centered) */}
        <div className="w-full max-w-2xl mx-auto transition-all duration-300" id="registration-form-panel">
          <div className="text-center max-w-2xl mb-5 select-none" id="welcome-banner">
            <h2 
              className={`text-2xl sm:text-3xl font-black tracking-tight font-sans transition ${appConfig.enableTitleAnimation ? 'animate-title-futuristic' : 'animate-pulse'}`}
              style={appConfig.enableTitleAnimation ? undefined : { color: theme.primary }}
            >
              {appConfig.websiteTitle || 'Group m'}
            </h2>
            <p className="text-slate-500 text-xs mt-1.5 font-bold leading-relaxed">
              {appConfig.localizationOverrides?.['welcomeSubtitle'] || 'البوابة الإلكترونية الشاملة لتسجيل العضوية والالتحاق بالدورات التدريبية والتعليمية. يرجى إدخال البيانات بدقة.'}
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

      </main>

      {/* Dynamic Floating WhatsApp and Direct Mobile calling shortcuts widgets */}
      <FloatingButtons 
        whatsappNumbers={appConfig.whatsappNumbers} 
        callNumbers={appConfig.callNumbers} 
        customFloatingButtons={appConfig.customFloatingButtons}
        theme={theme}
      />

      {/* ===== ICON CODE COMPANY FOOTER ===== */}
      <footer className="w-full mt-10 pb-0" id="iconcode-footer">
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 40%, #0a1628 70%, #050d1a 100%)',
          }}
        >
          {/* Decorative top border glow */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #14b8a6, #3b82f6, #8b5cf6, #14b8a6, transparent)' }} />

          {/* Floating ambient orbs */}
          <div style={{
            position: 'absolute', top: '-60px', right: '-60px',
            width: '200px', height: '200px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', bottom: '-40px', left: '10%',
            width: '160px', height: '160px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div className="max-w-4xl mx-auto px-6 py-10 relative z-10">

            {/* Brand row */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #14b8a6, #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(20,184,166,0.4)',
                  fontSize: '20px', fontWeight: '900', color: '#fff',
                  fontFamily: 'monospace', letterSpacing: '-1px'
                }}>
                  IC
                </div>
                <div className="text-right">
                  <h2 style={{
                    fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px',
                    background: 'linear-gradient(90deg, #14b8a6, #60a5fa, #a78bfa)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    Icon Code
                  </h2>
                  <p style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '1px' }}>
                    Est. 2023 · Egypt
                  </p>
                </div>
              </div>

              {/* Description */}
              <p style={{
                maxWidth: '580px', fontSize: '12.5px', lineHeight: '1.85',
                color: '#94a3b8', fontWeight: '500', direction: 'rtl', textAlign: 'center'
              }}>
                شركة <strong style={{ color: '#e2e8f0' }}>Icon Code</strong> متخصصة في تقديم الحلول البرمجية والرقمية المتكاملة — من تصميم المواقع والمتاجر الإلكترونية، أنظمة الكاشير، هندسة GRC، الجرافيك ديزاين، تصاميم الملابس والمباني، الترويج على جميع المنصات، الفوتوشوب، إنشاء الشعارات واللوجوهات والبنرات، وحتى دمج تقنيات الذكاء الاصطناعي AI لتطوير أعمالك بأحدث المعايير العالمية.
              </p>

              {/* Service chips */}
              <div className="flex flex-wrap justify-center gap-2 mt-5">
                {['تصميم مواقع', 'متاجر إلكترونية', 'كاشير', 'GRC', 'جرافيك ديزاين', 'شعارات وبنرات', 'تصاميم ملابس', 'ذكاء اصطناعي', 'فوتوشوب', 'ترويج المنصات'].map((svc) => (
                  <span key={svc} style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700',
                    background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)',
                    color: '#5eead4', letterSpacing: '0.3px'
                  }}>
                    {svc}
                  </span>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(100,116,139,0.3), transparent)', margin: '0 0 28px 0' }} />

            {/* Founders & Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8" dir="rtl">
              {/* Yusuf */}
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px'
              }}>
                <div className="flex items-center gap-2 mb-1">
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#14b8a6', boxShadow: '0 0 8px rgba(20,184,166,0.8)'
                  }} />
                  <p style={{ fontSize: '13px', fontWeight: '800', color: '#e2e8f0' }}>م. يوسف محمد السيد محمد</p>
                </div>
                <p style={{ fontSize: '10px', color: '#475569', marginBottom: '12px', marginRight: '16px' }}>المؤسس المشارك · Co-Founder</p>
                <div className="flex items-center gap-2">
                  <a
                    href="tel:01094555299"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '10px',
                      background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                      color: '#93c5fd', fontSize: '11px', fontWeight: '700', textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.22)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.12)')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.15a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    01094555299
                  </a>
                  <a
                    href="https://wa.me/201094555299"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '10px',
                      background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                      color: '#86efac', fontSize: '11px', fontWeight: '700', textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.22)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.12)')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    واتساب
                  </a>
                </div>
              </div>

              {/* Omar */}
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px'
              }}>
                <div className="flex items-center gap-2 mb-1">
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: '#8b5cf6', boxShadow: '0 0 8px rgba(139,92,246,0.8)'
                  }} />
                  <p style={{ fontSize: '13px', fontWeight: '800', color: '#e2e8f0' }}>م. عمر محمد السيد محمد</p>
                </div>
                <p style={{ fontSize: '10px', color: '#475569', marginBottom: '12px', marginRight: '16px' }}>المؤسس المشارك · Co-Founder</p>
                <div className="flex items-center gap-2">
                  <a
                    href="tel:01102293350"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '10px',
                      background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                      color: '#93c5fd', fontSize: '11px', fontWeight: '700', textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.22)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.12)')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.15a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    01102293350
                  </a>
                  <a
                    href="https://wa.me/201102293350"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '10px',
                      background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                      color: '#86efac', fontSize: '11px', fontWeight: '700', textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.22)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.12)')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    واتساب
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom copyright */}
            <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
              <p style={{ fontSize: '11px', color: '#334155', fontWeight: '600' }}>
                © {new Date().getFullYear()} <span style={{ color: '#14b8a6' }}>Icon Code</span> — جميع الحقوق محفوظة. تم تصميم وبرمجة هذا الموقع بالكامل بواسطة فريق شركة Icon Code.
              </p>
              <p style={{ fontSize: '10px', color: '#1e293b', marginTop: '4px', fontWeight: '500' }}>
                Designed & Developed with ♥ by <strong style={{ color: '#475569' }}>Icon Code</strong> · Egypt · 2023
              </p>
            </div>

          </div>
        </div>
      </footer>
      {showSettings && (
        <SettingsDashboard
          appConfig={appConfig}
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
            // Persist session for this browser tab so page refresh restores admin state
            sessionStorage.setItem('group_m_admin_session', 'active');
            triggerGithubInitialPull(appConfig.github, true);
          }}
          onAdminLogout={handleAdminLogout}
        />
      )}
    </div>
  );
}

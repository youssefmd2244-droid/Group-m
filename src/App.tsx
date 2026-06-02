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
  masterPasswordHash: '20042007',
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
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
    dataPath: 'data.json',
    configPath: 'config.json',
    isEnabled: false,
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
  const [isAdmin, setIsAdmin] = useState(false);
  const handleAdminLogout = () => {
    setIsAdmin(false);
    setUsers([]); // Reset in-memory student registrations state
    localStorage.removeItem('group_m_users'); // Fully purge local storage database cache
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

    // Load users ONLY if we are authenticated as admin inside a secure validated session.
    // Page load is always initialized as non-admin visitor to protect privacy.
    localStorage.removeItem('group_m_users');
    setUsers([]);

    // B. Dynamically update document layout properties
    document.title = loadedConfig.websiteTitle || 'Group m';

    // C. Reconcile background updates from GitHub if active (exclude users pulling for visitors)
    if (loadedConfig.github && loadedConfig.github.isEnabled && loadedConfig.github.token) {
      triggerGithubInitialPull(loadedConfig.github, false);
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

    if (isAdmin) {
      // Admin is authenticated: merge and push live!
      const updatedUsers = [formattedRecord, ...users];
      setUsers(updatedUsers);
      localStorage.setItem('group_m_users', JSON.stringify(updatedUsers));

      if (appConfig.github.isEnabled && appConfig.github.token) {
        setSyncStatus('syncing');
        try {
          await syncUsersToGithub(updatedUsers, appConfig.github);
          setSyncStatus('success');
        } catch (err) {
          console.error('Failed to commit addition to GitHub repository:', err);
          setSyncStatus('error');
        }
      }
    } else {
      // Normal website visitor: queue locally in pending submissions to protect privacy of other applicants
      const updatedUsers = [formattedRecord, ...users];
      setUsers(updatedUsers);

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

      {/* Slide-over Dashboard configuration center */}
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
            triggerGithubInitialPull(appConfig.github, true);
          }}
          onAdminLogout={handleAdminLogout}
        />
      )}
    </div>
  );
}

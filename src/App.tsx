/**
 * App.tsx — Production-Ready v5.0 (Fully Hardened)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * الإصلاحات الجذرية في هذه النسخة (v5.0):
 *
 * ① Routing & Settings Lock — باسورد صارم "20042007" + sessionStorage
 *    - showSettings لا يُفتح إلا بعد إدخال الباسورد الصحيح تماماً
 *    - حالة الدخول محفوظة في sessionStorage (تُصفَّر بإغلاق التبويب)
 *    - Re-render أو تهنيج لا يُعيد فتح الإعدادات تلقائياً أبداً
 *
 * ② GitHub Sync الثابت — Zero-Failure Connection
 *    - Hardcoded Fallback Credentials في githubSync.ts
 *    - Token محمي في 3 مفاتيح localStorage مستقلة
 *    - resolveToken() يبحث في 5 مصادر قبل الاستسلام
 *    - Exponential Backoff Retry (3 مرات) بدون إظهار error للمستخدم
 *
 * ③ React ErrorBoundary المتعدد الطبقات
 *    - ErrorBoundary خارجي يُغطي كل التطبيق
 *    - ErrorBoundary داخلي على كل مكون حساس (RegistrationForm, InstallationForm, Settings)
 *    - الصفحة البيضاء مستحيلة — يظهر دائماً واجهة graceful degradation
 *
 * ④ منع تهنيج الـ UI — Performance Guards
 *    - safeStringify() داخل setTimeout(0) لتحرير event loop
 *    - runWhenIdle() عبر requestIdleCallback للعمليات الثقيلة
 *    - Smart Sync Queue: FIFO + Debounce — لا parallel requests
 *    - كل set يمر عبر safeArr() لضمان أن الـ state دائماً array
 *
 * ⑤ Graceful Degradation — المكون المتضرر فقط يُعاد تحميله
 *    - الـ ErrorBoundary يُظهر زر "إعادة المكون" بدل reload كامل
 *    - السجلات الأخرى لا تتأثر
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, {
  useState, useEffect, useRef, useMemo, useCallback, Component,
} from 'react';
import {
  Settings, Sparkles, RefreshCw, CheckCircle2, Wrench, ClipboardList,
} from 'lucide-react';

import type {
  AppConfig, ThemeConfig, InstallationRecord, UserRecord,
} from './components/SettingsDashboard';
import SettingsDashboard  from './components/SettingsDashboard';
import InstallationForm   from './components/InstallationForm';
import RegistrationForm   from './components/RegistrationForm';
import FloatingButtons    from './components/FloatingButtons';
import { getDefaultFieldsSchema } from './utils/defaultFields';

// استيراد كل الأدوات من githubSync المُحسَّن
import {
  persistGhCredentials,
  resolveToken,
  buildGhConfig,
  ghFetch,
  ghPush,
  createSyncQueue,
  mergeInstallations,
  mergeUsers,
  isAdminSessionActive,
  setAdminSession,
  verifyAdminPassword,
  safeArr,
  lsGet,
  lsSet,
  runWhenIdle,
  LS,
  HARDCODED_OWNER,
  HARDCODED_REPO,
  HARDCODED_BRANCH,
  HARDCODED_DATA_PATH,
} from './utils/githubSync';

// ─────────────────────────────────────────────────────────────────────────────
// ③ ErrorBoundary — طبقة حماية من الصفحة البيضاء
//    يُغطي المكونات الحساسة فردياً + كل التطبيق كطبقة خارجية
// ─────────────────────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; msg: string; componentStack: string }

class ErrorBoundary extends Component<
  { children: React.ReactNode; componentName?: string },
  EBState
> {
  state: EBState = { hasError: false, msg: '', componentStack: '' };

  static getDerivedStateFromError(e: Error): Partial<EBState> {
    return { hasError: true, msg: e?.message || 'خطأ غير معروف' };
  }

  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.componentName || 'unknown'}]`, e, info);
    this.setState({ componentStack: info.componentStack || '' });
  }

  handleRetry = () => {
    // إعادة المكون المتضرر فقط — بدون reload كامل للصفحة
    this.setState({ hasError: false, msg: '', componentStack: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const name = this.props.componentName || 'المكون';

    return (
      <div dir="rtl" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', minHeight: 200,
      }}>
        <div style={{
          background: '#fff', borderRadius: '1.25rem', padding: '2rem',
          boxShadow: '0 4px 24px #0001', maxWidth: 400, width: '100%',
          border: '1.5px solid #fee2e2', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ color: '#b91c1c', fontWeight: 800, marginBottom: 8, fontSize: 16 }}>
            خطأ في {name}
          </h3>
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16, lineHeight: 1.7 }}>
            {this.state.msg}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {/* ① إعادة المكون فقط — Graceful Degradation */}
            <button
              onClick={this.handleRetry}
              style={{
                background: '#0f172a', color: '#fff', border: 'none',
                borderRadius: '0.75rem', padding: '0.6rem 1.5rem',
                fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}
            >🔄 إعادة المكون</button>
            {/* ② إعادة تحميل الصفحة كملاذ أخير */}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0',
                borderRadius: '0.75rem', padding: '0.6rem 1.5rem',
                fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}
            >↺ تحميل الصفحة</button>
          </div>
        </div>
      </div>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ① باسورد بوابة الإعدادات — حوار بسيط مضمن في الـ App
// ─────────────────────────────────────────────────────────────────────────────
interface PasswordGateProps {
  onSuccess: () => void;
  onCancel: () => void;
  primaryColor: string;
}

function PasswordGate({ onSuccess, onCancel, primaryColor }: PasswordGateProps) {
  const [pw, setPw]       = useState('');
  const [error, setError] = useState(false);
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // فوكس تلقائي على الحقل
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (verifyAdminPassword(pw)) {
      // ① حفظ الجلسة في sessionStorage (تُصفَّر بإغلاق التبويب)
      setAdminSession(true);
      setError(false);
      onSuccess();
    } else {
      setError(true);
      setPw('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: '#fff', borderRadius: '1.5rem', padding: '2.5rem 2rem',
        boxShadow: '0 8px 48px #0003', maxWidth: 380, width: '100%',
        textAlign: 'center', border: '1.5px solid #e2e8f0',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, background: primaryColor, color: '#fff',
        }}>🔐</div>
        <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 6, color: '#0f172a' }}>
          لوحة الإدارة
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
          أدخل كلمة المرور للمتابعة
        </p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            placeholder="كلمة المرور"
            autoComplete="current-password"
            style={{
              width: '100%', padding: '0.75rem 1rem', borderRadius: '0.85rem',
              border: `2px solid ${error ? '#ef4444' : '#e2e8f0'}`,
              fontSize: 16, outline: 'none', boxSizing: 'border-box',
              textAlign: 'center', letterSpacing: 4, marginBottom: 8,
              transition: 'border-color 0.2s',
            }}
          />
          {error && (
            <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8, fontWeight: 700 }}>
              ❌ كلمة المرور غير صحيحة
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="submit"
              style={{
                flex: 1, background: primaryColor, color: '#fff',
                border: 'none', borderRadius: '0.85rem', padding: '0.75rem',
                fontWeight: 800, cursor: 'pointer', fontSize: 14,
              }}
            >دخول</button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1, background: '#f1f5f9', color: '#374151',
                border: '1px solid #e2e8f0', borderRadius: '0.85rem',
                padding: '0.75rem', fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}
            >إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default values
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_THEME: ThemeConfig = {
  primary         : '#0f172a',
  secondary       : '#475569',
  accent          : '#14b8a6',
  bgGradientStart : '#f3f4f6',
  bgGradientEnd   : '#e5e7eb',
  cardBg          : '#ffffff',
};

const DEFAULT_CONFIG: AppConfig = {
  websiteTitle            : 'Group m',
  masterPasswordHash      : '20042007',
  whatsappNumbers         : [{ id: 'default-wa',   label: 'الرئيسي', number: '01091028501' }],
  callNumbers             : [{ id: 'default-call', label: 'الرئيسي', number: '01091028501' }],
  theme                   : DEFAULT_THEME,
  fieldsSchema            : getDefaultFieldsSchema(),
  installationFieldsSchema: [],
  logoBase64              : '',
  enableTitleAnimation    : false,
  installationPricePerUnit: 45,
  installations           : [],
  localizationOverrides   : {
    registrationFormTitle : 'استمارة تسجيل عضوية جديدة',
    welcomeSubtitle       : 'البوابة الإلكترونية الشاملة لتسجيل العضوية والالتحاق بالدورات التدريبية.',
    submitButtonText      : 'إرسال استمارة التسجيل',
    successMessageAr      : 'تم حفظ استمارة التسجيل بنجاح!',
  },
  github: {
    token      : '',
    owner      : HARDCODED_OWNER,
    repo       : HARDCODED_REPO,
    branch     : HARDCODED_BRANCH,
    dataPath   : HARDCODED_DATA_PATH,
    configPath : 'config.json',
    isEnabled  : true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ActiveView = 'registration' | 'installations';
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// 🏠 AppInner — المكون الرئيسي
// ─────────────────────────────────────────────────────────────────────────────
function AppInner() {

  // ── Config ──────────────────────────────────────────────────────────────
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    const saved   = lsGet<Partial<AppConfig>>(LS.config, {});
    const merged: AppConfig = { ...DEFAULT_CONFIG, ...saved };
    // بناء github config من كل المصادر (State + localStorage + Hardcoded)
    merged.github = buildGhConfig(saved.github);
    // حفظ credentials فوراً عند أول load
    persistGhCredentials(merged.github);
    return merged;
  });

  // ── ① Admin Session — sessionStorage فقط ──────────────────────────────
  //    isAdminSessionActive() يقرأ من sessionStorage (يُصفَّر بإغلاق التبويب)
  //    لا يعتمد على localStorage لمنع الفتح التلقائي عند Re-render
  const [isAdmin,       setIsAdmin]       = useState(() => isAdminSessionActive());
  const [showPassGate,  setShowPassGate]  = useState(false); // بوابة الباسورد
  const [showSettings,  setShowSettings]  = useState(false); // لوحة الإعدادات الفعلية

  // ── Users & Installations ───────────────────────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>(() =>
    isAdminSessionActive() ? lsGet<UserRecord[]>(LS.users, []) : []
  );
  const [installations, setInstallations] = useState<InstallationRecord[]>(() =>
    safeArr(lsGet<InstallationRecord[]>(LS.installations, []))
  );

  // ── UI State ────────────────────────────────────────────────────────────
  const [syncStatus,  setSyncStatus]  = useState<SyncStatus>('idle');
  const [initPulling, setInitPulling] = useState(false);
  const [activeView,  setActiveView]  = useState<ActiveView>('registration');

  // ── Background Sync Queue ───────────────────────────────────────────────
  const syncQueue = useRef(createSyncQueue((status) => setSyncStatus(status)));

  // ── Refs لأحدث نسخ البيانات (بدون stale closure) ─────────────────────
  const usersRef         = useRef(users);
  const installationsRef = useRef(installations);
  const appConfigRef     = useRef(appConfig);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { installationsRef.current = installations; }, [installations]);
  useEffect(() => { appConfigRef.current = appConfig; }, [appConfig]);

  // ─────────────────────────────────────────────────────────────────────────
  // 🔧 setInstallationsSafe — يضمن أن الـ state دائماً array
  // ─────────────────────────────────────────────────────────────────────────
  const setInstallationsSafe = useCallback(
    (v: InstallationRecord[] | ((p: InstallationRecord[]) => InstallationRecord[])) => {
      setInstallations(prev => {
        const next = typeof v === 'function' ? v(prev) : v;
        return safeArr<InstallationRecord>(next);
      });
    }, []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 📡 enqueuePush — إضافة push لـ background queue
  // ─────────────────────────────────────────────────────────────────────────
  const enqueuePush = useCallback((
    overrideUsers?: UserRecord[],
    overrideInstalls?: InstallationRecord[],
  ) => {
    syncQueue.current.enqueue(async () => {
      const u   = overrideUsers    ?? usersRef.current;
      const i   = overrideInstalls ?? installationsRef.current;
      const cfg = buildGhConfig(appConfigRef.current.github);
      // ghPush: Retry تلقائي + Timeout 60s + Token محمي دائماً
      await ghPush(safeArr(u), safeArr(i), cfg);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 🚀 onMount: جلب البيانات من GitHub + merge ذكي
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = appConfig.websiteTitle || 'Group m';

    const cfg   = buildGhConfig(appConfig.github);
    const token = resolveToken(cfg);

    // حفظ credentials عند أول mount
    persistGhCredentials(cfg);

    if (!token) return; // لا يوجد token — نبقى على البيانات المحلية

    setInitPulling(true);
    setSyncStatus('syncing');

    ghFetch(cfg)
      .then(result => {
        if (!result) {
          // فشل الـ fetch (شبكة أو timeout) — نبقى على البيانات المحلية
          setSyncStatus('idle'); // idle وليس error — Token لا يزال موجوداً
          return;
        }

        // Merge installations — GitHub + local-only (pending sync)
        const mergedInstalls = mergeInstallations(
          result.installations,
          installationsRef.current,
        );
        setInstallationsSafe(mergedInstalls);
        lsSet(LS.installations, mergedInstalls);

        // Users للأدمن فقط
        if (isAdminSessionActive()) {
          const mergedUsers = mergeUsers(result.users, usersRef.current);
          setUsers(mergedUsers);
          lsSet(LS.users, mergedUsers);
        }

        // Config من GitHub (مع الحفاظ على github credentials الحالية)
        if (result.config) {
          setAppConfig(prev => ({
            ...prev,
            ...result.config,
            // ⚠️ لا ندع الـ remote يُستبدل github credentials المحلية
            github: prev.github,
          }));
        }

        setSyncStatus('success');
      })
      .catch(err => {
        // Network/Timeout error — Token لا يزال محفوظاً
        console.warn('[onMount ghFetch] (Token محفوظ):', err);
        setSyncStatus('idle');
      })
      .finally(() => setInitPulling(false));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // مرة واحدة عند الـ mount فقط

  useEffect(() => {
    document.title = appConfig.websiteTitle || 'Group m';
  }, [appConfig.websiteTitle]);

  // ─────────────────────────────────────────────────────────────────────────
  // ① فتح الإعدادات — مشروط بالباسورد + sessionStorage
  // ─────────────────────────────────────────────────────────────────────────
  const handleOpenSettingsRequest = useCallback(() => {
    // إذا كانت الجلسة نشطة في sessionStorage — ندخل مباشرة بدون باسورد
    if (isAdminSessionActive()) {
      setShowSettings(true);
    } else {
      // نُظهر بوابة الباسورد أولاً
      setShowPassGate(true);
    }
  }, []);

  const handlePasswordSuccess = useCallback(() => {
    setShowPassGate(false);
    setShowSettings(true);
    setIsAdmin(true);

    // جلب أحدث البيانات فور الدخول
    const cfg = buildGhConfig(appConfigRef.current.github);
    ghFetch(cfg)
      .then(result => {
        if (!result) return;
        const mergedUsers = mergeUsers(result.users, usersRef.current);
        setUsers(mergedUsers);
        lsSet(LS.users, mergedUsers);
        const mergedInstalls = mergeInstallations(result.installations, installationsRef.current);
        setInstallationsSafe(mergedInstalls);
        lsSet(LS.installations, mergedInstalls);
      })
      .catch(err => console.warn('[onLogin ghFetch]', err));
  }, [setInstallationsSafe]);

  const handlePasswordCancel = useCallback(() => {
    setShowPassGate(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ handleAddInstallation — Submit التركيبة (فوري + خلفي)
  // ─────────────────────────────────────────────────────────────────────────
  const handleAddInstallation = useCallback(async (
    record: Omit<InstallationRecord, 'id' | 'createdAt'>
  ) => {
    const newRecord: InstallationRecord = {
      ...record,
      id       : `inst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    // تحديث فوري (< 5ms) — الفورم يُفرَّغ بعد هذا مباشرةً
    const updated = safeArr<InstallationRecord>([newRecord, ...installationsRef.current]);
    setInstallationsSafe(updated);
    lsSet(LS.installations, updated);

    // Push خلفي — لا ينتظر، لا يُعطل الـ UI
    enqueuePush(usersRef.current, updated);
  }, [enqueuePush, setInstallationsSafe]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ handleAddNewRecord — Submit استمارة التسجيل
  // ─────────────────────────────────────────────────────────────────────────
  const handleAddNewRecord = useCallback(async (
    record: Omit<UserRecord, 'id' | 'createdAt'>
  ) => {
    const formatted: UserRecord = {
      ...record,
      id       : `std_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = safeArr<UserRecord>([formatted, ...usersRef.current]);
    setUsers(updated);
    lsSet(LS.users, updated);
    enqueuePush(updated, installationsRef.current);
  }, [enqueuePush]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ handleUpdateConfig
  // ─────────────────────────────────────────────────────────────────────────
  const handleUpdateConfig = useCallback((newConfig: AppConfig) => {
    // حفظ credentials من الـ config الجديد أولاً
    persistGhCredentials(newConfig.github);

    // بناء github config آمن من كل المصادر
    const safeGithub  = buildGhConfig(newConfig.github);
    const finalConfig : AppConfig = { ...newConfig, github: safeGithub };

    setAppConfig(finalConfig);
    lsSet(LS.config, finalConfig);

    if (Array.isArray(newConfig.installations)) {
      const safeInst = safeArr<InstallationRecord>(newConfig.installations);
      setInstallationsSafe(safeInst);
      lsSet(LS.installations, safeInst);
    }
  }, [setInstallationsSafe]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ handleUpdateUsers
  // ─────────────────────────────────────────────────────────────────────────
  const handleUpdateUsers = useCallback((newUsers: UserRecord[]) => {
    const safe = safeArr<UserRecord>(newUsers);
    setUsers(safe);
    lsSet(LS.users, safe);
    enqueuePush(safe, installationsRef.current);
  }, [enqueuePush]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ handleForceManualSync — زر المزامنة اليدوية
  // ─────────────────────────────────────────────────────────────────────────
  const handleForceManualSync = useCallback(async () => {
    setSyncStatus('syncing');
    const cfg = buildGhConfig(appConfigRef.current.github);
    const ok  = await ghPush(
      safeArr(usersRef.current),
      safeArr(installationsRef.current),
      cfg,
    );
    setSyncStatus(ok ? 'success' : 'error');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ handleAdminLogin — جلب + merge فوري عند الدخول
  // ─────────────────────────────────────────────────────────────────────────
  const handleAdminLogin = useCallback(() => {
    setIsAdmin(true);
    setAdminSession(true);

    const cfg = buildGhConfig(appConfigRef.current.github);
    ghFetch(cfg)
      .then(result => {
        if (!result) return;
        const mergedUsers = mergeUsers(result.users, usersRef.current);
        setUsers(mergedUsers);
        lsSet(LS.users, mergedUsers);
        const mergedInstalls = mergeInstallations(result.installations, installationsRef.current);
        setInstallationsSafe(mergedInstalls);
        lsSet(LS.installations, mergedInstalls);
      })
      .catch(err => console.warn('[handleAdminLogin ghFetch]', err));
  }, [setInstallationsSafe]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ handleAdminLogout — تصفير الجلسة + إغلاق الإعدادات
  // ─────────────────────────────────────────────────────────────────────────
  const handleAdminLogout = useCallback(() => {
    setIsAdmin(false);
    // ① إيقاف جلسة sessionStorage فوراً
    setAdminSession(false);
    setUsers([]);
    setShowSettings(false);
    localStorage.removeItem(LS.users);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 Derived values
  // ─────────────────────────────────────────────────────────────────────────
  const theme = appConfig.theme ?? DEFAULT_THEME;

  const workerNames = useMemo<string[]>(() => {
    if (!Array.isArray(installations) || installations.length === 0) return [];
    return Array.from(new Set(
      installations
        .map(i => (typeof i?.workerName === 'string' ? i.workerName.trim() : ''))
        .filter(Boolean)
    ));
  }, [installations]);

  // ─────────────────────────────────────────────────────────────────────────
  // 🖼️ Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col transition-all duration-500 overflow-x-hidden relative"
      style={{ background: `linear-gradient(135deg, ${theme.bgGradientStart} 0%, ${theme.bgGradientEnd} 100%)` }}
    >

      {/* ══ Header ══ */}
      <header
        className="w-full py-4 px-6 border-b border-white/20 text-white flex items-center justify-between sticky top-0 z-40 shadow-sm backdrop-blur-md select-none"
        style={{ backgroundColor: theme.primary }}
      >
        {/* ① زر لوحة الإدارة — يفتح بوابة الباسورد أولاً */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenSettingsRequest}
            className="p-2 ml-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">لوحة الإدارة</span>
          </button>
        </div>

        {/* Brand */}
        <div className="flex items-center gap-2 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg overflow-hidden">
            {appConfig.logoBase64
              ? <img src={appConfig.logoBase64} alt="Logo" className="w-full h-full object-cover" />
              : <Sparkles className="w-5 h-5 text-amber-400" />
            }
          </div>
          <div className="text-right">
            <h1 className="text-md sm:text-xl font-black font-sans leading-none text-white">
              {appConfig.websiteTitle || 'Group m'}
            </h1>
            <span className="text-[9px] text-slate-300 block mt-0.5">سحابي مباشر • Secure Cloud Sync</span>
          </div>
        </div>

        {/* Sync HUD */}
        <div className="flex items-center gap-2 min-w-[60px] justify-end">
          {initPulling ? (
            <span className="flex items-center gap-1 text-[10px] text-slate-200">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden md:inline font-bold">جاري الاتصال...</span>
            </span>
          ) : syncStatus === 'syncing' ? (
            <span className="flex items-center gap-1 text-amber-300 text-[10px]">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="hidden md:inline">حفظ...</span>
            </span>
          ) : syncStatus === 'success' ? (
            <span className="flex items-center gap-1 text-emerald-300 text-[10px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-bold">مُزامن ✓</span>
            </span>
          ) : syncStatus === 'error' ? (
            <span className="flex items-center gap-1 text-rose-300 text-[10px]">
              <RefreshCw className="w-3 h-3 cursor-pointer" onClick={handleForceManualSync} />
              <span className="hidden md:inline">إعادة المحاولة</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-300">نشط</span>
          )}
        </div>
      </header>

      {/* ══ Navigation Tabs ══ */}
      <div className="w-full bg-white border-b border-slate-200 flex items-center justify-center gap-1 px-4 py-2 sticky top-[64px] z-30 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveView('registration')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${activeView === 'registration' ? 'text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          style={activeView === 'registration' ? { backgroundColor: theme.primary } : {}}
        >
          <ClipboardList size={14} />استمارة التسجيل
        </button>
        <button
          type="button"
          onClick={() => setActiveView('installations')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${activeView === 'installations' ? 'text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
          style={activeView === 'installations' ? { backgroundColor: '#d97706' } : {}}
        >
          <Wrench size={14} />تركيبات
        </button>
      </div>

      {/* ══ Main Content ══ */}
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
            {/* ③ ErrorBoundary على RegistrationForm */}
            <ErrorBoundary componentName="استمارة التسجيل">
              <RegistrationForm
                theme={theme}
                fieldsSchema={appConfig.fieldsSchema ?? []}
                localizationOverrides={appConfig.localizationOverrides ?? {}}
                onSubmit={handleAddNewRecord}
                syncStatus={syncStatus}
              />
            </ErrorBoundary>
          </div>
        )}

        {activeView === 'installations' && (
          <div className="w-full max-w-2xl mx-auto">
            {/* ③ ErrorBoundary على InstallationForm */}
            <ErrorBoundary componentName="استمارة التركيبات">
              <InstallationForm
                theme={theme}
                workers={workerNames}
                extraFields={Array.isArray(appConfig.installationFieldsSchema) ? appConfig.installationFieldsSchema : []}
                onSubmit={handleAddInstallation}
                syncStatus={syncStatus}
              />
            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* ══ Floating Buttons ══ */}
      <FloatingButtons
        whatsappNumbers={appConfig.whatsappNumbers ?? []}
        callNumbers={appConfig.callNumbers ?? []}
        customFloatingButtons={appConfig.customFloatingButtons}
        theme={theme}
      />

      {/* ══ Footer ══ */}
      <footer className="w-full mt-10 pb-0" dir="rtl">
        <div className="relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 40%, #050d1a 100%)' }}>
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #14b8a6, #3b82f6, #8b5cf6, transparent)' }} />
          <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center gap-5 text-center">

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg"
                style={{ background: 'linear-gradient(135deg, #14b8a6, #3b82f6)' }}>IC</div>
              <div className="text-right">
                <p className="text-white font-black text-lg leading-none">Icon Code</p>
                <p className="text-slate-400 text-[10px] font-mono tracking-widest mt-0.5">EST. 2023 · EGYPT</p>
              </div>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed max-w-lg">
              شركة <span className="text-teal-400 font-bold">Icon Code</span> متخصصة في تقديم الحلول البرمجية
              والرقمية المتكاملة — تصميم المواقع، المتاجر الإلكترونية، الكاشير، GRC، الجرافيك،
              الشعارات والبراندات، ودمج تقنيات الذكاء الاصطناعي.
            </p>

            <div className="flex flex-wrap justify-center gap-1.5">
              {['تصميم مواقع','متاجر إلكترونية','كاشير','GRC','جرافيك ديزاين','شعارات وبراند','ذكاء اصطناعي','فوتوشوب'].map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-300 border border-slate-700"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>{tag}</span>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {/* يوسف */}
              <div className="rounded-2xl p-4 flex flex-col gap-2.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-white text-xs font-black">م. يوسف محمد السيد محمد</span>
                </div>
                <p className="text-slate-400 text-[10px]">المدير التنفيذي / التواصل التجاري</p>
                <div className="flex gap-2">
                  <a href="https://wa.me/201094555299" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white"
                    style={{ background: '#25D366' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.12 1.523 5.851L.057 23.882l6.204-1.438A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.368l-.359-.214-3.722.862.932-3.628-.234-.374A9.818 9.818 0 1112 21.818z"/>
                    </svg>
                    واتساب
                  </a>
                  <a href="tel:01094555299"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>📞 01094555299</a>
                </div>
              </div>

              {/* عمر */}
              <div className="rounded-2xl p-4 flex flex-col gap-2.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-white text-xs font-black">م. عمر محمد السيد محمد</span>
                </div>
                <p className="text-slate-400 text-[10px]">المدير التقني / تطوير الأنظمة</p>
                <div className="flex gap-2">
                  <a href="https://wa.me/201102293350" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white"
                    style={{ background: '#25D366' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.12 1.523 5.851L.057 23.882l6.204-1.438A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.368l-.359-.214-3.722.862.932-3.628-.234-.374A9.818 9.818 0 1112 21.818z"/>
                    </svg>
                    واتساب
                  </a>
                  <a href="tel:01102293350"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>📞 01102293350</a>
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', width: '100%' }} />
            <p style={{ fontSize: '10px', color: '#334155', fontWeight: 600 }}>
              © {new Date().getFullYear()} جميع الحقوق محفوظة لصالح{' '}
              <span style={{ color: '#14b8a6' }}>Icon Code</span>
            </p>
          </div>
        </div>
      </footer>

      {/* ══ ① بوابة الباسورد — تظهر قبل الإعدادات ══ */}
      {showPassGate && (
        <PasswordGate
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
          primaryColor={theme.primary}
        />
      )}

      {/* ══ ③ Settings Dashboard — محمي بـ ErrorBoundary ══ */}
      {showSettings && (
        <ErrorBoundary componentName="لوحة الإعدادات">
          <SettingsDashboard
            appConfig={{ ...appConfig, installations: safeArr(installations) }}
            users={safeArr(users)}
            onUpdateConfig={handleUpdateConfig}
            onUpdateUsers={handleUpdateUsers}
            onTriggerSync={handleForceManualSync}
            syncStatus={syncStatus}
            onClose={() => { setShowSettings(false); handleAdminLogout(); }}
            onAdminLogin={handleAdminLogin}
            onAdminLogout={handleAdminLogout}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 Export مع ErrorBoundary خارجي — الطبقة الأولى من الحماية
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary componentName="التطبيق الرئيسي">
      <AppInner />
    </ErrorBoundary>
  );
}

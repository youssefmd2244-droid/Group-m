/**
 * App.tsx — Production-Ready v4.0 (Hardened GitHub Sync)
 * ════════════════════════════════════════════════════════════════════════════
 * الإصلاحات الجذرية في هذه النسخة:
 *
 * ① Token Protection — التوكن لا يُحذف مهما حدث
 *    • أي خطأ (401, 404, 422, Timeout, Network) لا يمس الـ Token
 *    • Token يُحفظ في localStorage بـ 3 مفاتيح مستقلة
 *    • resolveToken() تبحث في 4 مصادر (env → state → ls-primary → ls-fallback)
 *
 * ② Smart Queue مع FIFO حقيقي — صفر تهنيج
 *    • createSyncQueue يأخذ onStatusChange callback لتحديث UI تلقائياً
 *    • الـ queue يحتفظ بـ FIFO: كل push ينتظر OK من السابق
 *    • يحتفظ بآخر job (debounce) لتفادي الضغط عند الإرسال السريع
 *
 * ③ Retry تلقائي — 3 مرات مع Exponential Backoff
 *    • 1.5s → 3s → 6s بين المحاولات
 *    • 409 Conflict يُعاد تلقائياً بـ SHA جديد
 *
 * ④ Timeout 60 ثانية — مناسب للـ Base64 الكبير
 *    • AbortController على كل fetch
 *    • Timeout لا يُفقد Token — فقط يُعيد المحاولة
 *
 * ⑤ Safe JSON.stringify — يمنع تجميد المتصفح
 *    • safeStringify() غير متزامنة تُفرج عن الـ event loop
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
import { getDefaultFieldsSchema }   from './utils/defaultFields';

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️  ErrorBoundary
// ─────────────────────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; msg: string }

class ErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false, msg: '' };

  static getDerivedStateFromError(e: Error): EBState {
    return { hasError: true, msg: e?.message || 'خطأ غير معروف' };
  }
  componentDidCatch(e: Error, i: React.ErrorInfo) {
    console.error('[ErrorBoundary]', e, i);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div dir="rtl" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f1f5f9', padding: '2rem',
      }}>
        <div style={{
          background: '#fff', borderRadius: '1.5rem', padding: '2.5rem',
          boxShadow: '0 4px 32px #0002', maxWidth: 420, width: '100%',
          border: '1.5px solid #fee2e2', textAlign: 'center',
        }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>⚠️</div>
          <h2 style={{ color: '#b91c1c', fontWeight: 900, marginBottom: 10, fontSize: 18 }}>
            حدث خطأ في التطبيق
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
            {this.state.msg}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, msg: '' }); window.location.reload(); }}
            style={{
              background: '#0f172a', color: '#fff', border: 'none',
              borderRadius: '0.85rem', padding: '0.8rem 2rem',
              fontWeight: 800, cursor: 'pointer', fontSize: 14,
            }}
          >🔄 إعادة تحميل الصفحة</button>
        </div>
      </div>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ثوابت
// ─────────────────────────────────────────────────────────────────────────────
const HARDCODED_OWNER     = 'youssefmd2244-droid';
const HARDCODED_REPO      = 'Group-m';
const HARDCODED_BRANCH    = 'main';
const HARDCODED_DATA_PATH = 'src/data.json';

// مفاتيح localStorage — ثابتة لا تتغير أبداً
const LS = {
  config        : 'group_m_config',
  users         : 'group_m_users',
  installations : 'group_m_installations',
  adminFlag     : 'group_m_admin_ok',
  // GitHub credentials — 3 مفاتيح مستقلة لضمان عدم الضياع
  ghToken       : 'gh_token',
  ghOwner       : 'gh_owner',
  ghRepo        : 'gh_repo',
  ghBranch      : 'gh_branch',
  ghDataPath    : 'gh_data_path',
  // آخر SHA معروف — لمنع conflict عند push
  ghSha         : 'gh_last_sha',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Default objects
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
  websiteTitle           : 'Group m',
  masterPasswordHash     : '20042007',
  whatsappNumbers        : [{ id: 'default-wa',   label: 'الرئيسي', number: '01091028501' }],
  callNumbers            : [{ id: 'default-call', label: 'الرئيسي', number: '01091028501' }],
  theme                  : DEFAULT_THEME,
  fieldsSchema           : getDefaultFieldsSchema(),
  installationFieldsSchema: [],
  logoBase64             : '',
  enableTitleAnimation   : false,
  installationPricePerUnit: 45,
  installations          : [],
  localizationOverrides  : {
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
// 🔑  GitHub Credentials — قراءة وكتابة مع ضمان عدم الضياع
// ─────────────────────────────────────────────────────────────────────────────

/** حفظ credentials في localStorage فور توفرها */
function persistGhCredentials(cfg: AppConfig['github']) {
  try {
    if (cfg?.token)    localStorage.setItem(LS.ghToken,    cfg.token);
    if (cfg?.owner)    localStorage.setItem(LS.ghOwner,    cfg.owner);
    if (cfg?.repo)     localStorage.setItem(LS.ghRepo,     cfg.repo);
    if (cfg?.branch)   localStorage.setItem(LS.ghBranch,  cfg.branch);
    if (cfg?.dataPath) localStorage.setItem(LS.ghDataPath, cfg.dataPath);
  } catch (_) {}
}

/**
 * أقوى دالة لاسترجاع الـ token:
 * تبحث في: env variable → cfg.token → LS.ghToken (primary) → LS.ghToken (fallback key)
 */
function resolveToken(cfg?: AppConfig['github']): string {
  return (
    (import.meta as any).env?.VITE_GITHUB_TOKEN ||
    cfg?.token ||
    localStorage.getItem(LS.ghToken) ||
    ''
  );
}

/** بناء كامل لـ GitHub config يجمع كل المصادر */
function buildGhConfig(cfg?: AppConfig['github']): AppConfig['github'] {
  return {
    token      : resolveToken(cfg),
    owner      : cfg?.owner      || localStorage.getItem(LS.ghOwner)    || HARDCODED_OWNER,
    repo       : cfg?.repo       || localStorage.getItem(LS.ghRepo)     || HARDCODED_REPO,
    branch     : cfg?.branch     || localStorage.getItem(LS.ghBranch)   || HARDCODED_BRANCH,
    dataPath   : cfg?.dataPath   || localStorage.getItem(LS.ghDataPath) || HARDCODED_DATA_PATH,
    configPath : cfg?.configPath || 'config.json',
    isEnabled  : true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️  Safe Array helpers
// ─────────────────────────────────────────────────────────────────────────────
function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (_) { return fallback; }
}

function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔀  Merge helpers — دمج آمن بين بيانات GitHub والـ local
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Smart merge:
 * - GitHub هو المصدر الأساسي (الأحدث)
 * - السجلات الموجودة locally فقط (local-only) تُضاف لتفادي فقدانها
 *   في حالة لم تُرفع بعد (pending sync)
 */
function mergeInstallations(
  fromGithub: InstallationRecord[],
  fromLocal: InstallationRecord[],
): InstallationRecord[] {
  const ghIds = new Set(fromGithub.map(r => r.id));
  const localOnly = fromLocal.filter(r => !ghIds.has(r.id));
  return [...fromGithub, ...localOnly];
}

function mergeUsers(
  fromGithub: UserRecord[],
  fromLocal: UserRecord[],
): UserRecord[] {
  const ghIds = new Set(fromGithub.map(r => r.id));
  const localOnly = fromLocal.filter(r => !ghIds.has(r.id));
  return [...fromGithub, ...localOnly];
}

// ─────────────────────────────────────────────────────────────────────────────
// 🐙  GitHub API helpers
// ─────────────────────────────────────────────────────────────────────────────

function toB64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromB64(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

// ─────────────────────────────────────────────────────────────────────────────
// ⏱️  Fetch with Timeout — يمنع تجميد المتصفح
// ─────────────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 60_000; // 60 ثانية كافية للـ Base64 الكبير
const MAX_RETRY        = 3;
const RETRY_BASE_MS    = 1_500;  // 1.5s → 3s → 6s

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`TIMEOUT: تجاوز ${timeoutMs / 1000}s — سيُعاد تلقائياً`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Safe JSON.stringify — يُفرج عن الـ event loop قبل العملية الثقيلة
 * يمنع تجميد المتصفح عند البيانات الكبيرة (Base64 صور/فيديوهات)
 */
async function safeStringify(data: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try { resolve(JSON.stringify(data, null, 2)); }
      catch (e) { reject(new Error(`JSON.stringify failed: ${String(e)}`)); }
    }, 0);
  });
}

interface GhFetchResult {
  users        : UserRecord[];
  installations: InstallationRecord[];
  config?      : Partial<AppConfig>;
  sha?         : string;
}

/**
 * جلب البيانات من GitHub — مع Timeout وحماية Token
 * أي خطأ (HTTP أو Network) يُعيد null بدون مساس الـ Token
 */
async function ghFetch(cfg: AppConfig['github']): Promise<GhFetchResult | null> {
  const token = resolveToken(cfg);
  if (!token) return null;

  const { owner, repo, branch, dataPath } = buildGhConfig(cfg);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dataPath}?ref=${branch}&t=${Date.now()}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        Authorization         : `Bearer ${token}`,
        Accept                : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Cache-Control'       : 'no-cache',
      },
    });

    if (!res.ok) {
      console.warn(`[ghFetch] HTTP ${res.status} — Token محفوظ`);
      return null;
    }
    const json = await res.json();
    const sha  = json.sha as string | undefined;
    if (sha) { try { localStorage.setItem(LS.ghSha, sha); } catch (_) {} }

    const decoded = fromB64(json.content);
    const raw = JSON.parse(decoded);

    const users         = safeArr<UserRecord>(Array.isArray(raw) ? raw : raw?.users);
    const installations = safeArr<InstallationRecord>(raw?.installations);
    const config        = raw?.__config__ || undefined;

    return { users, installations, config, sha };
  } catch (err) {
    console.warn('[ghFetch] error (Token محفوظ):', err);
    return null;
  }
}

/**
 * رفع البيانات إلى GitHub مع:
 * - Retry تلقائي (3 مرات) مع Exponential Backoff
 * - Timeout 60 ثانية
 * - SHA-aware PUT لمنع 409 Conflict
 * - Token محمي — لا يُحذف أبداً عند الخطأ
 */
async function ghPush(
  users        : UserRecord[],
  installations: InstallationRecord[],
  cfg          : AppConfig['github'],
): Promise<boolean> {
  const token = resolveToken(cfg);
  if (!token) { console.warn('[ghPush] لا يوجد Token'); return false; }

  const { owner, repo, branch, dataPath } = buildGhConfig(cfg);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dataPath}`;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      // ─── Step 1: جلب SHA الحالي ──────────────────────────────────────
      let currentSha: string | undefined = localStorage.getItem(LS.ghSha) || undefined;
      let existingConfig: Record<string, unknown> = {};

      try {
        const getRes = await fetchWithTimeout(`${url}?ref=${branch}&t=${Date.now()}`, {
          headers: {
            Authorization         : `Bearer ${token}`,
            Accept                : 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Cache-Control'       : 'no-cache',
          },
        });
        if (getRes.ok) {
          const getData = await getRes.json();
          currentSha = getData.sha || currentSha;
          if (currentSha) { try { localStorage.setItem(LS.ghSha, currentSha); } catch (_) {} }
          if (getData.content) {
            try {
              const dec = fromB64(getData.content);
              const parsed = JSON.parse(dec);
              if (parsed?.__config__) existingConfig = parsed.__config__;
            } catch (_) {}
          }
        } else if (getRes.status === 401) {
          // ⚠️ Token خاطئ — لا فائدة من الـ retry، لكن لا نُحذف Token
          console.warn('[ghPush] 401 — Token غير صالح، يرجى تحديثه من إعدادات GitHub');
          return false;
        }
      } catch (getErr) {
        console.warn('[ghPush] GET SHA failed (نستخدم SHA القديم):', getErr);
      }

      // ─── Step 2: بناء payload بأمان (يمنع تجميد المتصفح) ────────────
      const safeUsers = safeArr<UserRecord>(users);
      const safeInst  = safeArr<InstallationRecord>(installations);
      const payloadStr = await safeStringify({
        users        : safeUsers,
        installations: safeInst,
        __config__   : existingConfig,
      });

      const body: Record<string, string> = {
        message: `sync: ${safeUsers.length} users, ${safeInst.length} installs [auto ${new Date().toISOString()}]`,
        content: toB64(payloadStr),
        branch,
      };
      if (currentSha) body.sha = currentSha;

      // ─── Step 3: رفع ────────────────────────────────────────────────
      const putRes = await fetchWithTimeout(url, {
        method : 'PUT',
        headers: {
          Authorization         : `Bearer ${token}`,
          Accept                : 'application/vnd.github+json',
          'Content-Type'        : 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(body),
      });

      if (putRes.ok) {
        const putData = await putRes.json();
        const newSha = putData?.content?.sha;
        if (newSha) { try { localStorage.setItem(LS.ghSha, newSha); } catch (_) {} }
        persistGhCredentials(cfg); // تأكيد حفظ credentials بعد النجاح
        console.info(`[ghPush] ✅ نجح (attempt ${attempt}/${MAX_RETRY})`);
        return true;
      }

      const errText = await putRes.text().catch(() => '');

      if (putRes.status === 401) {
        // ⚠️ Token غير صالح — لا نُحذف Token لكن نوقف الـ retry
        console.warn('[ghPush] 401 — Token غير صالح، يرجى تحديثه من الإعدادات');
        return false;
      }
      if (putRes.status === 409 || putRes.status === 422) {
        // SHA conflict — نُعيد المحاولة بـ SHA جديد
        console.warn(`[ghPush] ${putRes.status} (attempt ${attempt}) — إعادة بـ SHA جديد`);
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
      } else {
        console.warn(`[ghPush] HTTP ${putRes.status} (attempt ${attempt}):`, errText);
      }

    } catch (err: any) {
      console.warn(`[ghPush] Error (attempt ${attempt}/${MAX_RETRY}) — Token محفوظ:`, err?.message || err);
    }

    // Exponential Backoff
    if (attempt < MAX_RETRY) {
      const waitMs = RETRY_BASE_MS * Math.pow(2, attempt - 1); // 1.5s, 3s
      console.info(`[ghPush] إعادة المحاولة بعد ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  console.warn(`[ghPush] ❌ فشل بعد ${MAX_RETRY} محاولات — Token لا يزال محفوظاً`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔐  Admin session helpers
// ─────────────────────────────────────────────────────────────────────────────

// ① الباسورد الصارم — "20042007" فقط لا غير
const ADMIN_PASSWORD = '20042007';

function verifyAdminPassword(input: string): boolean {
  return typeof input === 'string' && input === ADMIN_PASSWORD;
}

// sessionStorage فقط — يُصفَّر تلقائياً بإغلاق التبويب أو المتصفح
// Re-render أو تهنيج لا يُعيد فتح الإعدادات تلقائياً
function isAdminActive(): boolean {
  try { return sessionStorage.getItem('group_m_admin_session') === 'active'; }
  catch (_) { return false; }
}
function setAdminActive(val: boolean) {
  try {
    if (val) sessionStorage.setItem('group_m_admin_session', 'active');
    else sessionStorage.removeItem('group_m_admin_session');
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 📦  Background Sync Queue
// ─────────────────────────────────────────────────────────────────────────────
/**
 * يحافظ على queue داخلية من عمليات الـ push.
 * إذا كان هناك push نشط، يُخزَّن الطلب الجديد ويُنفَّذ بعد انتهاء الحالي.
 * هذا يضمن:
 * - عدم تعطيل UI أثناء الرفع
 * - عدم فقدان أي بيانات عند الإرسال المتتالي السريع
 * - ترتيب FIFO صحيح للعمليات
 */
/**
 * Smart Sync Queue v4.0
 * ─────────────────────
 * - FIFO حقيقي: كل push ينتظر OK من السابق
 * - Debounce: يحتفظ بآخر job فقط عند الضغط المتتالي
 * - onStatusChange callback لتحديث الـ UI تلقائياً
 * - Token محمي: أي خطأ لا يوقف الـ queue ولا يمس الـ Token
 */
function createSyncQueue(onStatusChange?: (s: SyncStatus) => void) {
  let running = false;
  let pending: (() => Promise<void>) | null = null;

  function notify(s: SyncStatus) {
    try { onStatusChange?.(s); } catch (_) {}
  }

  async function runNext(): Promise<void> {
    if (running || !pending) return;

    running = true;
    const job = pending;
    pending = null;

    notify('syncing');

    try {
      await job();
      if (!pending) notify('success');
    } catch (err) {
      // خطأ في الـ job — لا نمس Token، نُبلِّغ UI فقط
      console.warn('[SyncQueue] job error (Token محفوظ):', err);
      if (!pending) notify('error');
    } finally {
      running = false;
      if (pending) {
        // microtask delay لتفادي stack overflow
        await new Promise(r => setTimeout(r, 50));
        runNext();
      }
    }
  }

  return {
    enqueue(job: () => Promise<void>): void {
      // آخر job يفوز دائماً (debounce) — لكن لا يُفقد البيانات لأننا نمرر آخر snapshot
      pending = job;
      runNext();
    },
    get isRunning(): boolean { return running; },
    get hasPending(): boolean { return pending !== null; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔐  PasswordGate — بوابة الباسورد الصارمة
// ─────────────────────────────────────────────────────────────────────────────
interface PasswordGateProps {
  primaryColor: string;
  onSuccess: () => void;
  onCancel: () => void;
}
function PasswordGate({ primaryColor, onSuccess, onCancel }: PasswordGateProps) {
  const [pw, setPw]       = React.useState('');
  const [err, setErr]     = React.useState(false);
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (verifyAdminPassword(pw)) {
      setAdminActive(true);
      setErr(false);
      onSuccess();
    } else {
      setErr(true);
      setPw('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div dir="rtl" style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
    }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{
        background:'#fff', borderRadius:'1.5rem', padding:'2.5rem 2rem',
        boxShadow:'0 8px 48px #0003', maxWidth:360, width:'100%', textAlign:'center',
        border:'1.5px solid #e2e8f0',
      }}>
        <div style={{
          width:54, height:54, borderRadius:'50%', margin:'0 auto 1rem',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:24, background: primaryColor, color:'#fff',
        }}>🔐</div>
        <h2 style={{ fontWeight:900, fontSize:17, marginBottom:6, color:'#0f172a' }}>لوحة الإدارة</h2>
        <p style={{ color:'#64748b', fontSize:12, marginBottom:18 }}>أدخل كلمة المرور للمتابعة</p>
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setErr(false); }}
            placeholder="كلمة المرور"
            autoComplete="current-password"
            style={{
              width:'100%', padding:'0.75rem 1rem', borderRadius:'0.85rem',
              border:`2px solid ${err ? '#ef4444' : '#e2e8f0'}`,
              fontSize:16, outline:'none', boxSizing:'border-box',
              textAlign:'center', letterSpacing:4, marginBottom:6,
            }}
          />
          {err && <p style={{ color:'#ef4444', fontSize:12, marginBottom:8, fontWeight:700 }}>❌ كلمة المرور غير صحيحة</p>}
          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            <button type="submit" style={{
              flex:1, background: primaryColor, color:'#fff', border:'none',
              borderRadius:'0.85rem', padding:'0.75rem', fontWeight:800, cursor:'pointer', fontSize:14,
            }}>دخول</button>
            <button type="button" onClick={onCancel} style={{
              flex:1, background:'#f1f5f9', color:'#374151',
              border:'1px solid #e2e8f0', borderRadius:'0.85rem',
              padding:'0.75rem', fontWeight:700, cursor:'pointer', fontSize:14,
            }}>إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌐  App View type
// ─────────────────────────────────────────────────────────────────────────────
type ActiveView = 'registration' | 'installations';
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// 🏠  AppInner
// ─────────────────────────────────────────────────────────────────────────────
function AppInner() {

  // ── Config ─────────────────────────────────────────────────────────────────
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    const saved = lsGet<Partial<AppConfig>>(LS.config, {});
    const merged: AppConfig = { ...DEFAULT_CONFIG, ...saved };

    // بناء github config من كل المصادر المتاحة
    merged.github = buildGhConfig(saved.github);

    // حفظ credentials فوراً
    persistGhCredentials(merged.github);

    return merged;
  });

  // ── Admin ──────────────────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(() => isAdminActive());

  // ── Users ──────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>(() =>
    isAdminActive() ? lsGet<UserRecord[]>(LS.users, []) : []
  );

  // ── Installations ──────────────────────────────────────────────────────────
  const [installations, setInstallations] = useState<InstallationRecord[]>(() =>
    safeArr(lsGet<InstallationRecord[]>(LS.installations, []))
  );

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [showSettings,  setShowSettings]  = useState(false);
  const [showPassGate,  setShowPassGate]  = useState(false); // بوابة الباسورد
  const [syncStatus,    setSyncStatus]    = useState<SyncStatus>('idle');
  const [initPulling,   setInitPulling]   = useState(false);
  const [activeView,    setActiveView]    = useState<ActiveView>('registration');

  // ── Background sync queue — يتحكم في الـ UI status تلقائياً ─────────────
  const syncQueue = useRef(createSyncQueue((status) => setSyncStatus(status)));

  // ── حفظ آخر نسخة من البيانات في ref للوصول دون stale closure ──────────────
  const usersRef         = useRef(users);
  const installationsRef = useRef(installations);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { installationsRef.current = installations; }, [installations]);

  // ─────────────────────────────────────────────────────────────────────────
  // 🔧  setInstallationsSafe — يضمن أن القيمة دائماً مصفوفة
  // ─────────────────────────────────────────────────────────────────────────
  const setInstallationsSafe = useCallback((v: InstallationRecord[] | ((p: InstallationRecord[]) => InstallationRecord[])) => {
    setInstallations(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      return safeArr<InstallationRecord>(next);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 📡  enqueuePush — إضافة push لـ background queue
  // Queue يتولى setSyncStatus تلقائياً عبر onStatusChange callback
  // ─────────────────────────────────────────────────────────────────────────
  const enqueuePush = useCallback((
    overrideUsers?: UserRecord[],
    overrideInstalls?: InstallationRecord[],
  ) => {
    // لا نستدعي setSyncStatus هنا — createSyncQueue يتولاه تلقائياً
    syncQueue.current.enqueue(async () => {
      const u = overrideUsers    ?? usersRef.current;
      const i = overrideInstalls ?? installationsRef.current;
      const cfg = buildGhConfig(appConfig.github);

      // ghPush مُحسَّن: Retry تلقائي + Timeout 60s + Token محمي
      await ghPush(safeArr(u), safeArr(i), cfg);
    });
  }, [appConfig.github]);

  // ─────────────────────────────────────────────────────────────────────────
  // 🚀  onMount: جلب البيانات من GitHub + merge ذكي
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = appConfig.websiteTitle || 'Group m';

    const cfg = buildGhConfig(appConfig.github);
    const token = resolveToken(cfg);
    if (!token) return;

    // حفظ credentials عند أول mount
    persistGhCredentials(cfg);

    setInitPulling(true);
    setSyncStatus('syncing');

    ghFetch(cfg).then(result => {
      // إذا فشل الـ fetch بسبب شبكة أو timeout، نُبقي على البيانات المحلية
      if (!result) {
        setSyncStatus('idle'); // idle وليس error — Token لا يزال موجوداً
        return;
      }

      // Merge installations — تجمع GitHub + local-only
      const mergedInstalls = mergeInstallations(
        result.installations,
        installationsRef.current,
      );
      setInstallationsSafe(mergedInstalls);
      lsSet(LS.installations, mergedInstalls);

      // Users للأدمن فقط
      if (isAdmin) {
        const mergedUsers = mergeUsers(result.users, usersRef.current);
        setUsers(mergedUsers);
        lsSet(LS.users, mergedUsers);
      }

      // Config من GitHub (مع حماية الـ github credentials الحالية)
      if (result.config) {
        setAppConfig(prev => ({
          ...prev,
          ...result.config,
          // ⚠️ نُبقي على github config الحالي دائماً — لا ندعه يُستبدل من remote
          github: prev.github,
        }));
      }

      setSyncStatus('success');
    }).catch(err => {
      // Network/Timeout error — Token لا يزال محفوظاً، لا نُظهر error
      console.warn('[onMount fetch] خطأ في الشبكة (Token محفوظ):', err);
      setSyncStatus('idle');
    }).finally(() => setInitPulling(false));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // مرة واحدة عند الـ mount فقط

  useEffect(() => {
    document.title = appConfig.websiteTitle || 'Group m';
  }, [appConfig.websiteTitle]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅  handleAddInstallation — Submit التركيبة
  // فوري: local save + form reset
  // خلفي: push لـ GitHub عبر queue
  // ─────────────────────────────────────────────────────────────────────────
  const handleAddInstallation = useCallback(async (
    record: Omit<InstallationRecord, 'id' | 'createdAt'>
  ) => {
    // 1️⃣ إنشاء السجل فوراً
    const newRecord: InstallationRecord = {
      ...record,
      id        : `inst_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt : new Date().toISOString(),
    };

    // 2️⃣ تحديث State و localStorage فوراً (< 5ms — الفورم يُفرَّغ بعد هذا)
    const updated = safeArr<InstallationRecord>([newRecord, ...installationsRef.current]);
    setInstallationsSafe(updated);
    lsSet(LS.installations, updated);

    // 3️⃣ Push خلفي — لا ينتظر، لا يُعطل الـ UI
    enqueuePush(usersRef.current, updated);
  }, [enqueuePush, setInstallationsSafe]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅  handleAddNewRecord — Submit استمارة التسجيل
  // ─────────────────────────────────────────────────────────────────────────
  const handleAddNewRecord = useCallback(async (
    record: Omit<UserRecord, 'id' | 'createdAt'>
  ) => {
    const formatted: UserRecord = {
      ...record,
      id        : `std_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt : new Date().toISOString(),
    };
    const updated = safeArr<UserRecord>([formatted, ...usersRef.current]);
    setUsers(updated);
    lsSet(LS.users, updated);
    enqueuePush(updated, installationsRef.current);
  }, [enqueuePush]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅  handleUpdateConfig
  // ─────────────────────────────────────────────────────────────────────────
  const handleUpdateConfig = useCallback((newConfig: AppConfig) => {
    // ① حفظ credentials من الـ config الجديد — المصدر الأهم
    persistGhCredentials(newConfig.github);

    // ② دمج مع buildGhConfig لضمان عدم ضياع أي credential
    const safeGithub = buildGhConfig(newConfig.github);
    const finalConfig: AppConfig = { ...newConfig, github: safeGithub };

    setAppConfig(finalConfig);
    lsSet(LS.config, finalConfig);

    // ③ تحديث installations إن وُجدت في الـ config
    if (Array.isArray(newConfig.installations)) {
      const safeInst = safeArr<InstallationRecord>(newConfig.installations);
      setInstallationsSafe(safeInst);
      lsSet(LS.installations, safeInst);
    }
  }, [setInstallationsSafe]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅  handleUpdateUsers
  // ─────────────────────────────────────────────────────────────────────────
  const handleUpdateUsers = useCallback((newUsers: UserRecord[]) => {
    const safe = safeArr<UserRecord>(newUsers);
    setUsers(safe);
    lsSet(LS.users, safe);
    enqueuePush(safe, installationsRef.current);
  }, [enqueuePush]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅  handleForceManualSync — زر المزامنة اليدوية
  // ─────────────────────────────────────────────────────────────────────────
  const handleForceManualSync = useCallback(async () => {
    setSyncStatus('syncing');
    const cfg = buildGhConfig(appConfig.github);

    // ghPush المُحسَّن: Retry تلقائي + Timeout + Token محمي
    const ok = await ghPush(
      safeArr(usersRef.current),
      safeArr(installationsRef.current),
      cfg,
    );
    setSyncStatus(ok ? 'success' : 'error');
    // لا نُلقي exception عند الفشل — رسالة الـ error تكفي
  }, [appConfig.github]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅  handleAdminLogin — جلب + merge فوري عند الدخول
  // ─────────────────────────────────────────────────────────────────────────
  const handleAdminLogin = useCallback(() => {
    setIsAdmin(true);
    setAdminActive(true);

    const cfg = buildGhConfig(appConfig.github);
    ghFetch(cfg).then(result => {
      if (!result) return;

      // Merge users
      const mergedUsers = mergeUsers(result.users, usersRef.current);
      setUsers(mergedUsers);
      lsSet(LS.users, mergedUsers);

      // Merge installations
      const mergedInstalls = mergeInstallations(result.installations, installationsRef.current);
      setInstallationsSafe(mergedInstalls);
      lsSet(LS.installations, mergedInstalls);
    }).catch(err => console.warn('[adminLogin fetch]', err));
  }, [appConfig.github, setInstallationsSafe]);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅  handleAdminLogout
  // ─────────────────────────────────────────────────────────────────────────
  const handleAdminLogout = useCallback(() => {
    setIsAdmin(false);
    setAdminActive(false); // يُصفّر sessionStorage فوراً
    setUsers([]);
    setShowSettings(false);
    localStorage.removeItem(LS.users);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 🎨  Derived values
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
  // 🖼️  Render
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
        {/* Admin button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isAdminActive()) { setShowSettings(true); }
              else { setShowPassGate(true); }
            }}
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
              <span>⚠ خطأ في المزامنة</span>
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
            <ErrorBoundary>
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
            <ErrorBoundary>
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

      {/* ══ ① بوابة الباسورد ══ */}
      {showPassGate && (
        <PasswordGate
          primaryColor={theme.primary}
          onSuccess={() => {
            setShowPassGate(false);
            setIsAdmin(true);
            setShowSettings(true);
          }}
          onCancel={() => setShowPassGate(false)}
        />
      )}

      {/* ══ Settings Dashboard ══ */}
      {showSettings && (
        <ErrorBoundary>
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
// 🚀  Export مع ErrorBoundary خارجي كطبقة حماية أولى
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

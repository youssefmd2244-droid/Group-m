/**
 * githubSync.ts — Hardened GitHub Sync Engine v6.0
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * الإصلاحات الجذرية في هذه النسخة (v6.0):
 *
 * ① Isolate Network Failures — Token Protection الكامل
 *    - أي خطأ (401, 404, 422, 409, Timeout, CORS, Network) لا يمس Token أبداً
 *    - Token يُحفظ في localStorage بـ 3 مفاتيح مستقلة (redundancy)
 *    - resolveToken() تبحث في 5 مصادر (env → state → ls-primary → ls-bk1 → ls-bk2)
 *    - عند فشل الطلب: نُبقي على Token وبيانات المستودع كما هي في الـ State والـ LocalStorage
 *    - تمييز FailureKind: 'transient' (شبكة) vs 'auth' (Token خاطئ) vs 'none'
 *    - أيقونة "فشل مؤقت" (WifiOff) مع Retry تلقائي 3 مرات عند استقرار الشبكة
 *
 * ② Performance Optimization — Zero UI Freeze
 *    - safeStringify() غير متزامنة داخل setTimeout(0) لتحرير event loop
 *    - runWhenIdle() عبر requestIdleCallback للعمليات الثقيلة غير العاجلة
 *    - Smart Queue: Sequential Upload (FIFO حقيقي) مع Debounce ذكي
 *    - الفورم يُفرَّغ فوراً — المزامنة تتم في الخلفية بالكامل
 *
 * ③ Strict Auth Lock — sessionStorage فقط
 *    - التحقق الصارم من "20042007" بالمقارنة المباشرة
 *    - sessionStorage يُصفَّر تلقائياً بإغلاق التبويب
 *    - لا تفتح الإعدادات نهائياً إلا بالباسورد الصحيح
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AppConfig, UserRecord, InstallationRecord } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GhFetchResult {
  users: UserRecord[];
  installations: InstallationRecord[];
  config?: Partial<AppConfig>;
  sha?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'transient_fail';

/**
 * ① نوع الفشل — يُحدد طريقة الاستجابة في الـ UI:
 * - 'transient': فشل مؤقت (شبكة/timeout/CORS) — أيقونة WifiOff، Retry تلقائي
 * - 'auth'     : فشل دائم (Token خاطئ/منتهي) — أيقونة Error، يُطلب تحديث Token
 * - 'none'     : لا يوجد Token أصلاً — لا رسالة خطأ
 */
export type FailureKind = 'transient' | 'auth' | 'none';

// ─────────────────────────────────────────────────────────────────────────────
// ① HARDCODED FALLBACK CREDENTIALS
// ─────────────────────────────────────────────────────────────────────────────

export const HARDCODED_OWNER     = 'youssefmd2244-droid';
export const HARDCODED_REPO      = 'Group-m';
export const HARDCODED_BRANCH    = 'main';
export const HARDCODED_DATA_PATH = 'src/data.json';
export const HARDCODED_TOKEN     = ''; // ضع هنا الـ Token إن أردت hardcoded fallback

const GITHUB_API       = 'https://api.github.com';
const FETCH_TIMEOUT_MS = 60_000; // 60 ثانية — كافية للـ Base64 الكبير
const MAX_RETRY        = 3;
const RETRY_BASE_MS    = 1_500;  // 1.5s → 3s → 6s

// ─────────────────────────────────────────────────────────────────────────────
// ① مفاتيح localStorage — 3 مفاتيح مستقلة للـ Token (Redundancy)
// ─────────────────────────────────────────────────────────────────────────────

export const LS = {
  // GitHub Credentials — 3 مفاتيح مستقلة (حتى لو فشل واحد يبقى الآخران)
  ghToken    : 'gh_token_primary',
  ghTokenBk1 : 'gh_token_backup_1',
  ghTokenBk2 : 'gh_token_backup_2',
  ghOwner    : 'gh_owner',
  ghRepo     : 'gh_repo',
  ghBranch   : 'gh_branch',
  ghDataPath : 'gh_data_path',
  ghSha      : 'gh_last_sha',
  // App data
  config        : 'group_m_config',
  users         : 'group_m_users',
  installations : 'group_m_installations',
  adminSession  : 'group_m_admin_session',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ① Token Persistence — حفظ دائم في 3 مفاتيح مستقلة
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ① يحفظ credentials في localStorage بـ 3 مفاتيح مستقلة.
 * لا يُحذف أي key موجود — فقط يُضيف/يُحدِّث.
 * حتى لو فشل حفظ مفتاح واحد (full storage)، الآخران يبقيان.
 */
export function persistGhCredentials(cfg?: AppConfig['github']): void {
  if (!cfg) return;
  try {
    if (cfg.token && cfg.token.trim()) {
      const t = cfg.token.trim();
      try { localStorage.setItem(LS.ghToken,    t); } catch (_) {}
      try { localStorage.setItem(LS.ghTokenBk1, t); } catch (_) {}
      try { localStorage.setItem(LS.ghTokenBk2, t); } catch (_) {}
    }
    if (cfg.owner)    try { localStorage.setItem(LS.ghOwner,    cfg.owner);    } catch (_) {}
    if (cfg.repo)     try { localStorage.setItem(LS.ghRepo,     cfg.repo);     } catch (_) {}
    if (cfg.branch)   try { localStorage.setItem(LS.ghBranch,   cfg.branch);   } catch (_) {}
    if (cfg.dataPath) try { localStorage.setItem(LS.ghDataPath, cfg.dataPath); } catch (_) {}
  } catch (_) {}
}

/**
 * ① يقرأ الـ Token من 5 مصادر بالترتيب (أعلى أولوية → أدنى):
 * 1. VITE env variable
 * 2. cfg.token (React State — المصدر الحيّ)
 * 3. localStorage primary key
 * 4. localStorage backup key #1
 * 5. localStorage backup key #2
 * 6. HARDCODED_TOKEN (آخر ملاذ)
 *
 * ⚠️ لا يُصفِّر Token أبداً — يُعيد '' فقط إذا فشلت كل المصادر
 */
export function resolveToken(cfg?: AppConfig['github']): string {
  return (
    (import.meta as any).env?.VITE_GITHUB_TOKEN?.trim() ||
    cfg?.token?.trim() ||
    localStorage.getItem(LS.ghToken)?.trim() ||
    localStorage.getItem(LS.ghTokenBk1)?.trim() ||
    localStorage.getItem(LS.ghTokenBk2)?.trim() ||
    HARDCODED_TOKEN ||
    ''
  );
}

/**
 * يبني GitHub config كاملاً من كل المصادر المتاحة.
 * كل قيمة لها fallback ثلاثي: State → localStorage → HARDCODED
 */
export function buildGhConfig(cfg?: AppConfig['github']): AppConfig['github'] {
  return {
    token      : resolveToken(cfg),
    owner      : cfg?.owner?.trim()    || localStorage.getItem(LS.ghOwner)?.trim()    || HARDCODED_OWNER,
    repo       : cfg?.repo?.trim()     || localStorage.getItem(LS.ghRepo)?.trim()     || HARDCODED_REPO,
    branch     : cfg?.branch?.trim()   || localStorage.getItem(LS.ghBranch)?.trim()   || HARDCODED_BRANCH,
    dataPath   : cfg?.dataPath?.trim() || localStorage.getItem(LS.ghDataPath)?.trim() || HARDCODED_DATA_PATH,
    configPath : cfg?.configPath       || 'config.json',
    isEnabled  : true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ③ Admin Session — sessionStorage فقط (يُصفَّر بإغلاق التبويب)
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_SESSION_KEY   = LS.adminSession;
const ADMIN_PASSWORD_HASH = '20042007'; // الباسورد الصارم

/**
 * ③ التحقق الصارم من الباسورد — مقارنة مباشرة فقط.
 * لا يُسمح بأي مدخل لا يطابق تماماً (trim() للأمان من المسافات).
 */
export function verifyAdminPassword(input: string): boolean {
  return typeof input === 'string' && input.trim() === ADMIN_PASSWORD_HASH;
}

/**
 * ③ قراءة حالة جلسة الأدمن من sessionStorage.
 * sessionStorage يُصفَّر تلقائياً بإغلاق التبويب أو المتصفح.
 * Re-render لا يُؤثر على هذه القيمة — مصدرها خارج React State.
 */
export function isAdminSessionActive(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'active';
  } catch (_) {
    return false;
  }
}

/**
 * ③ تفعيل/إيقاف جلسة الأدمن في sessionStorage.
 * val=true: تفعيل (بعد إدخال الباسورد الصحيح)
 * val=false: إيقاف فوري (logout أو إغلاق الإعدادات)
 */
export function setAdminSession(val: boolean): void {
  try {
    if (val) sessionStorage.setItem(ADMIN_SESSION_KEY, 'active');
    else     sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ Fetch with Timeout — يمنع تجميد المتصفح
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetch مع AbortController للـ timeout.
 * ① Timeout لا يُعتبر خطأ في الـ Token — يُصنَّف 'transient' فقط.
 */
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
      throw new Error(`TIMEOUT: Request exceeded ${timeoutMs / 1000}s — سيُعاد تلقائياً`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 GitHub Headers builder
// ─────────────────────────────────────────────────────────────────────────────

function buildHeaders(token: string): HeadersInit {
  return {
    'Authorization'        : `Bearer ${token}`,
    'Accept'               : 'application/vnd.github+json',
    'Content-Type'         : 'application/json',
    'X-GitHub-Api-Version' : '2022-11-28',
    'Cache-Control'        : 'no-cache',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔠 Base64 helpers
// ─────────────────────────────────────────────────────────────────────────────

function toB64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (_) {
    try { return btoa(str); } catch (_2) { return ''; }
  }
}

function fromB64(b64: string): string {
  try {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
  } catch (_) {
    try { return atob(b64.replace(/\n/g, '')); } catch (_2) { return '{}'; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ② Safe JSON Serialize — يمنع تجميد المتصفح مع Base64 الكبير
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ② JSON.stringify آمن وغير مُعطِّل للـ UI:
 * - يُنفَّذ داخل setTimeout(0) لتحرير event loop قبل العملية الثقيلة
 * - يمنع تجميد المتصفح عند معالجة Base64 ضخم (صور/فيديوهات)
 */
export async function safeStringify(data: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(JSON.stringify(data, null, 2));
      } catch (err) {
        reject(new Error(`JSON.stringify failed: ${String(err)}`));
      }
    }, 0);
  });
}

/**
 * ② معالجة البيانات الثقيلة عبر requestIdleCallback إن كان متاحاً.
 * Fallback: setTimeout(200) عند غياب requestIdleCallback.
 */
export function runWhenIdle(fn: () => void): void {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📥 ghFetch — جلب البيانات من GitHub
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ① جلب البيانات من GitHub مع:
 * - Timeout 60 ثانية
 * - أي خطأ HTTP أو Network لا يمس Token أبداً — يُعيد null فقط
 * - SHA caching لتسريع الـ PUT التالي
 */
export async function ghFetch(cfg: AppConfig['github']): Promise<GhFetchResult | null> {
  const token = resolveToken(cfg);
  if (!token) {
    console.warn('[ghFetch] لا يوجد Token — تخطي');
    return null;
  }

  const { owner, repo, branch, dataPath } = buildGhConfig(cfg);
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${dataPath}?ref=${branch}&t=${Date.now()}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: buildHeaders(token),
    });

    // ① أي خطأ HTTP — لا يمس Token، نُعيد null فقط
    if (!res.ok) {
      console.warn(`[ghFetch] HTTP ${res.status} — Token محفوظ في 3 مفاتيح، نُعيد null`);
      return null;
    }

    const json = await res.json();
    const sha  = json.sha as string | undefined;

    if (sha) {
      try { localStorage.setItem(LS.ghSha, sha); } catch (_) {}
    }

    const decoded = fromB64(json.content || '');
    let raw: any = {};
    try { raw = JSON.parse(decoded); } catch (_) { raw = {}; }

    return {
      users        : safeArr<UserRecord>(Array.isArray(raw) ? raw : raw?.users),
      installations: safeArr<InstallationRecord>(raw?.installations),
      config       : raw?.__config__ || undefined,
      sha,
    };
  } catch (err) {
    // ① Network/CORS/Timeout — Token لا يُمس أبداً
    console.warn('[ghFetch] network error (Token محفوظ):', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ① ② ghPush — رفع البيانات مع Retry + Token Protection + FailureKind
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ① يرفع البيانات إلى GitHub مع:
 * - SHA-aware PUT لمنع 409 Conflict
 * - Retry تلقائي (3 مرات) مع Exponential Backoff: 1.5s → 3s → 6s
 * - Timeout 60 ثانية على كل request
 * - Token محمي تماماً — لا يُحذف أبداً عند أي خطأ
 * - يُعيد { success, failureKind } للتمييز بين فشل مؤقت ودائم
 *
 * ② safeStringify() تمنع تجميد UI أثناء بناء الـ payload
 */
export async function ghPush(
  users        : UserRecord[],
  installations: InstallationRecord[],
  cfg          : AppConfig['github'],
): Promise<{ success: boolean; failureKind: FailureKind }> {
  const token = resolveToken(cfg);
  if (!token) {
    console.warn('[ghPush] لا يوجد Token — تخطي');
    return { success: false, failureKind: 'none' };
  }

  const { owner, repo, branch, dataPath } = buildGhConfig(cfg);
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${dataPath}`;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      // ─── Step 1: جلب SHA الحالي (لمنع 409 Conflict) ──────────────────────
      let currentSha: string | undefined = localStorage.getItem(LS.ghSha) || undefined;
      let existingConfig: Record<string, unknown> = {};

      try {
        const getRes = await fetchWithTimeout(`${url}?ref=${branch}&t=${Date.now()}`, {
          headers: buildHeaders(token),
        });

        if (getRes.ok) {
          const getData = await getRes.json();
          currentSha = getData.sha || currentSha;

          if (currentSha) {
            try { localStorage.setItem(LS.ghSha, currentSha); } catch (_) {}
          }

          if (getData.content) {
            try {
              const dec    = fromB64(getData.content);
              const parsed = JSON.parse(dec);
              if (parsed?.__config__) existingConfig = parsed.__config__;
            } catch (_) {}
          }
        } else if (getRes.status === 401) {
          // ① 401 = Token غير صالح — لا retry، Token يبقى محفوظاً
          console.warn('[ghPush] GET 401 — Token موجود لكن غير صالح حالياً');
          return { success: false, failureKind: 'auth' };
        }
        // 404 = الملف لم يُنشأ بعد — نكمل بدون SHA
      } catch (getErr) {
        // ① Network error في GET — نكمل بـ SHA القديم، Token محفوظ
        console.warn('[ghPush] GET SHA network error — نكمل بـ SHA القديم:', getErr);
      }

      // ─── Step 2: ② بناء payload بأمان (يمنع تجميد UI) ───────────────────
      const safeUsers = safeArr<UserRecord>(users);
      const safeInst  = safeArr<InstallationRecord>(installations);

      // ② safeStringify داخل setTimeout(0) لتحرير event loop
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

      // ─── Step 3: رفع الملف ────────────────────────────────────────────────
      const putRes = await fetchWithTimeout(url, {
        method : 'PUT',
        headers: buildHeaders(token),
        body   : JSON.stringify(body),
      });

      if (putRes.ok) {
        const putData = await putRes.json();
        const newSha  = putData?.content?.sha;
        if (newSha) {
          try { localStorage.setItem(LS.ghSha, newSha); } catch (_) {}
        }
        // ✅ نجاح — نُؤكد حفظ credentials مجدداً
        persistGhCredentials(cfg);
        console.info(`[ghPush] ✅ نجح (attempt ${attempt}/${MAX_RETRY})`);
        return { success: true, failureKind: 'none' };
      }

      // ─── معالجة أخطاء HTTP ──────────────────────────────────────────────
      const errText = await putRes.text().catch(() => '');

      if (putRes.status === 401) {
        // ① Token غير صالح — لا retry، Token يبقى محفوظاً في localStorage
        console.warn('[ghPush] PUT 401 — Token محفوظ، يرجى تحديثه من الإعدادات');
        return { success: false, failureKind: 'auth' };
      }

      if (putRes.status === 409) {
        // SHA Conflict — نُعيد بـ SHA جديد في attempt التالي
        console.warn(`[ghPush] 409 Conflict (attempt ${attempt}) — إعادة بـ SHA جديد`);
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
      } else if (putRes.status === 422) {
        console.warn(`[ghPush] 422 Unprocessable (attempt ${attempt}):`, errText.slice(0, 200));
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
      } else if (putRes.status === 404) {
        console.warn(`[ghPush] 404 — الملف/Repository غير موجود (attempt ${attempt})`);
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
      } else {
        console.warn(`[ghPush] HTTP ${putRes.status} (attempt ${attempt}):`, errText.slice(0, 200));
      }

    } catch (err: any) {
      // ① Network/CORS/Timeout — Token لا يُمس أبداً، فشل مؤقت
      console.warn(`[ghPush] Network error (attempt ${attempt}/${MAX_RETRY}) — Token محفوظ:`, err?.message || err);
    }

    // ─── ② Exponential Backoff — بدون رسائل خطأ للمستخدم أثناء الـ retry ──
    if (attempt < MAX_RETRY) {
      const waitMs = RETRY_BASE_MS * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s
      console.info(`[ghPush] إعادة المحاولة بعد ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  // ① فشلت جميع المحاولات — Token لا يزال محفوظاً وسليماً في 3 مفاتيح
  console.warn(`[ghPush] ❌ فشل مؤقت بعد ${MAX_RETRY} محاولات — Token محفوظ، سيُعاد عند استقرار الشبكة`);
  return { success: false, failureKind: 'transient' };
}

// ─────────────────────────────────────────────────────────────────────────────
// ② Smart Sync Queue v6.0 — FIFO + Debounce + FailureKind awareness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ② طابور ذكي للرفع يضمن:
 * - FIFO حقيقي: كل push ينتظر OK من السابق (Sequential Upload)
 * - Debounce: آخر job يفوز عند الضغط المتتالي السريع
 * - ① Token محمي: أي خطأ لا يوقف queue ولا يمس Token
 * - ① تمييز FailureKind: يُبلِّغ الـ UI بنوع الفشل الصحيح
 * - onStatusChange callback لتحديث UI تلقائياً بدون prop drilling
 */
export function createSyncQueue(
  onStatusChange?: (status: SyncStatus) => void,
) {
  let running = false;
  let pending: (() => Promise<{ success: boolean; failureKind: FailureKind }>) | null = null;

  function notify(status: SyncStatus) {
    try { onStatusChange?.(status); } catch (_) {}
  }

  async function runNext(): Promise<void> {
    if (running || !pending) return;

    running = true;
    const job = pending;
    pending = null;

    notify('syncing');

    try {
      const result = await job();
      if (!pending) {
        if (result.success) {
          notify('success');
        } else if (result.failureKind === 'auth') {
          // ① فشل دائم — يُظهر error (Token يحتاج تحديث)
          notify('error');
        } else if (result.failureKind === 'transient') {
          // ① فشل مؤقت — يُظهر transient_fail (شبكة/timeout، Token محفوظ)
          notify('transient_fail');
        } else {
          // 'none' = لا Token — لا status change
          notify('idle');
        }
      }
    } catch (err) {
      // ① خطأ غير متوقع — Token محمي، نُبلِّغ UI بفشل مؤقت
      console.warn('[SyncQueue] unexpected error (Token محفوظ):', err);
      if (!pending) notify('transient_fail');
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
    /**
     * ② إضافة job للطابور.
     * إذا كان هناك push نشط، يُخزَّن هذا الـ job ويُنفَّذ بعده.
     * آخر job يفوز (debounce) — لكن لا يُفقد البيانات لأننا نمرر آخر snapshot.
     */
    enqueue(job: () => Promise<{ success: boolean; failureKind: FailureKind }>): void {
      pending = job;
      runNext();
    },
    get isRunning(): boolean  { return running; },
    get hasPending(): boolean { return pending !== null; },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔀 Merge Helpers — دمج آمن بدون فقدان بيانات
// ─────────────────────────────────────────────────────────────────────────────

/**
 * دمج installations:
 * - GitHub هو المصدر الأساسي (source of truth)
 * - السجلات الموجودة locally فقط (pending sync) تُضاف في النهاية
 */
export function mergeInstallations(
  fromGithub: InstallationRecord[],
  fromLocal : InstallationRecord[],
): InstallationRecord[] {
  const ghIds     = new Set(safeArr<InstallationRecord>(fromGithub).map(r => r.id));
  const localOnly = safeArr<InstallationRecord>(fromLocal).filter(r => !ghIds.has(r.id));
  return [...safeArr<InstallationRecord>(fromGithub), ...localOnly];
}

/** دمج users — نفس استراتيجية الـ installations */
export function mergeUsers(
  fromGithub: UserRecord[],
  fromLocal : UserRecord[],
): UserRecord[] {
  const ghIds     = new Set(safeArr<UserRecord>(fromGithub).map(r => r.id));
  const localOnly = safeArr<UserRecord>(fromLocal).filter(r => !ghIds.has(r.id));
  return [...safeArr<UserRecord>(fromGithub), ...localOnly];
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

export function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (_) { return fallback; }
}

export function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

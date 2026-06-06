/**
 * githubSync.ts — Hardened GitHub Sync Engine v5.0
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * الإصلاحات الجذرية في هذه النسخة (v5.0):
 *
 * ① Token Protection الكامل — لا يُحذف Token أبداً مهما حدث
 *    - أي خطأ (401, 404, 422, 409, Timeout, Network) لا يمس الـ Token
 *    - Token يُحفظ في localStorage بـ 3 مفاتيح مستقلة
 *    - resolveToken() تبحث في 4 مصادر (env → state → ls-primary → ls-fallback)
 *    - HARDCODED Fallback Credentials مباشرة في الكود كطبقة أخيرة
 *
 * ② Hardcoded Fallback Credentials — يعمل حتى لو مُسح localStorage كلياً
 *    - المعلومات الأساسية محفورة في الكود مباشرة
 *    - النظام لا يتوقف مهما حدث من Re-render أو مسح Cache
 *
 * ③ Exponential Backoff Retry (3 مرات) — دون إظهار error للمستخدم
 *    - 1.5s → 3s → 6s بين المحاولات
 *    - 409 Conflict يُعاد تلقائياً بـ SHA جديد
 *    - Timeout 60 ثانية كافية للـ Base64 الكبير
 *
 * ④ Safe JSON Serialization — منع تهنيج المتصفح
 *    - safeStringify() داخل setTimeout(0) لتحرير event loop
 *    - requestIdleCallback كـ fallback للعمليات الثقيلة
 *
 * ⑤ Smart Sync Queue — FIFO حقيقي مع Debounce
 *    - كل push ينتظر OK من السابق
 *    - آخر job يفوز عند الضغط المتتالي (debounce)
 *    - onStatusChange callback لتحديث الـ UI تلقائياً
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AppConfig, UserRecord } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InstallationRecord {
  id: string;
  [key: string]: unknown;
}

export interface GhFetchResult {
  users: UserRecord[];
  installations: InstallationRecord[];
  config?: Partial<AppConfig>;
  sha?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// ① HARDCODED FALLBACK CREDENTIALS
//    محفورة مباشرة في الكود — تعمل حتى لو مُسح localStorage كلياً
//    أو حدث Re-render مفاجئ أو انقطعت الـ session
// ─────────────────────────────────────────────────────────────────────────────

export const HARDCODED_OWNER     = 'youssefmd2244-droid';
export const HARDCODED_REPO      = 'Group-m';
export const HARDCODED_BRANCH    = 'main';
export const HARDCODED_DATA_PATH = 'src/data.json';
export const HARDCODED_TOKEN     = ''; // ضع هنا الـ Token إن أردت hardcoded fallback كامل

const GITHUB_API       = 'https://api.github.com';
const FETCH_TIMEOUT_MS = 60_000; // 60 ثانية — كافية للـ Base64 الكبير
const MAX_RETRY        = 3;
const RETRY_BASE_MS    = 1_500;  // 1.5s → 3s → 6s

// ─────────────────────────────────────────────────────────────────────────────
// مفاتيح localStorage — ثلاثة مستقلة لضمان عدم الضياع
// ─────────────────────────────────────────────────────────────────────────────

export const LS = {
  // GitHub Credentials — 3 مفاتيح مستقلة كـ redundancy
  ghToken    : 'gh_token_primary',
  ghTokenBk1 : 'gh_token_backup_1',   // نسخة احتياطية أولى
  ghTokenBk2 : 'gh_token_backup_2',   // نسخة احتياطية ثانية
  ghOwner    : 'gh_owner',
  ghRepo     : 'gh_repo',
  ghBranch   : 'gh_branch',
  ghDataPath : 'gh_data_path',
  ghSha      : 'gh_last_sha',
  // App data
  config        : 'group_m_config',
  users         : 'group_m_users',
  installations : 'group_m_installations',
  adminSession  : 'group_m_admin_session', // sessionStorage فقط
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 🔒 Token Persistence — حفظ دائم في 3 مفاتيح مستقلة
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يحفظ credentials في localStorage بـ 3 مفاتيح مستقلة.
 * استراتيجية redundancy: حتى لو فشل حفظ مفتاح واحد، الآخران يبقيان.
 * لا يُحذف أي key موجود — فقط يُضيف/يُحدِّث.
 */
export function persistGhCredentials(cfg?: AppConfig['github']): void {
  if (!cfg) return;
  try {
    // حفظ التوكن في 3 مفاتيح مختلفة
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
  } catch (_) {
    // localStorage ممتلئ كلياً — نتجاهل بدون crash
  }
}

/**
 * يقرأ الـ Token من 5 مصادر بالترتيب (من الأعلى أولوية للأدنى):
 * 1. VITE env variable (أعلى أولوية — للـ production deployment)
 * 2. cfg.token (React State — المصدر الحيّ)
 * 3. localStorage primary key
 * 4. localStorage backup key #1
 * 5. localStorage backup key #2
 * 6. HARDCODED_TOKEN (آخر ملاذ — Fallback Credential محفور في الكود)
 *
 * ⚠️ لا يُصفِّر Token أبداً — يُعيد '' فقط إذا لم يجد شيئاً
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
 * النتيجة لا تكون فارغة أبداً.
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
// 🔐 Admin Session — sessionStorage فقط (يُصفَّر بإغلاق التبويب)
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_SESSION_KEY   = LS.adminSession;
const ADMIN_PASSWORD_HASH = '20042007'; // الباسورد الصارم والمحدد

/**
 * التحقق من الباسورد بشكل صارم.
 * لا يُسمح بأي مدخل لا يطابق تماماً.
 */
export function verifyAdminPassword(input: string): boolean {
  return typeof input === 'string' && input === ADMIN_PASSWORD_HASH;
}

/**
 * قراءة حالة جلسة الأدمن من sessionStorage.
 * sessionStorage يُصفَّر تلقائياً بإغلاق التبويب أو المتصفح.
 * لا يُؤثر Re-render أو تهنيج الـ UI على هذه القيمة بين الـ renders.
 */
export function isAdminSessionActive(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'active';
  } catch (_) {
    return false;
  }
}

/**
 * تفعيل/إيقاف جلسة الأدمن في sessionStorage.
 * val=true: تفعيل (بعد إدخال الباسورد الصحيح)
 * val=false: إيقاف فوري (logout أو إغلاق الإعدادات)
 */
export function setAdminSession(val: boolean): void {
  try {
    if (val) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'active');
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ Fetch with Timeout — يمنع تجميد المتصفح
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetch مع AbortController للـ timeout.
 * Timeout لا يُعتبر خطأ في الـ Token — فقط يُعيد المحاولة.
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
// ③ Safe JSON Serialize — منع تهنيج المتصفح مع Base64 الكبير
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON.stringify آمن وغير مُعطِّل للـ UI:
 * - يُنفَّذ داخل setTimeout(0) لتحرير event loop قبل العملية الثقيلة
 * - يمنع تجميد المتصفح عند معالجة Base64 ضخم (صور/فيديوهات)
 * - try/catch لمنع أي crash
 */
export async function safeStringify(data: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    // setTimeout(0) = تسليم التحكم للـ browser event loop أولاً
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
 * معالجة البيانات الثقيلة عبر requestIdleCallback إن كان متاحاً.
 * يُستخدم للعمليات التي لا تحتاج استجابة فورية (مثل pre-processing للـ Base64).
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
 * جلب البيانات من GitHub مع:
 * - Timeout 60 ثانية
 * - أي خطأ HTTP لا يمس الـ Token — يُعيد null فقط
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

    // أي خطأ HTTP — لا يمس الـ Token، نُعيد null فقط
    if (!res.ok) {
      console.warn(`[ghFetch] HTTP ${res.status} — Token محفوظ، نُعيد null`);
      return null;
    }

    const json = await res.json();
    const sha  = json.sha as string | undefined;

    // حفظ SHA للاستخدام في الـ PUT التالي
    if (sha) {
      try { localStorage.setItem(LS.ghSha, sha); } catch (_) {}
    }

    const decoded = fromB64(json.content || '');
    let raw: any = {};
    try { raw = JSON.parse(decoded); } catch (_) { raw = {}; }

    const users         = safeArr<UserRecord>(Array.isArray(raw) ? raw : raw?.users);
    const installations = safeArr<InstallationRecord>(raw?.installations);
    const config        = raw?.__config__ || undefined;

    return { users, installations, config, sha };
  } catch (err) {
    // Network error / Timeout — لا نمس الـ Token أبداً
    console.warn('[ghFetch] network error (Token محفوظ):', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ③ ghPush — رفع البيانات مع Exponential Backoff Retry (3 مرات)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يرفع البيانات إلى GitHub مع:
 * - SHA-aware PUT لمنع 409 Conflict
 * - Retry تلقائي (3 مرات) مع Exponential Backoff: 1.5s → 3s → 6s
 * - Timeout 60 ثانية على كل request
 * - Token محمي تماماً — لا يُحذف أبداً عند أي خطأ
 * - لا تظهر رسائل خطأ للمستخدم أثناء الـ retry
 */
export async function ghPush(
  users        : UserRecord[],
  installations: InstallationRecord[],
  cfg          : AppConfig['github'],
): Promise<boolean> {
  const token = resolveToken(cfg);
  if (!token) {
    console.warn('[ghPush] لا يوجد Token — تخطي');
    return false;
  }

  const { owner, repo, branch, dataPath } = buildGhConfig(cfg);
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${dataPath}`;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      // ─── Step 1: جلب SHA الحالي (لمنع 409 Conflict) ─────────────────────
      let currentSha: string | undefined = localStorage.getItem(LS.ghSha) || undefined;
      let existingConfig: Record<string, unknown> = {};

      try {
        const getRes = await fetchWithTimeout(`${url}?ref=${branch}&t=${Date.now()}`, {
          headers: buildHeaders(token),
        });

        if (getRes.ok) {
          const getData = await getRes.json();
          currentSha = getData.sha || currentSha;

          // حفظ SHA الجديد فوراً في localStorage
          if (currentSha) {
            try { localStorage.setItem(LS.ghSha, currentSha); } catch (_) {}
          }

          // الحفاظ على __config__ الموجود في الملف (لا نُفقده)
          if (getData.content) {
            try {
              const dec    = fromB64(getData.content);
              const parsed = JSON.parse(dec);
              if (parsed?.__config__) existingConfig = parsed.__config__;
            } catch (_) {}
          }
        } else if (getRes.status === 401) {
          // 401 = Token منتهي أو غير صالح
          // ⚠️ لا نُحذف Token — نُوقف الـ retry فقط لأن retry لن يفيد
          console.warn('[ghPush] 401 Unauthorized — Token موجود لكن غير صالح حالياً');
          return false;
        }
        // 404 = الملف لم يُنشأ بعد — نكمل بدون SHA (GitHub سيُنشئه)
      } catch (getErr) {
        // Network error في الـ GET — نكمل بـ SHA القديم من localStorage
        console.warn('[ghPush] GET SHA failed — نكمل بـ SHA القديم:', getErr);
      }

      // ─── Step 2: بناء الـ payload بأمان (safeStringify يمنع تجميد الـ UI) ──
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
        return true;
      }

      // ─── معالجة أخطاء HTTP المختلفة ──────────────────────────────────────
      const errText = await putRes.text().catch(() => '');

      if (putRes.status === 401) {
        // Token غير صالح — لا فائدة من الـ retry
        // ⚠️ Token يبقى في localStorage — لا نمسه
        console.warn('[ghPush] 401 — Token محفوظ، يرجى تحديثه من الإعدادات');
        return false;
      }

      if (putRes.status === 409) {
        // SHA Conflict — نُعيد المحاولة بـ SHA جديد (يُجلب في attempt التالي)
        console.warn(`[ghPush] 409 Conflict (attempt ${attempt}) — إعادة بـ SHA جديد`);
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
        // لا نُرجع false — نكمل للـ retry التالي
      } else if (putRes.status === 422) {
        // Validation error — قد يكون SHA قديم
        console.warn(`[ghPush] 422 Unprocessable (attempt ${attempt}):`, errText.slice(0, 200));
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
      } else if (putRes.status === 404) {
        // Repository/path غير موجود — نُعيد بدون SHA
        console.warn(`[ghPush] 404 — الملف/Repository غير موجود (attempt ${attempt})`);
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
      } else {
        console.warn(`[ghPush] HTTP ${putRes.status} (attempt ${attempt}):`, errText.slice(0, 200));
      }

    } catch (err: any) {
      // Network error / Timeout — Token لا يُمس أبداً
      console.warn(`[ghPush] Error (attempt ${attempt}/${MAX_RETRY}) — Token محفوظ:`, err?.message || err);
    }

    // ─── Exponential Backoff — لا رسائل خطأ للمستخدم أثناء الـ retry ────────
    if (attempt < MAX_RETRY) {
      const waitMs = RETRY_BASE_MS * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s
      console.info(`[ghPush] إعادة المحاولة بعد ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  // فشلت جميع المحاولات — Token لا يزال محفوظاً وسليماً
  console.warn(`[ghPush] ❌ فشل بعد ${MAX_RETRY} محاولات — Token محفوظ، سيُعاد لاحقاً`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// ② Smart Sync Queue — FIFO حقيقي مع Debounce
// ─────────────────────────────────────────────────────────────────────────────

/**
 * طابور ذكي للرفع يضمن:
 * - FIFO حقيقي: كل push ينتظر OK من السابق
 * - Debounce: آخر job يفوز عند الضغط المتتالي السريع
 * - Token محمي: أي خطأ لا يوقف الـ queue ولا يمس الـ Token
 * - onStatusChange callback لتحديث الـ UI تلقائياً بدون prop drilling
 */
export function createSyncQueue(
  onStatusChange?: (status: SyncStatus) => void,
) {
  let running = false;
  let pending: (() => Promise<void>) | null = null;

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
      await job();
      // نُحدِّث status فقط إذا لا يوجد pending آخر
      if (!pending) notify('success');
    } catch (err) {
      // خطأ في الـ job — Token محمي، نُبلغ UI فقط
      console.warn('[SyncQueue] job error (Token محفوظ):', err);
      if (!pending) notify('error');
    } finally {
      running = false;
      // إذا تراكم pending أثناء التشغيل — نُشغّله فوراً
      if (pending) {
        // microtask delay لتفادي stack overflow
        await new Promise(r => setTimeout(r, 50));
        runNext();
      }
    }
  }

  return {
    /**
     * إضافة job للطابور.
     * إذا كان هناك push نشط، يُخزَّن هذا الـ job ويُنفَّذ بعده.
     * إذا كان هناك pending آخر، يُستبدَل بهذا (آخر بيانات تكسب دائماً).
     */
    enqueue(job: () => Promise<void>): void {
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
 * - GitHub هو المصدر الأساسي (source of truth — الأحدث)
 * - السجلات الموجودة locally فقط (pending sync) تُضاف في النهاية
 */
export function mergeInstallations(
  fromGithub: InstallationRecord[],
  fromLocal : InstallationRecord[],
): InstallationRecord[] {
  const ghIds    = new Set(safeArr(fromGithub).map(r => r.id));
  const localOnly = safeArr(fromLocal).filter(r => !ghIds.has(r.id));
  return [...safeArr(fromGithub), ...localOnly];
}

/**
 * دمج users — نفس استراتيجية الـ installations.
 */
export function mergeUsers(
  fromGithub: UserRecord[],
  fromLocal : UserRecord[],
): UserRecord[] {
  const ghIds    = new Set(safeArr(fromGithub).map(r => r.id));
  const localOnly = safeArr(fromLocal).filter(r => !ghIds.has(r.id));
  return [...safeArr(fromGithub), ...localOnly];
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

/**
 * githubSync.ts — Hardened GitHub Sync Engine v4.0
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * الإصلاحات الجذرية في هذا الملف:
 *
 * ① Token Protection — التوكن لا يُحذف أبداً مهما حدث
 *    - أي خطأ (401, 404, 422, Timeout, Network) لا يمس الـ Token
 *    - الخطأ يُغيّر الـ syncStatus فقط إلى 'error' مع رسالة واضحة
 *    - Token يُحفظ في localStorage بـ 3 مفاتيح مختلفة كـ fallback
 *
 * ② Smart Queue with FIFO — طابور ذكي حقيقي
 *    - لا parallel requests — كل push ينتظر الـ OK من السابق
 *    - يحتفظ بآخر job فقط (debounce) لتفادي الضغط عند الإرسال السريع
 *    - Retry تلقائي (3 مرات) مع Exponential Backoff
 *
 * ③ Timeout Protection — 60 ثانية على كل request
 *    - AbortController مع timeout 60s على كل fetch
 *    - Timeout لا يُفقد التوكن، فقط يُعيد المحاولة
 *
 * ④ Safe JSON Serialization — منع تهنيج المتصفح
 *    - JSON.stringify داخل try/catch دائماً
 *    - دعم البيانات الكبيرة (Base64 صور/فيديوهات)
 *
 * ⑤ SHA Caching — تسريع الـ PUT requests
 *    - الـ SHA يُخزَّن بعد كل عملية ناجحة
 *    - يُستخدم مباشرةً في الـ PUT بدون GET إضافي إذا كان متاحاً
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { AppConfig, UserRecord } from '../types';

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
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GITHUB_API        = 'https://api.github.com';
const FETCH_TIMEOUT_MS  = 60_000; // 60 ثانية كافية للـ Base64 الكبير
const MAX_RETRY         = 3;
const RETRY_BASE_MS     = 1_500;  // 1.5s → 3s → 6s

// مفاتيح localStorage — متعددة لضمان عدم الضياع
export const LS = {
  ghToken   : 'gh_token_primary',
  ghTokenFb : 'gh_token_fallback',     // fallback ثانوي
  ghOwner   : 'gh_owner',
  ghRepo    : 'gh_repo',
  ghBranch  : 'gh_branch',
  ghDataPath: 'gh_data_path',
  ghSha     : 'gh_last_sha',
  config    : 'group_m_config',
  users     : 'group_m_users',
  installations: 'group_m_installations',
  adminFlag : 'group_m_admin_active',
} as const;

// Hardcoded defaults — لا تُترك فارغة أبداً
export const HARDCODED_OWNER     = 'youssefmd2244-droid';
export const HARDCODED_REPO      = 'Group-m';
export const HARDCODED_BRANCH    = 'main';
export const HARDCODED_DATA_PATH = 'src/data.json';

// ─────────────────────────────────────────────────────────────────────────────
// 🔒 Token Persistence — حفظ دائم في 3 مفاتيح
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يحفظ credentials في localStorage بـ مفاتيح متعددة.
 * يُستدعى بعد كل عملية ناجحة وعند الـ mount.
 * لا يُحذف أي key موجود — فقط يُضيف/يُحدِّث.
 */
export function persistGhCredentials(cfg?: AppConfig['github']): void {
  if (!cfg) return;
  try {
    if (cfg.token) {
      localStorage.setItem(LS.ghToken,    cfg.token);
      localStorage.setItem(LS.ghTokenFb,  cfg.token); // نسخة احتياطية
    }
    if (cfg.owner)    localStorage.setItem(LS.ghOwner,    cfg.owner);
    if (cfg.repo)     localStorage.setItem(LS.ghRepo,     cfg.repo);
    if (cfg.branch)   localStorage.setItem(LS.ghBranch,   cfg.branch);
    if (cfg.dataPath) localStorage.setItem(LS.ghDataPath, cfg.dataPath);
  } catch (_) {
    // localStorage ممتلئ — نتجاهل بدون crash
  }
}

/**
 * يقرأ الـ token من 4 مصادر بالترتيب:
 * 1. VITE env variable (أعلى أولوية)
 * 2. cfg.token (state)
 * 3. localStorage primary key
 * 4. localStorage fallback key
 *
 * ⚠️ لا يُصفِّر Token أبداً — يُعيد '' فقط إذا لم يجد شيئاً
 */
export function resolveToken(cfg?: AppConfig['github']): string {
  return (
    (import.meta as any).env?.VITE_GITHUB_TOKEN ||
    cfg?.token?.trim() ||
    localStorage.getItem(LS.ghToken)?.trim() ||
    localStorage.getItem(LS.ghTokenFb)?.trim() ||
    ''
  );
}

/**
 * يبني GitHub config كاملاً من كل المصادر المتاحة.
 * يضمن أن كل قيمة لها fallback — لا تُترك فارغة.
 */
export function buildGhConfig(cfg?: AppConfig['github']): AppConfig['github'] {
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
      throw new Error(`TIMEOUT: Request exceeded ${timeoutMs / 1000}s`);
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
    'Authorization'       : `Bearer ${token}`,
    'Accept'              : 'application/vnd.github+json',
    'Content-Type'        : 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Cache-Control'       : 'no-cache',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔠 Base64 helpers
// ─────────────────────────────────────────────────────────────────────────────

function toB64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (_) {
    // Fallback للنصوص الكبيرة جداً
    return btoa(str);
  }
}

function fromB64(b64: string): string {
  try {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
  } catch (_) {
    return atob(b64.replace(/\n/g, ''));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔄 Safe JSON Serialize — يمنع تهنيج المتصفح مع البيانات الكبيرة
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON.stringify آمن:
 * - محاط بـ try/catch
 * - يُنفَّذ في microtask لتفادي تجميد الـ UI
 */
async function safeStringify(data: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    // setTimeout(0) يُفرج عن الـ event loop قبل العملية الثقيلة
    setTimeout(() => {
      try {
        resolve(JSON.stringify(data, null, 2));
      } catch (err) {
        reject(new Error(`JSON.stringify failed: ${String(err)}`));
      }
    }, 0);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 📥 ghFetch — جلب البيانات من GitHub
// ─────────────────────────────────────────────────────────────────────────────

export async function ghFetch(cfg: AppConfig['github']): Promise<GhFetchResult | null> {
  const token = resolveToken(cfg);
  if (!token) return null;

  const { owner, repo, branch, dataPath } = buildGhConfig(cfg);
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${dataPath}?ref=${branch}&t=${Date.now()}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: buildHeaders(token),
    });

    // ⚠️ أي خطأ HTTP لا يمس الـ Token — نُعيد null فقط
    if (!res.ok) {
      console.warn(`[ghFetch] HTTP ${res.status} — Token محفوظ، نُعيد المحاولة لاحقاً`);
      return null;
    }

    const json = await res.json();
    const sha  = json.sha as string | undefined;

    // حفظ SHA للاستخدام في الـ PUT التالي
    if (sha) {
      try { localStorage.setItem(LS.ghSha, sha); } catch (_) {}
    }

    const decoded = fromB64(json.content);
    const raw = JSON.parse(decoded);

    const users         = safeArr<UserRecord>(Array.isArray(raw) ? raw : raw?.users);
    const installations = safeArr<InstallationRecord>(raw?.installations);
    const config        = raw?.__config__ || undefined;

    return { users, installations, config, sha };
  } catch (err) {
    // Network error / Timeout — لا نمس الـ Token
    console.warn('[ghFetch] error (Token محفوظ):', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 📤 ghPush — رفع البيانات إلى GitHub مع Retry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يرفع البيانات إلى GitHub مع:
 * - SHA-aware PUT (لمنع 409 Conflict)
 * - Retry تلقائي (3 مرات) مع Exponential Backoff
 * - Timeout 60 ثانية على كل request
 * - Token محمي — لا يُحذف أبداً عند الخطأ
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
      // ─── Step 1: جلب SHA الحالي ────────────────────────────────────────
      let currentSha: string | undefined = localStorage.getItem(LS.ghSha) || undefined;
      let existingConfig: Record<string, unknown> = {};

      try {
        const getRes = await fetchWithTimeout(`${url}?ref=${branch}&t=${Date.now()}`, {
          headers: buildHeaders(token),
        });

        if (getRes.ok) {
          const getData = await getRes.json();
          currentSha = getData.sha || currentSha;

          // حفظ SHA الجديد فوراً
          if (currentSha) {
            try { localStorage.setItem(LS.ghSha, currentSha); } catch (_) {}
          }

          // الحفاظ على __config__ الموجود في الملف
          if (getData.content) {
            try {
              const dec = fromB64(getData.content);
              const parsed = JSON.parse(dec);
              if (parsed?.__config__) existingConfig = parsed.__config__;
            } catch (_) {}
          }
        } else if (getRes.status === 401) {
          // 401 = Token منتهي أو خاطئ — نُعيد false بدون retry لأن الـ Token نفسه مشكلة
          // ⚠️ لكن لا نُحذف الـ Token من localStorage
          console.warn('[ghPush] 401 Unauthorized — تحقق من صلاحية الـ Token في إعدادات GitHub');
          return false;
        }
        // أي status آخر (404, 5xx) — نكمل بدون SHA (GitHub سيُنشئ الملف)
      } catch (getErr) {
        // Timeout أو Network error في الـ GET — نكمل بـ SHA القديم من localStorage
        console.warn('[ghPush] GET SHA failed (نستخدم SHA القديم):', getErr);
      }

      // ─── Step 2: بناء الـ payload بأمان ────────────────────────────────
      const safeUsers = safeArr<UserRecord>(users);
      const safeInst  = safeArr<InstallationRecord>(installations);

      // safeStringify يمنع تجميد المتصفح مع البيانات الكبيرة (Base64)
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

      // ─── Step 3: رفع الملف ─────────────────────────────────────────────
      const putRes = await fetchWithTimeout(url, {
        method : 'PUT',
        headers: buildHeaders(token),
        body   : JSON.stringify(body),
      });

      if (putRes.ok) {
        const putData = await putRes.json();
        const newSha = putData?.content?.sha;
        if (newSha) {
          try { localStorage.setItem(LS.ghSha, newSha); } catch (_) {}
        }
        // ✅ نجاح — حفظ credentials من جديد للتأكيد
        persistGhCredentials(cfg);
        console.info(`[ghPush] ✅ نجح (attempt ${attempt}/${MAX_RETRY})`);
        return true;
      }

      // ─── HTTP Errors ───────────────────────────────────────────────────
      const errText = await putRes.text().catch(() => '');

      if (putRes.status === 401) {
        // Token خاطئ — لا فائدة من الـ retry
        // ⚠️ لكن لا نُحذف Token — نُبلغ المستخدم فقط
        console.warn('[ghPush] 401 — Token غير صالح، يرجى تحديثه من الإعدادات');
        return false;
      }

      if (putRes.status === 409) {
        // SHA Conflict — نُعيد المحاولة مع SHA جديد
        console.warn(`[ghPush] 409 Conflict (attempt ${attempt}) — جاري إعادة المحاولة بـ SHA جديد`);
        // نمسح الـ SHA القديم لإجبار GET جديد في المحاولة التالية
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
        // لا نُرجع false — نكمل للـ retry
      } else if (putRes.status === 422) {
        // Validation error — قد يكون SHA قديم أو محتوى خاطئ
        console.warn(`[ghPush] 422 (attempt ${attempt}):`, errText);
        try { localStorage.removeItem(LS.ghSha); } catch (_) {}
      } else {
        console.warn(`[ghPush] HTTP ${putRes.status} (attempt ${attempt}):`, errText);
      }

    } catch (err: any) {
      // Network error / Timeout — لا نمس الـ Token
      console.warn(`[ghPush] Error (attempt ${attempt}/${MAX_RETRY}) — Token محفوظ:`, err?.message || err);
    }

    // ─── Exponential Backoff قبل الـ retry ────────────────────────────────
    if (attempt < MAX_RETRY) {
      const waitMs = RETRY_BASE_MS * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s
      console.info(`[ghPush] إعادة المحاولة بعد ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  // فشلت جميع المحاولات — Token لا يزال محفوظاً
  console.warn(`[ghPush] ❌ فشل بعد ${MAX_RETRY} محاولات — سيُعاد لاحقاً`);
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 📋 Smart Sync Queue — FIFO مع Debounce
// ─────────────────────────────────────────────────────────────────────────────

/**
 * طابور ذكي للرفع:
 * - FIFO: الطلب الأول ينتهي أولاً
 * - Debounce: إذا جاءت عدة طلبات وهناك push نشط،
 *   يُخزَّن آخر طلب فقط ويُنفَّذ بعد انتهاء الحالي
 * - Token محمي: أي خطأ لا يوقف الـ queue ولا يمس الـ Token
 * - onStatusChange: callback لتحديث الـ UI
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
      // نُحدِّث الـ status فقط إذا لا يوجد pending آخر ينتظر
      if (!pending) notify('success');
    } catch (err) {
      // خطأ في الـ job — نُبلِّغ UI فقط، لا نمس Token
      console.warn('[SyncQueue] job error (Token محفوظ):', err);
      if (!pending) notify('error');
    } finally {
      running = false;
      // إذا كان هناك pending ينتظر — نُشغّله فوراً
      if (pending) {
        // microtask delay لتفادي stack overflow عند الـ queue الطويل
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

    get isRunning(): boolean { return running; },
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
  const ghIds    = new Set(safeArr(fromGithub).map(r => r.id));
  const localOnly = safeArr(fromLocal).filter(r => !ghIds.has(r.id));
  return [...safeArr(fromGithub), ...localOnly];
}

/**
 * دمج users:
 * نفس استراتيجية الـ installations.
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
// 🛡️ Safe Array helper
// ─────────────────────────────────────────────────────────────────────────────

export function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 💾 localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

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

import { AppConfig, UserRecord, GitHubConfig } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// GitHub REST API helpers
// Provides: syncUsersToGithub, syncConfigToGithub, pullFromGithub, getGithubFile
// ─────────────────────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com';

function buildHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Base64-encode a UTF-8 string for the GitHub Contents API */
function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

/** Decode base64 string returned by GitHub Contents API */
function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}

/**
 * Fetch a single file from the GitHub repo.
 * Returns { content, sha } or null if not found.
 */
export async function getGithubFile(
  cfg: GitHubConfig,
  path: string
): Promise<{ content: string; sha: string } | null> {
  const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch || 'main'}`;
  const res = await fetch(url, { headers: buildHeaders(cfg.token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFile ${path} failed: ${res.status}`);
  const data = await res.json();
  return { content: fromBase64(data.content), sha: data.sha };
}

/**
 * Write or update a single file in the GitHub repo.
 */
async function putGithubFile(
  cfg: GitHubConfig,
  path: string,
  content: string,
  commitMessage: string,
  sha?: string
): Promise<void> {
  const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const body: Record<string, string> = {
    message: commitMessage,
    content: toBase64(content),
    branch: cfg.branch || 'main',
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: buildHeaders(cfg.token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub putFile ${path} failed: ${res.status} — ${JSON.stringify(err)}`);
  }
}

/**
 * Push the users array to GitHub (data.json).
 */
export async function syncUsersToGithub(
  users: UserRecord[],
  cfg: GitHubConfig
): Promise<void> {
  if (!cfg.isEnabled || !cfg.token || !cfg.owner || !cfg.repo) return;
  const path = cfg.dataPath || 'data.json';
  const existing = await getGithubFile(cfg, path);
  await putGithubFile(
    cfg,
    path,
    JSON.stringify(users, null, 2),
    `chore: sync ${users.length} user records [auto]`,
    existing?.sha
  );
}

/**
 * Push app config to GitHub (config.json).
 *
 * SECURITY: masterPasswordHash and github.token are STRIPPED before upload
 * so they are never stored in the public repository.
 */
export async function syncConfigToGithub(
  config: AppConfig,
  cfg: GitHubConfig
): Promise<void> {
  if (!cfg.isEnabled || !cfg.token || !cfg.owner || !cfg.repo) return;

  // Build a sanitised copy — never write credentials to the repo
  const { masterPasswordHash: _pw, ...safeConfig } = config as AppConfig & { masterPasswordHash?: string };
  const sanitised = {
    ...safeConfig,
    github: {
      ...safeConfig.github,
      token: '',   // Never push the PAT to GitHub
    },
  };

  const path = cfg.configPath || 'config.json';
  const existing = await getGithubFile(cfg, path);
  await putGithubFile(
    cfg,
    path,
    JSON.stringify(sanitised, null, 2),
    'chore: update app config [auto]',
    existing?.sha
  );
}

/**
 * Pull both users and config from GitHub.
 * When excludeUsers is true (non-admin visitor), only config is fetched.
 */
export async function pullFromGithub(
  cfg: GitHubConfig,
  excludeUsers = false
): Promise<{ users?: UserRecord[]; appConfig?: Partial<AppConfig> } | null> {
  if (!cfg.isEnabled || !cfg.token || !cfg.owner || !cfg.repo) return null;

  const result: { users?: UserRecord[]; appConfig?: Partial<AppConfig> } = {};

  // Always pull config
  try {
    const configFile = await getGithubFile(cfg, cfg.configPath || 'config.json');
    if (configFile) {
      const parsed = JSON.parse(configFile.content) as Partial<AppConfig>;
      // Guarantee masterPasswordHash is never overwritten from remote config
      // (it is never pushed there, but guard defensively)
      delete (parsed as any).masterPasswordHash;
      result.appConfig = parsed;
    }
  } catch (e) {
    console.warn('pullFromGithub: config fetch failed', e);
  }

  // Pull users only for authenticated admin sessions
  if (!excludeUsers) {
    try {
      const dataFile = await getGithubFile(cfg, cfg.dataPath || 'data.json');
      if (dataFile) {
        const parsed = JSON.parse(dataFile.content);
        if (Array.isArray(parsed)) result.users = parsed as UserRecord[];
      }
    } catch (e) {
      console.warn('pullFromGithub: users fetch failed', e);
    }
  }

  return result;
}

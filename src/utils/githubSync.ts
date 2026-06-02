import { UserRecord, AppConfig, GitHubConfig } from '../types';

/**
 * Encodes a string into UTF-8 Base64, supporting Unicode (such as Arabic text).
 */
function encodeUTF8Base64(str: string): string {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      })
    );
  } catch (e) {
    console.error('Base64 encoding error:', e);
    return btoa(str);
  }
}

/**
 * Decodes a UTF-8 Base64 string back into a standard string.
 */
function decodeUTF8Base64(b64: string): string {
  try {
    const cleanB64 = b64.replace(/\s/g, '');
    const decoded = atob(cleanB64);
    return decodeURIComponent(
      Array.prototype.map
        .call(decoded, (c: string) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
  } catch (e) {
    console.error('Base64 decoding error:', e);
    return atob(b64);
  }
}

/**
 * Helper to fetch a file's SHA and decoded content from a GitHub repository.
 */
export async function getGithubFile(github: GitHubConfig, path: string): Promise<{ sha: string; content: string } | null> {
  if (!github.token || !github.owner || !github.repo) return null;

  const url = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/${path}?ref=${github.branch || 'main'}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${github.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`GitHub API returned status ${response.status} when reading ${path}`);
    }

    const data = await response.json();
    const rawContent = data.content ? decodeUTF8Base64(data.content) : '';
    return {
      sha: data.sha,
      content: rawContent,
    };
  } catch (error) {
    console.error(`Error reading ${path} from GitHub:`, error);
    throw error;
  }
}

/**
 * Core recursive GitHub PUT file helper with 409 revision collision retry mechanics.
 */
export async function writeGithubFile(
  github: GitHubConfig,
  path: string,
  contentStr: string,
  commitMessage: string,
  predefinedSha?: string,
  retryCount = 3
): Promise<string> {
  if (!github.token || !github.owner || !github.repo) {
    throw new Error('GitHub sync configuration is active but missing tokens');
  }

  // 1. Determine local starting SHA if not predefined
  let existingSha = predefinedSha || '';
  if (!existingSha) {
    try {
      const fileResult = await getGithubFile(github, path);
      if (fileResult) {
        existingSha = fileResult.sha;
      }
    } catch (e) {
      console.log(`Initial SHA check omitted for ${path}, proceeding direct write...`);
    }
  }

  const url = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/${path}`;
  const base64Content = encodeUTF8Base64(contentStr);

  const bodyData: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message: commitMessage,
    content: base64Content,
    branch: github.branch || 'main',
  };

  if (existingSha) {
    bodyData.sha = existingSha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${github.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyData),
  });

  // Handle 409 Conflict: another user updated this file in the meantime. Fetch latest SHA, merge and retry.
  if (response.status === 409 && retryCount > 0) {
    console.warn(`Git write conflict 409 detected on ${path}. Re-calling state reconciliation with newest revision...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const latestFile = await getGithubFile(github, path);
    if (latestFile) {
      let finalWriteContent = contentStr;
      
      // If updating user registrations on data.json, merge non-destructively
      if (path.includes('data.json')) {
        try {
          const localData = JSON.parse(contentStr) as UserRecord[];
          const remoteData = JSON.parse(latestFile.content) as UserRecord[];
          
          const mergedMap = new Map<string, UserRecord>();
          // Add remote records (from Github) first
          remoteData.forEach(r => mergedMap.set(r.id, r));
          // Add local records (overwriting matching IDs or inserting new ones)
          localData.forEach(l => mergedMap.set(l.id, l));
          
          // Re-sort with newest on top
          const mergedArray = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          finalWriteContent = JSON.stringify(mergedArray, null, 2);
          console.log(`Concurrently resolved registration conflict. Total records merged: ${mergedArray.length}`);
        } catch (mergeErr) {
          console.error('Record merger crash during 409 resolution:', mergeErr);
        }
      } else if (path.includes('config.json')) {
        // If updating configuration, merge deep configuration properties
        try {
          const localConfig = JSON.parse(contentStr);
          const remoteConfig = JSON.parse(latestFile.content);
          const mergedConfig = { ...remoteConfig, ...localConfig };
          finalWriteContent = JSON.stringify(mergedConfig, null, 2);
        } catch (configMergeErr) {
          console.error('Config merger crash during 409 resolution:', configMergeErr);
        }
      }

      // Recursive call with newest SHA and merged contents
      return writeGithubFile(github, path, finalWriteContent, commitMessage, latestFile.sha, retryCount - 1);
    }
  }

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`GitHub API Error status ${response.status}: ${errorDetails}`);
  }

  const resultData = await response.json();
  return resultData.content.sha;
}

/**
 * Pushes the full users array to data.json on GitHub, merging non-destructively
 */
export async function syncUsersToGithub(users: UserRecord[], github: GitHubConfig): Promise<boolean> {
  if (!github.isEnabled || !github.token || !github.owner || !github.repo) {
    return false;
  }

  const serialized = JSON.stringify(users, null, 2);
  const path = github.dataPath || 'data.json';
  await writeGithubFile(github, path, serialized, `Update user enrollment records (Count: ${users.length})`);
  return true;
}

/**
 * Pushes modified app configuration to config.json on GitHub, merging non-destructively
 */
export async function syncConfigToGithub(appConfig: AppConfig, github: GitHubConfig): Promise<boolean> {
  if (!github.isEnabled || !github.token || !github.owner || !github.repo) {
    return false;
  }

  // Sanitize configurations written to remote repository
  const sanitizedConfig = {
    websiteTitle: appConfig.websiteTitle,
    welcomeSubtitleAr: appConfig.welcomeSubtitleAr,
    formHeadingAr: appConfig.formHeadingAr,
    formSubheadingAr: appConfig.formSubheadingAr,
    successMessageAr: appConfig.successMessageAr,
    masterPasswordHash: appConfig.masterPasswordHash,
    whatsappNumbers: appConfig.whatsappNumbers,
    callNumbers: appConfig.callNumbers,
    theme: appConfig.theme,
    fieldsSchema: appConfig.fieldsSchema,
    localizationOverrides: appConfig.localizationOverrides,
    github: {
      owner: appConfig.github.owner,
      repo: appConfig.github.repo,
      branch: appConfig.github.branch,
      dataPath: appConfig.github.dataPath,
      configPath: appConfig.github.configPath,
      isEnabled: true,
    },
  };

  const serialized = JSON.stringify(sanitizedConfig, null, 2);
  const path = github.configPath || 'config.json';
  await writeGithubFile(github, path, serialized, 'Update website general configurations, schemas & localization CMS');
  return true;
}

/**
 * Pulls both configuration and database files from GitHub repository
 */
export async function pullFromGithub(
  github: GitHubConfig,
  excludeUsers: boolean = false
): Promise<{
  users?: UserRecord[];
  appConfig?: any;
} | null> {
  if (!github.isEnabled || !github.token || !github.owner || !github.repo) {
    return null;
  }

  const result: { users?: UserRecord[]; appConfig?: any } = {};

  if (!excludeUsers) {
    try {
      const dataPath = github.dataPath || 'data.json';
      const usersFile = await getGithubFile(github, dataPath);
      if (usersFile && usersFile.content) {
        result.users = JSON.parse(usersFile.content);
      }
    } catch (e) {
      console.warn('Could not load user records from GitHub, might be new repo:', e);
    }
  }

  try {
    const configPath = github.configPath || 'config.json';
    const configFile = await getGithubFile(github, configPath);
    if (configFile && configFile.content) {
      result.appConfig = JSON.parse(configFile.content);
    }
  } catch (e) {
    console.warn('Could not load configurations from GitHub, might be default setup:', e);
  }

  return result;
}

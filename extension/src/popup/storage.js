export const WEB_APP_URL = 'https://note-word.pages.dev';
export const DEFAULT_SHEET_LANG = 'English';
export const CACHE_TTL_MS = 15 * 60 * 1000;

export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeGasUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export async function loadSyncSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    return await chrome.storage.sync.get([
      'GAS_WEB_APP_URL',
      'NOTE_WORD_LANG',
      'UI_LANG',
    ]);
  }
  return {
    GAS_WEB_APP_URL: localStorage.getItem('GAS_WEB_APP_URL') || '',
    NOTE_WORD_LANG: DEFAULT_SHEET_LANG,
    UI_LANG: localStorage.getItem('UI_LANG') || 'vi',
  };
}

export async function saveSyncSettings(values) {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    await chrome.storage.sync.set(values);
  } else {
    if (values.GAS_WEB_APP_URL !== undefined) {
      localStorage.setItem('GAS_WEB_APP_URL', values.GAS_WEB_APP_URL);
    }
    if (values.NOTE_WORD_LANG !== undefined) {
      localStorage.setItem('NOTE_WORD_LANG', values.NOTE_WORD_LANG);
    }
    if (values.UI_LANG !== undefined) {
      localStorage.setItem('UI_LANG', values.UI_LANG);
    }
  }
}

export async function loadCachedDueWords() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const data = await chrome.storage.local.get([
      'CACHED_DUE_WORDS',
      'CACHED_DUE_UPDATED_AT',
      'CACHED_DUE_KEY',
      'CACHED_DUE_DATE',
    ]);
    if (!Array.isArray(data.CACHED_DUE_WORDS)) return null;
    return {
      words: data.CACHED_DUE_WORDS,
      updatedAt: Number(data.CACHED_DUE_UPDATED_AT) || 0,
      key: String(data.CACHED_DUE_KEY || ''),
      date: String(data.CACHED_DUE_DATE || ''),
    };
  }
  try {
    const raw = localStorage.getItem('NOTEWORDS_DEV_DUE_CACHE');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.words)) return null;
    return {
      words: parsed.words,
      updatedAt: Number(parsed.updatedAt) || 0,
      key: String(parsed.key || ''),
      date: String(parsed.date || ''),
    };
  } catch {
    return null;
  }
}

export async function syncExtensionBadge(count, words, cacheKey, todayStr) {
  const updatedAt = Date.now();
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({
      CACHED_DUE_WORDS: words,
      CACHED_DUE_UPDATED_AT: updatedAt,
      CACHED_DUE_KEY: cacheKey,
      CACHED_DUE_DATE: todayStr,
    });
  } else {
    try {
      localStorage.setItem(
        'NOTEWORDS_DEV_DUE_CACHE',
        JSON.stringify({ words, updatedAt, key: cacheKey, date: todayStr })
      );
    } catch {
      // Ignore storage errors
    }
  }
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      await chrome.runtime.sendMessage({
        type: 'SYNC_BADGE_COUNT',
        count,
      });
    } catch {
      // Ignore if background SW is unavailable in dev mode
    }
  }
  return updatedAt;
}

export async function fetchDueWordsData({
  gasUrl,
  sheetLang = DEFAULT_SHEET_LANG,
  copy,
  force = false,
}) {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    const response = await chrome.runtime.sendMessage({
      type: 'REFRESH_DUE_WORDS',
      force,
    });
    if (!response || response.ok === false) {
      if (response?.error === 'HTTP 404') {
        throw new Error(copy.fetch404Hint);
      }
      throw new Error(response?.error || 'Network error');
    }
    return {
      words: Array.isArray(response.words) ? response.words : [],
      updatedAt: response.updatedAt || Date.now(),
    };
  }

  const query = new URLSearchParams({
    action: 'getWords',
    lang: sheetLang || DEFAULT_SHEET_LANG,
    dueOnly: 'true',
  });
  const separator = gasUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${gasUrl}${separator}${query.toString()}`, {
    method: 'GET',
    redirect: 'follow',
    credentials: 'omit',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(copy.fetch404Hint);
    }
    throw new Error(`HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json || json.success === false) {
    throw new Error(json?.error || 'Invalid response');
  }

  const words = Array.isArray(json.data) ? json.data : [];
  const cacheKey = `${gasUrl}::${sheetLang || DEFAULT_SHEET_LANG}`;
  const updatedAt = await syncExtensionBadge(
    words.length,
    words,
    cacheKey,
    getTodayDateString()
  );

  return { words, updatedAt };
}

export async function openWebAppTab() {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    await chrome.tabs.create({ url: WEB_APP_URL });
  } else {
    window.open(WEB_APP_URL, '_blank', 'noopener,noreferrer');
  }
}

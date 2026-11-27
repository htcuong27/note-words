/**
 * NoteWords Background Service Worker (Manifest V3)
 *
 * - Receives SAVE_WORD messages from content.js and posts ADD_WORD to Google Apps Script.
 * - Fetches due words count from GAS and updates the extension toolbar badge (`chrome.action`).
 * - Stores no state in global variables (MV3 service worker safe); persists cache in chrome.storage.
 */

const DEFAULT_SHEET_LANG = 'English';
const ALARM_NAME = 'notewords-refresh-due-badge';
const BADGE_BG_COLOR = '#2563eb';
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_STORAGE_KEYS = [
  'CACHED_DUE_WORDS',
  'CACHED_DUE_UPDATED_AT',
  'CACHED_DUE_KEY',
  'CACHED_DUE_DATE',
];

let inflightDueSync = null;
const inflightWordSaves = new Map();

function cleanWordText(raw) {
  return String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWordKey(raw) {
  return cleanWordText(raw).toLowerCase();
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCacheKey(gasUrl, sheetLang) {
  return `${gasUrl}::${sheetLang}`;
}

function normalizeGasUrl(rawUrl) {
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

async function applyBadgeCount(count) {
  const numeric = Math.max(0, Number(count) || 0);
  const text = numeric > 0 ? (numeric > 99 ? '99+' : String(numeric)) : '';
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_BG_COLOR });
  if (chrome.action.setBadgeTextColor) {
    await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  }
  await chrome.action.setBadgeText({ text });
}

async function fetchAndSyncDueWords({ force = false } = {}) {
  try {
    const stored = await chrome.storage.sync.get([
      'GAS_WEB_APP_URL',
      'NOTE_WORD_LANG',
    ]);
    const gasUrl = normalizeGasUrl(stored.GAS_WEB_APP_URL);
    const sheetLang =
      String(stored.NOTE_WORD_LANG || DEFAULT_SHEET_LANG).trim() ||
      DEFAULT_SHEET_LANG;

    if (!gasUrl) {
      await chrome.storage.local.remove(CACHE_STORAGE_KEYS);
      await applyBadgeCount(0);
      return { ok: false, code: 'MISSING_URL', words: [] };
    }

    const cacheKey = buildCacheKey(gasUrl, sheetLang);
    const todayStr = getTodayDateString();

    if (!force) {
      const cached = await chrome.storage.local.get(CACHE_STORAGE_KEYS);
      const updatedAt = Number(cached.CACHED_DUE_UPDATED_AT) || 0;
      const isFresh =
        cached.CACHED_DUE_KEY === cacheKey &&
        cached.CACHED_DUE_DATE === todayStr &&
        Array.isArray(cached.CACHED_DUE_WORDS) &&
        Date.now() - updatedAt < CACHE_TTL_MS;

      if (isFresh) {
        await applyBadgeCount(cached.CACHED_DUE_WORDS.length);
        return {
          ok: true,
          words: cached.CACHED_DUE_WORDS,
          fromCache: true,
          updatedAt,
        };
      }
    }

    if (inflightDueSync) {
      return await inflightDueSync;
    }

    inflightDueSync = (async () => {
      const query = new URLSearchParams({
        action: 'getWords',
        lang: sheetLang,
        dueOnly: 'true',
      });
      const separator = gasUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${gasUrl}${separator}${query.toString()}`, {
        method: 'GET',
        redirect: 'follow',
        credentials: 'omit',
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status}`,
          words: [],
        };
      }

      const json = await response.json();
      if (!json || json.success === false) {
        return {
          ok: false,
          error: json?.error || 'GAS request failed',
          words: [],
        };
      }

      const words = Array.isArray(json.data) ? json.data : [];
      const updatedAt = Date.now();
      await chrome.storage.local.set({
        CACHED_DUE_WORDS: words,
        CACHED_DUE_UPDATED_AT: updatedAt,
        CACHED_DUE_KEY: cacheKey,
        CACHED_DUE_DATE: todayStr,
      });
      await applyBadgeCount(words.length);

      return { ok: true, words, fromCache: false, updatedAt };
    })();

    try {
      return await inflightDueSync;
    } finally {
      inflightDueSync = null;
    }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Network error',
      words: [],
    };
  }
}

async function handleSaveWord(payload) {
  const stored = await chrome.storage.sync.get([
    'GAS_WEB_APP_URL',
    'NOTE_WORD_LANG',
    'UI_LANG',
  ]);
  const uiLang = stored.UI_LANG === 'en' ? 'en' : 'vi';
  const gasUrl = normalizeGasUrl(stored.GAS_WEB_APP_URL);

  if (!gasUrl) {
    return {
      ok: false,
      code: 'MISSING_URL',
      error:
        uiLang === 'en'
          ? 'GAS_WEB_APP_URL is not configured in the extension settings.'
          : 'Chưa cấu hình GAS_WEB_APP_URL trong cài đặt Extension.',
    };
  }

  const word = cleanWordText(payload?.word);
  if (!word) {
    return {
      ok: false,
      error:
        uiLang === 'en'
          ? 'Selected word is empty.'
          : 'Từ vựng rỗng, không thể lưu.',
    };
  }

  const lang =
    String(payload?.lang || stored.NOTE_WORD_LANG || DEFAULT_SHEET_LANG).trim() ||
    DEFAULT_SHEET_LANG;

  const wordKey = normalizeWordKey(word);
  const saveLockKey = `${buildCacheKey(gasUrl, lang)}::${wordKey}`;
  if (inflightWordSaves.has(saveLockKey)) {
    return await inflightWordSaves.get(saveLockKey);
  }

  const savePromise = (async () => {
    const response = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow',
      credentials: 'omit',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'ADD_WORD',
        lang,
        word,
        context: String(payload?.context || '').trim(),
        sourceUrl: String(payload?.sourceUrl || '').trim(),
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error:
          uiLang === 'en'
            ? `Google Apps Script returned HTTP ${response.status}.`
            : `Google Apps Script trả về lỗi HTTP ${response.status}.`,
      };
    }

    let json;
    try {
      json = await response.json();
    } catch {
      return {
        ok: false,
        error:
          uiLang === 'en'
            ? 'Invalid JSON response from GAS. Please check your Web App URL.'
            : 'Phản hồi từ GAS không phải JSON hợp lệ. Kiểm tra lại URL Web App.',
      };
    }

    if (json && json.success === false) {
      return {
        ok: false,
        duplicate: Boolean(json.duplicate),
        error:
          json.error ||
          (uiLang === 'en'
            ? 'Could not save word to Google Sheets.'
            : 'Không thể lưu từ lên Google Sheets.'),
      };
    }

    // Update due words cache directly when possible to avoid an extra GAS GET call
    const savedItem = json ? json.data : null;
    if (!json?.duplicate && savedItem) {
      const cacheKey = buildCacheKey(gasUrl, lang);
      const todayStr = getTodayDateString();
      const cached = await chrome.storage.local.get(CACHE_STORAGE_KEYS);

      if (
        cached.CACHED_DUE_KEY === cacheKey &&
        cached.CACHED_DUE_DATE === todayStr &&
        Array.isArray(cached.CACHED_DUE_WORDS)
      ) {
        const savedKey = normalizeWordKey(savedItem.word);
        const exists = cached.CACHED_DUE_WORDS.some(
          (w) => w.id === savedItem.id || normalizeWordKey(w.word) === savedKey
        );
        const nextWords = exists
          ? cached.CACHED_DUE_WORDS
          : [...cached.CACHED_DUE_WORDS, savedItem];
        await chrome.storage.local.set({
          CACHED_DUE_WORDS: nextWords,
          CACHED_DUE_UPDATED_AT: Date.now(),
        });
        await applyBadgeCount(nextWords.length);
      } else {
        await fetchAndSyncDueWords({ force: true });
      }
    } else if (!json?.duplicate) {
      await fetchAndSyncDueWords({ force: true });
    }

    return {
      ok: true,
      duplicate: Boolean(json && json.duplicate),
      data: savedItem,
    };
  })();

  inflightWordSaves.set(saveLockKey, savePromise);
  try {
    return await savePromise;
  } finally {
    inflightWordSaves.delete(saveLockKey);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
  await fetchAndSyncDueWords({ force: false });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
  await fetchAndSyncDueWords({ force: false });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await fetchAndSyncDueWords({ force: true });
  }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'sync' && (changes.GAS_WEB_APP_URL || changes.NOTE_WORD_LANG)) {
    await fetchAndSyncDueWords({ force: true });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === 'SAVE_WORD') {
    (async () => {
      try {
        const result = await handleSaveWord(message.payload || {});
        sendResponse(result);
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || 'Network error while calling Google Apps Script.',
        });
      }
    })();
    return true;
  }

  if (message.type === 'REFRESH_DUE_WORDS') {
    (async () => {
      const result = await fetchAndSyncDueWords({
        force: Boolean(message.force),
      });
      sendResponse(result);
    })();
    return true;
  }

  if (message.type === 'SYNC_BADGE_COUNT') {
    (async () => {
      await applyBadgeCount(message.count);
      sendResponse({ ok: true });
    })();
    return true;
  }

  return false;
});

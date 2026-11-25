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

async function fetchAndSyncDueWords() {
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
      await chrome.storage.local.remove(['CACHED_DUE_WORDS', 'CACHED_DUE_UPDATED_AT']);
      await applyBadgeCount(0);
      return { ok: false, code: 'MISSING_URL', words: [] };
    }

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
    await chrome.storage.local.set({
      CACHED_DUE_WORDS: words,
      CACHED_DUE_UPDATED_AT: Date.now(),
    });
    await applyBadgeCount(words.length);

    return { ok: true, words };
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

  const word = String(payload?.word || '').trim();
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

  // Refresh due words cache & badge in background after adding a word
  await fetchAndSyncDueWords();

  return {
    ok: true,
    duplicate: Boolean(json && json.duplicate),
    data: json ? json.data : null,
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
  await fetchAndSyncDueWords();
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15 });
  await fetchAndSyncDueWords();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await fetchAndSyncDueWords();
  }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'sync' && (changes.GAS_WEB_APP_URL || changes.NOTE_WORD_LANG)) {
    await fetchAndSyncDueWords();
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
      const result = await fetchAndSyncDueWords();
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

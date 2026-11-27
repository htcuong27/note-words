/**
 * Google Apps Script API Client
 *
 * Uses `Content-Type: text/plain;charset=utf-8` on POST requests with JSON.stringify
 * payload to avoid CORS preflight (OPTIONS) which GAS Web Apps do not handle.
 */

import { isWordDue } from './sm2';

export const STORAGE_KEYS = {
  GAS_URL: 'GAS_WEB_APP_URL',
  LANG: 'NOTE_WORD_LANG',
  UI_LANG: 'NOTE_WORD_UI_LANG',
  WORDS_CACHE: 'NOTE_WORD_WORDS_CACHE_V1',
};

export const WORDS_CACHE_TTL_MS = 5 * 60 * 1000;

export const DEFAULT_LANG = 'English';
export const DEFAULT_UI_LANG = 'vi';

const inflightRequests = new Map();

export function cleanWordText(raw) {
  return String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeWordKey(raw) {
  return cleanWordText(raw).toLowerCase();
}

function normalizeApiUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function buildCacheKey(baseUrl, lang) {
  return `${normalizeApiUrl(baseUrl)}::${lang}`;
}

function readAllWordsCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORDS_CACHE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllWordsCache(cacheMap) {
  try {
    localStorage.setItem(STORAGE_KEYS.WORDS_CACHE, JSON.stringify(cacheMap));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

function readWordsCache(cacheKey) {
  const all = readAllWordsCache();
  const entry = all[cacheKey];
  if (!entry || !Array.isArray(entry.words)) return null;
  const updatedAt = Number(entry.updatedAt) || 0;
  const isFresh = Date.now() - updatedAt < WORDS_CACHE_TTL_MS;
  return {
    words: entry.words,
    updatedAt,
    isFresh,
  };
}

function writeWordsCache(cacheKey, words) {
  const all = readAllWordsCache();
  all[cacheKey] = {
    words: Array.isArray(words) ? words : [],
    updatedAt: Date.now(),
  };
  writeAllWordsCache(all);
}

function mutateWordsCache(cacheKey, updater) {
  const all = readAllWordsCache();
  const entry = all[cacheKey];
  if (!entry || !Array.isArray(entry.words)) return;
  all[cacheKey] = {
    words: updater(entry.words),
    updatedAt: entry.updatedAt,
  };
  writeAllWordsCache(all);
}

export function getWordsCacheMeta({ lang = getCurrentLang(), url } = {}) {
  const baseUrl = url !== undefined ? String(url).trim() : getApiUrl();
  if (!baseUrl) return null;
  const entry = readWordsCache(buildCacheKey(baseUrl, lang));
  if (!entry) return null;
  return {
    updatedAt: entry.updatedAt,
    isFresh: entry.isFresh,
    count: entry.words.length,
  };
}

export function patchCachedWord({ id, patch, lang = getCurrentLang(), url } = {}) {
  const baseUrl = url !== undefined ? String(url).trim() : getApiUrl();
  if (!baseUrl || !id || !patch) return;
  const cacheKey = buildCacheKey(baseUrl, lang);
  mutateWordsCache(cacheKey, (words) =>
    words.map((item) => (item.id === id ? { ...item, ...patch } : item))
  );
}

export function clearWordsCache() {
  try {
    localStorage.removeItem(STORAGE_KEYS.WORDS_CACHE);
  } catch {
    // Ignore storage errors
  }
}

export const SUPPORTED_LANGUAGES = [
  {
    value: 'English',
    labelVi: 'English (Mặc định - Phase 1)',
    labelEn: 'English (Default - Phase 1)',
  },
];

export function getApiUrl() {
  try {
    return (localStorage.getItem(STORAGE_KEYS.GAS_URL) || '').trim();
  } catch {
    return '';
  }
}

export function setApiUrl(url) {
  const trimmed = String(url || '').trim();
  if (trimmed) {
    localStorage.setItem(STORAGE_KEYS.GAS_URL, trimmed);
  } else {
    localStorage.removeItem(STORAGE_KEYS.GAS_URL);
  }
  return trimmed;
}

export function getCurrentLang() {
  try {
    return (localStorage.getItem(STORAGE_KEYS.LANG) || DEFAULT_LANG).trim() || DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function setCurrentLang(lang) {
  const cleaned = String(lang || DEFAULT_LANG).trim() || DEFAULT_LANG;
  localStorage.setItem(STORAGE_KEYS.LANG, cleaned);
  return cleaned;
}

export function getUiLang() {
  try {
    const val = (localStorage.getItem(STORAGE_KEYS.UI_LANG) || DEFAULT_UI_LANG).trim();
    return val === 'en' ? 'en' : 'vi';
  } catch {
    return DEFAULT_UI_LANG;
  }
}

export function setUiLang(lang) {
  const normalized = lang === 'en' ? 'en' : 'vi';
  try {
    localStorage.setItem(STORAGE_KEYS.UI_LANG, normalized);
  } catch {
    // Ignore storage errors
  }
  return normalized;
}

function requireApiUrl(overrideUrl) {
  const url = overrideUrl !== undefined ? String(overrideUrl).trim() : getApiUrl();
  if (!url) {
    const isEn = getUiLang() === 'en';
    throw new Error(
      isEn
        ? 'Google Apps Script Web App URL is not configured. Please add it in Settings.'
        : 'Chưa cấu hình Google Apps Script Web App URL. Vui lòng nhập URL trong trang Cài đặt.'
    );
  }
  return url;
}

async function parseGasResponse(response) {
  const isEn = getUiLang() === 'en';
  if (!response.ok) {
    throw new Error(
      isEn
        ? `Server connection error (HTTP ${response.status}).`
        : `Lỗi kết nối máy chủ (HTTP ${response.status}).`
    );
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(
      isEn
        ? 'Invalid JSON response from Google Apps Script. Check your Web App URL and "Anyone" access setting.'
        : 'Phản hồi từ Google Apps Script không phải JSON hợp lệ. Hãy kiểm tra lại URL Web App và quyền truy cập "Anyone".'
    );
  }

  if (json && json.success === false) {
    throw new Error(
      json.error ||
        (isEn
          ? 'Google Apps Script request failed.'
          : 'Yêu cầu tới Google Apps Script thất bại.')
    );
  }

  return json;
}

async function postGas(payload, overrideUrl) {
  const baseUrl = requireApiUrl(overrideUrl);
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
  return parseGasResponse(response);
}

/**
 * Fetch words from Google Sheets with localStorage TTL cache & in-flight deduplication.
 * Always fetches and caches the full word list so switching modes/reloading avoids redundant calls.
 * @param {{ lang?: string, dueOnly?: boolean, url?: string, forceRefresh?: boolean }} options
 */
export async function getWords({
  lang = getCurrentLang(),
  dueOnly = false,
  url,
  forceRefresh = false,
} = {}) {
  const baseUrl = requireApiUrl(url);
  const cacheKey = buildCacheKey(baseUrl, lang);

  if (!forceRefresh) {
    const cached = readWordsCache(cacheKey);
    if (cached?.isFresh) {
      return dueOnly ? cached.words.filter((w) => isWordDue(w)) : cached.words;
    }
  }

  let fetchPromise = inflightRequests.get(cacheKey);
  if (!fetchPromise) {
    const query = new URLSearchParams({
      action: 'getWords',
      lang,
      dueOnly: 'false',
    });

    const separator = baseUrl.includes('?') ? '&' : '?';
    fetchPromise = fetch(`${baseUrl}${separator}${query.toString()}`, {
      method: 'GET',
    })
      .then((response) => parseGasResponse(response))
      .then((json) => {
        const words = Array.isArray(json.data) ? json.data : [];
        writeWordsCache(cacheKey, words);
        return words;
      })
      .finally(() => {
        inflightRequests.delete(cacheKey);
      });

    inflightRequests.set(cacheKey, fetchPromise);
  }

  const allWords = await fetchPromise;
  return dueOnly ? allWords.filter((w) => isWordDue(w)) : allWords;
}

/**
 * Add a new word (auto EN->VI translation if meaning is empty).
 */
export async function addWord({
  word,
  meaning = '',
  context = '',
  sourceUrl = '',
  phonetic = '',
  lang = getCurrentLang(),
}) {
  const baseUrl = requireApiUrl();
  const cleanedWord = cleanWordText(word);
  if (!cleanedWord) {
    const isEn = getUiLang() === 'en';
    throw new Error(isEn ? 'Word cannot be empty.' : 'Từ vựng không được để trống.');
  }

  const json = await postGas(
    {
      action: 'ADD_WORD',
      lang,
      word: cleanedWord,
      meaning: String(meaning || '').trim(),
      context: String(context || '').trim(),
      sourceUrl: String(sourceUrl || '').trim(),
      phonetic: String(phonetic || '').trim(),
    },
    baseUrl
  );
  if (json.data && !json.duplicate) {
    const cacheKey = buildCacheKey(baseUrl, lang);
    const savedKey = normalizeWordKey(json.data.word);
    mutateWordsCache(cacheKey, (words) =>
      words.some(
        (item) => item.id === json.data.id || normalizeWordKey(item.word) === savedKey
      )
        ? words
        : [...words, json.data]
    );
  }
  return json.data;
}

/**
 * Sync SM-2 review result to Google Sheets.
 */
export async function updateReview({
  id,
  repetition,
  interval,
  easeFactor,
  nextReviewDate,
  lastReviewedAt,
  quality,
  lang = getCurrentLang(),
}) {
  const baseUrl = requireApiUrl();
  const json = await postGas(
    {
      action: 'UPDATE_REVIEW',
      lang,
      id,
      repetition,
      interval,
      easeFactor,
      nextReviewDate,
      lastReviewedAt,
      quality,
    },
    baseUrl
  );
  if (json.data) {
    const cacheKey = buildCacheKey(baseUrl, lang);
    mutateWordsCache(cacheKey, (words) =>
      words.map((item) => (item.id === id ? { ...item, ...json.data } : item))
    );
  }
  return json.data;
}

/**
 * Edit an existing word's text, meaning, context, or sourceUrl.
 */
export async function editWord({
  id,
  word,
  meaning,
  context,
  sourceUrl,
  phonetic,
  lang = getCurrentLang(),
}) {
  const baseUrl = requireApiUrl();
  const cleanedWord = word !== undefined ? cleanWordText(word) : undefined;
  const json = await postGas(
    {
      action: 'EDIT_WORD',
      lang,
      id,
      word: cleanedWord,
      meaning,
      context,
      sourceUrl,
      phonetic,
    },
    baseUrl
  );
  if (json.data) {
    const cacheKey = buildCacheKey(baseUrl, lang);
    mutateWordsCache(cacheKey, (words) =>
      words.map((item) => (item.id === id ? { ...item, ...json.data } : item))
    );
  }
  return json.data;
}

/**
 * Delete a word by id.
 */
export async function deleteWord({ id, lang = getCurrentLang() }) {
  const baseUrl = requireApiUrl();
  const json = await postGas(
    {
      action: 'DELETE_WORD',
      lang,
      id,
    },
    baseUrl
  );
  const deletedId = json.deletedId || id;
  const cacheKey = buildCacheKey(baseUrl, lang);
  mutateWordsCache(cacheKey, (words) => words.filter((item) => item.id !== deletedId));
  return deletedId;
}

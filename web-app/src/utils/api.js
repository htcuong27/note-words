/**
 * Google Apps Script API Client
 *
 * Uses `Content-Type: text/plain;charset=utf-8` on POST requests with JSON.stringify
 * payload to avoid CORS preflight (OPTIONS) which GAS Web Apps do not handle.
 */

export const STORAGE_KEYS = {
  GAS_URL: 'GAS_WEB_APP_URL',
  LANG: 'NOTE_WORD_LANG',
};

export const DEFAULT_LANG = 'English';

export const SUPPORTED_LANGUAGES = [
  { value: 'English', label: 'English (Mặc định - Phase 1)' },
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

function requireApiUrl(overrideUrl) {
  const url = (overrideUrl !== undefined ? String(overrideUrl).trim() : getApiUrl());
  if (!url) {
    throw new Error('Chưa cấu hình Google Apps Script Web App URL. Vui lòng nhập URL trong trang Cài đặt.');
  }
  return url;
}

async function parseGasResponse(response) {
  if (!response.ok) {
    throw new Error(`Lỗi kết nối máy chủ (HTTP ${response.status}).`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error('Phản hồi từ Google Apps Script không phải JSON hợp lệ. Hãy kiểm tra lại URL Web App và quyền truy cập "Anyone".');
  }

  if (json && json.success === false) {
    throw new Error(json.error || 'Yêu cầu tới Google Apps Script thất bại.');
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
 * Fetch words from Google Sheets.
 * @param {{ lang?: string, dueOnly?: boolean, url?: string }} options
 */
export async function getWords({ lang = getCurrentLang(), dueOnly = false, url } = {}) {
  const baseUrl = requireApiUrl(url);
  const query = new URLSearchParams({
    action: 'getWords',
    lang,
    dueOnly: dueOnly ? 'true' : 'false',
  });

  const separator = baseUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${baseUrl}${separator}${query.toString()}`, {
    method: 'GET',
  });

  const json = await parseGasResponse(response);
  return Array.isArray(json.data) ? json.data : [];
}

/**
 * Add a new word (auto EN->VI translation if meaning is empty).
 */
export async function addWord({ word, meaning = '', context = '', sourceUrl = '', lang = getCurrentLang() }) {
  const json = await postGas({
    action: 'ADD_WORD',
    lang,
    word,
    meaning,
    context,
    sourceUrl,
  });
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
  const json = await postGas({
    action: 'UPDATE_REVIEW',
    lang,
    id,
    repetition,
    interval,
    easeFactor,
    nextReviewDate,
    lastReviewedAt,
    quality,
  });
  return json.data;
}

/**
 * Edit an existing word's text, meaning, context, or sourceUrl.
 */
export async function editWord({ id, word, meaning, context, sourceUrl, lang = getCurrentLang() }) {
  const json = await postGas({
    action: 'EDIT_WORD',
    lang,
    id,
    word,
    meaning,
    context,
    sourceUrl,
  });
  return json.data;
}

/**
 * Delete a word by id.
 */
export async function deleteWord({ id, lang = getCurrentLang() }) {
  const json = await postGas({
    action: 'DELETE_WORD',
    lang,
    id,
  });
  return json.deletedId || id;
}

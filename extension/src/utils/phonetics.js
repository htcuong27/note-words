/**
 * IPA Pronunciation & Word Stress utilities for Chrome Extension Popup.
 * Uses Datamuse API (always HTTP 200, never 404) with compact TTL + LRU cache.
 */

const LEGACY_STORAGE_KEY = 'NOTE_WORD_PHONETICS_CACHE_V1';
const STORAGE_KEY = 'NOTE_WORD_PHONETICS_CACHE_V2';
const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MISS_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_CACHE_ENTRIES = 200;
const MAX_CONCURRENT_FETCHES = 4;

const IPA_VOWELS = 'iɪeɛæaɑɒɔoʊuʌəɚɜɝɨʉʏøœɐɶɯɤ';
const IPA_NUCLEUS_RE = new RegExp(`[${IPA_VOWELS}]+ː?`, 'g');
const IPA_STRESS_TOKEN_RE = new RegExp(
  `([ˈˌ][^${IPA_VOWELS}ˈˌ.\\s/\\[\\]()]{0,4}[${IPA_VOWELS}]+ː?|[ˈˌ])`,
  'g'
);

const memoryCache = new Map();
const inflightMap = new Map();
const fetchQueue = [];
let activeFetches = 0;
let storageLoaded = false;

function isEnglishLang(lang = 'English') {
  const lower = String(lang || 'English').trim().toLowerCase();
  return lower === 'english' || lower === 'en' || lower.startsWith('en-');
}

function normalizeLookupWord(word) {
  return String(word || '')
    .trim()
    .replace(/^[.,!?;:"“”‘’()[\]{}]+|[.,!?;:"“”‘’()[\]{}]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeIpaString(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (
    (trimmed.startsWith('/') && trimmed.endsWith('/')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    return trimmed;
  }
  return `/${trimmed}/`;
}

function loadStorageCacheOnce() {
  if (storageLoaded) return;
  storageLoaded = true;
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    const now = Date.now();
    let pruned = false;
    for (const [key, tuple] of Object.entries(parsed)) {
      if (!Array.isArray(tuple) || tuple.length < 2) {
        pruned = true;
        continue;
      }
      const ipa = typeof tuple[0] === 'string' ? tuple[0] : '';
      const expiresAt = Number(tuple[1]) || 0;
      if (expiresAt > now) {
        memoryCache.set(key, { ipa, expiresAt });
      } else {
        pruned = true;
      }
    }

    if (pruned || memoryCache.size > MAX_CACHE_ENTRIES) {
      persistStorageCache();
    }
  } catch {
    // Ignore storage read errors
  }
}

function persistStorageCache() {
  if (typeof localStorage === 'undefined') return;
  try {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (!v || v.expiresAt <= now) {
        memoryCache.delete(k);
      }
    }

    while (memoryCache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey === undefined) break;
      memoryCache.delete(oldestKey);
    }

    if (memoryCache.size === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const compact = {};
    for (const [k, v] of memoryCache.entries()) {
      compact[k] = [v.ipa, v.expiresAt];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
  } catch {
    // Ignore storage errors
  }
}

function setCachedEntry(key, ipa) {
  loadStorageCacheOnce();
  const normalized = ipa || '';
  const ttl = normalized ? HIT_TTL_MS : MISS_TTL_MS;
  memoryCache.delete(key);
  memoryCache.set(key, { ipa: normalized, expiresAt: Date.now() + ttl });
  persistStorageCache();
}

function runQueuedFetch(fn) {
  return new Promise((resolve, reject) => {
    const task = async () => {
      activeFetches += 1;
      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      } finally {
        activeFetches -= 1;
        if (fetchQueue.length > 0) {
          const next = fetchQueue.shift();
          next();
        }
      }
    };

    if (activeFetches < MAX_CONCURRENT_FETCHES) {
      task();
    } else {
      fetchQueue.push(task);
    }
  });
}

function extractIpaFromDatamuse(entries, expectedWord) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const exact = entries.find(
    (item) =>
      typeof item?.word === 'string' &&
      item.word.toLowerCase() === expectedWord
  );
  if (!exact || !Array.isArray(exact.tags)) return '';

  const ipaTag = exact.tags.find(
    (tag) => typeof tag === 'string' && tag.startsWith('ipa_pron:')
  );
  if (!ipaTag) return '';

  const rawIpa = ipaTag.slice('ipa_pron:'.length).trim();
  return normalizeIpaString(rawIpa);
}

async function fetchSingleWordIpa(word) {
  if (!/^[a-z'-]+$/.test(word)) return '';
  try {
    const res = await runQueuedFetch(() =>
      fetch(
        `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=r&ipa=1&max=1`
      )
    );
    if (!res.ok) return '';
    const entries = await res.json();
    return extractIpaFromDatamuse(entries, word);
  } catch {
    return '';
  }
}

export function getCachedPhonetic(word, lang = 'English') {
  if (!isEnglishLang(lang)) return '';
  const key = normalizeLookupWord(word);
  if (!key) return '';

  loadStorageCacheOnce();
  const entry = memoryCache.get(key);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }

  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.ipa;
}

export async function fetchPhonetic(word, lang = 'English') {
  if (!isEnglishLang(lang)) return '';
  const key = normalizeLookupWord(word);
  if (!key) return '';

  const cached = getCachedPhonetic(key, lang);
  if (cached !== undefined) {
    return cached;
  }

  if (inflightMap.has(key)) {
    return inflightMap.get(key);
  }

  const promise = (async () => {
    try {
      if (/^[a-z'-]+$/.test(key)) {
        const ipa = await fetchSingleWordIpa(key);
        setCachedEntry(key, ipa);
        return ipa;
      }

      const parts = key.split(' ').filter(Boolean);
      if (
        parts.length >= 2 &&
        parts.length <= 3 &&
        parts.every((part) => /^[a-z'-]+$/.test(part))
      ) {
        const results = await Promise.all(
          parts.map((part) => fetchPhonetic(part, lang))
        );
        if (results.every(Boolean)) {
          const joined = `/${results
            .map((r) => r.replace(/^[/[]|[/\]]$/g, ''))
            .join(' ')}/`;
          setCachedEntry(key, joined);
          return joined;
        }
      }

      setCachedEntry(key, '');
      return '';
    } finally {
      inflightMap.delete(key);
    }
  })();

  inflightMap.set(key, promise);
  return promise;
}

export function analyzeIpaStress(ipa) {
  const normalized = normalizeIpaString(ipa);
  if (!normalized) {
    return {
      ipa: '',
      hasPrimaryStress: false,
      hasSecondaryStress: false,
      primaryStressSyllable: null,
      totalSyllables: 0,
    };
  }

  const inner = normalized.replace(/^[/[]|[/\]]$/g, '').trim();
  const hasPrimaryStress = inner.includes('ˈ');
  const hasSecondaryStress = inner.includes('ˌ');

  if (!hasPrimaryStress || /\s/.test(inner)) {
    return {
      ipa: normalized,
      hasPrimaryStress,
      hasSecondaryStress,
      primaryStressSyllable: null,
      totalSyllables: 0,
    };
  }

  const flattened = inner.replace(/[()]/g, '');
  const totalSyllables = (flattened.match(IPA_NUCLEUS_RE) || []).length;
  if (totalSyllables < 2) {
    return {
      ipa: normalized,
      hasPrimaryStress,
      hasSecondaryStress,
      primaryStressSyllable: null,
      totalSyllables,
    };
  }

  const primaryIdx = inner.indexOf('ˈ');
  const prefix = inner.slice(0, primaryIdx).replace(/\([^)]*\)/g, '');
  const syllablesBefore = (prefix.match(IPA_NUCLEUS_RE) || []).length;

  return {
    ipa: normalized,
    hasPrimaryStress,
    hasSecondaryStress,
    primaryStressSyllable: syllablesBefore + 1,
    totalSyllables,
  };
}

export function tokenizeIpaForDisplay(ipa) {
  const normalized = normalizeIpaString(ipa);
  if (!normalized) return [];

  const tokens = [];
  let lastIndex = 0;
  IPA_STRESS_TOKEN_RE.lastIndex = 0;

  let match;
  while ((match = IPA_STRESS_TOKEN_RE.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'plain',
        text: normalized.slice(lastIndex, match.index),
      });
    }
    const text = match[0];
    tokens.push({
      type: text.startsWith('ˈ') ? 'primary' : 'secondary',
      text,
    });
    lastIndex = match.index + text.length;
  }

  if (lastIndex < normalized.length) {
    tokens.push({
      type: 'plain',
      text: normalized.slice(lastIndex),
    });
  }

  return tokens;
}

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { isSpeechSupported, speakWord, stopSpeaking } from '../utils/speech';
import {
  analyzeIpaStress,
  fetchPhonetic,
  getCachedPhonetic,
  normalizeIpaString,
  tokenizeIpaForDisplay,
} from '../utils/phonetics';

const WEB_APP_URL = 'https://note-word.pages.dev';
const DEFAULT_SHEET_LANG = 'English';
const CACHE_TTL_MS = 5 * 60 * 1000;

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const I18N = {
  vi: {
    subtitle: 'Lưu & ôn tập từ vựng thông minh',
    wordsHeading: 'Từ cần học',
    dueCountAria: (n) => `${n} từ đang cần học`,
    showMeaning: 'Hiện nghĩa',
    hideMeaning: 'Ẩn nghĩa',
    refreshAria: 'Làm mới danh sách từ cần học',
    openSettingsAria: 'Mở cài đặt liên kết',
    backToWords: 'Quay lại từ cần học',
    langGroupAria: 'Chọn ngôn ngữ giao diện',
    unconfiguredTitle: 'Chưa kết nối Google Sheets',
    unconfiguredDesc:
      'Hãy điền đường dẫn Web App trong phần Cài đặt để đồng bộ và xem các từ cần học hôm nay.',
    goToSettings: 'Mở Cài đặt liên kết',
    loadingWords: 'Đang tải danh sách từ cần học…',
    retry: 'Thử lại',
    allCaughtUpTitle: 'Tuyệt vời! Đã học hết từ hôm nay',
    allCaughtUpDesc:
      'Hiện không còn từ nào đến hạn ôn tập. Hãy bôi đen từ mới khi đọc web để lưu thêm.',
    newBadge: 'Mới',
    repBadge: (r) => `Lần ${r}`,
    tapToReveal: 'Chạm để xem nghĩa',
    noMeaning: 'Chưa có nghĩa',
    openWebApp: 'Mở Web App ôn tập',
    openWebAppWithCount: (n) => `Ôn tập ngay (${n} từ)`,
    settingsTitle: 'Cài đặt kết nối',
    statusReady: 'Đã kết nối',
    statusMissing: 'Chưa cấu hình',
    gasLabel: 'Link Google Apps Script (API)',
    gasHint: 'URL Web App đã deploy từ Google Apps Script',
    gasError: 'Vui lòng nhập URL hợp lệ bắt đầu bằng https://',
    gasRequired: 'Vui lòng nhập đường dẫn Google Apps Script.',
    uiLangLabel: 'Ngôn ngữ hiển thị',
    saveBtn: 'Lưu cài đặt',
    savedSuccess: 'Đã lưu cài đặt thành công!',
    loadSettingsErr: (m) => `Không thể đọc cài đặt: ${m}`,
    saveSettingsErr: (m) => `Lỗi lưu cài đặt: ${m}`,
    fetchErr: (m) => `Không thể tải từ cần học: ${m}`,
    fetch404Hint:
      'HTTP 404 — Kiểm tra lại Link Google Apps Script trong Cài đặt (phải có dạng https://script.google.com/macros/s/.../exec và bản deploy vẫn đang hoạt động).',
    pronounceAria: (w) => `Phát âm từ ${w}`,
    stressBadge: (n) => `Trọng âm ${n}`,
    cachedJustNow: 'Vừa cập nhật',
    cachedMinutesAgo: (m) => `Cập nhật ${m} phút trước`,
  },
  en: {
    subtitle: 'Smart vocabulary capture & SRS',
    wordsHeading: 'Words to Learn',
    dueCountAria: (n) => `${n} words due for review`,
    showMeaning: 'Show meaning',
    hideMeaning: 'Hide meaning',
    refreshAria: 'Refresh due words list',
    openSettingsAria: 'Open link settings',
    backToWords: 'Back to words',
    langGroupAria: 'Select interface language',
    unconfiguredTitle: 'Google Sheets Not Connected',
    unconfiguredDesc:
      'Add your Web App link in Settings to sync and view words due for review today.',
    goToSettings: 'Open Link Settings',
    loadingWords: 'Loading words to learn…',
    retry: 'Retry',
    allCaughtUpTitle: 'All caught up for today!',
    allCaughtUpDesc:
      'No words are currently due for review. Highlight new words while browsing to save them.',
    newBadge: 'New',
    repBadge: (r) => `Rep ${r}`,
    tapToReveal: 'Tap to reveal meaning',
    noMeaning: 'No meaning yet',
    openWebApp: 'Open Review Web App',
    openWebAppWithCount: (n) => `Start Review (${n} due)`,
    settingsTitle: 'Connection Settings',
    statusReady: 'Connected',
    statusMissing: 'Not set',
    gasLabel: 'Google Apps Script Link (API)',
    gasHint: 'Deployed Web App URL from Google Apps Script',
    gasError: 'Please enter a valid URL starting with https://',
    gasRequired: 'Please enter your Google Apps Script URL.',
    uiLangLabel: 'Display Language',
    saveBtn: 'Save Settings',
    savedSuccess: 'Settings saved successfully!',
    loadSettingsErr: (m) => `Could not load settings: ${m}`,
    saveSettingsErr: (m) => `Failed to save settings: ${m}`,
    fetchErr: (m) => `Could not load due words: ${m}`,
    fetch404Hint:
      'HTTP 404 — Check your Google Apps Script URL in Settings (must look like https://script.google.com/macros/s/.../exec and be an active deployment).',
    pronounceAria: (w) => `Pronounce ${w}`,
    stressBadge: (n) => `Stress ${n}`,
    cachedJustNow: 'Updated just now',
    cachedMinutesAgo: (m) => `Updated ${m}m ago`,
  },
};

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

async function loadSyncSettings() {
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

async function saveSyncSettings(values) {
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

async function loadCachedDueWords() {
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

async function syncExtensionBadge(count, words, cacheKey, todayStr) {
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

function formatCacheTime(updatedAt, copy) {
  if (!updatedAt) return '';
  const diffMin = Math.floor((Date.now() - Number(updatedAt)) / 60000);
  if (diffMin < 1) return copy.cachedJustNow;
  return copy.cachedMinutesAgo(diffMin);
}

function PopupPhonetic({ word, phonetic, lang, stressBadge }) {
  const explicit = normalizeIpaString(phonetic);
  const [ipa, setIpa] = useState(() => explicit || getCachedPhonetic(word, lang) || '');

  useEffect(() => {
    if (explicit) {
      setIpa(explicit);
      return;
    }
    const cached = getCachedPhonetic(word, lang);
    if (cached !== undefined) {
      setIpa(cached);
      return;
    }
    setIpa('');
    let cancelled = false;
    fetchPhonetic(word, lang).then((res) => {
      if (!cancelled) setIpa(res || '');
    });
    return () => {
      cancelled = true;
    };
  }, [word, explicit, lang]);

  const activeIpa = explicit || ipa;
  if (!activeIpa) return null;

  const analysis = analyzeIpaStress(activeIpa);
  const tokens = tokenizeIpaForDisplay(activeIpa);

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-slate-500">
        {tokens.map((tok, idx) => {
          if (tok.type === 'primary') {
            return (
              <span
                key={idx}
                className="rounded bg-rose-50 px-0.5 font-bold text-rose-600"
              >
                {tok.text}
              </span>
            );
          }
          if (tok.type === 'secondary') {
            return (
              <span key={idx} className="font-semibold text-amber-600">
                {tok.text}
              </span>
            );
          }
          return <span key={idx}>{tok.text}</span>;
        })}
      </span>
      {analysis.primaryStressSyllable && (
        <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200/80">
          {stressBadge(analysis.primaryStressSyllable)}
        </span>
      )}
    </div>
  );
}

export default function Popup() {
  const [view, setView] = useState('words'); // 'words' | 'settings'
  const [uiLang, setUiLang] = useState('vi');
  const [gasUrl, setGasUrl] = useState('');
  const [sheetLang, setSheetLang] = useState(DEFAULT_SHEET_LANG);

  const [dueWords, setDueWords] = useState([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [wordsError, setWordsError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [showMeanings, setShowMeanings] = useState(true);
  const [revealedIds, setRevealedIds] = useState(() => new Set());

  const [gasInvalid, setGasInvalid] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  const t = I18N[uiLang] || I18N.vi;
  const speechAvailable = isSpeechSupported();

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const fetchDueWords = useCallback(
    async (
      targetGasUrl,
      targetSheetLang = DEFAULT_SHEET_LANG,
      langKey = uiLang,
      { force = false } = {}
    ) => {
      const cleanUrl = normalizeGasUrl(targetGasUrl);
      if (!cleanUrl) {
        setDueWords([]);
        setWordsError('');
        setLastUpdatedAt(null);
        return;
      }

      setLoadingWords(true);
      setWordsError('');

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          const response = await chrome.runtime.sendMessage({
            type: 'REFRESH_DUE_WORDS',
            force,
          });
          if (!response || response.ok === false) {
            if (response?.error === 'HTTP 404') {
              const copy = I18N[langKey] || I18N.vi;
              throw new Error(copy.fetch404Hint);
            }
            throw new Error(response?.error || 'Network error');
          }
          const list = Array.isArray(response.words) ? response.words : [];
          setDueWords(list);
          setLastUpdatedAt(response.updatedAt || Date.now());
          return;
        }

        const query = new URLSearchParams({
          action: 'getWords',
          lang: targetSheetLang || DEFAULT_SHEET_LANG,
          dueOnly: 'true',
        });
        const separator = cleanUrl.includes('?') ? '&' : '?';
        const response = await fetch(`${cleanUrl}${separator}${query.toString()}`, {
          method: 'GET',
          redirect: 'follow',
          credentials: 'omit',
        });

        if (!response.ok) {
          if (response.status === 404) {
            const copy = I18N[langKey] || I18N.vi;
            throw new Error(copy.fetch404Hint);
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        if (!json || json.success === false) {
          throw new Error(json?.error || 'Invalid response');
        }

        const list = Array.isArray(json.data) ? json.data : [];
        const cacheKey = `${cleanUrl}::${targetSheetLang || DEFAULT_SHEET_LANG}`;
        const updatedAt = await syncExtensionBadge(
          list.length,
          list,
          cacheKey,
          getTodayDateString()
        );
        setDueWords(list);
        setLastUpdatedAt(updatedAt);
      } catch (err) {
        const copy = I18N[langKey] || I18N.vi;
        setWordsError(copy.fetchErr(err?.message || 'Network error'));
      } finally {
        setLoadingWords(false);
      }
    },
    [uiLang]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [stored, cached] = await Promise.all([
          loadSyncSettings(),
          loadCachedDueWords(),
        ]);
        if (!active) return;

        const savedUiLang = stored.UI_LANG === 'en' ? 'en' : 'vi';
        const savedGas = normalizeGasUrl(stored.GAS_WEB_APP_URL);
        const savedSheet =
          String(stored.NOTE_WORD_LANG || DEFAULT_SHEET_LANG).trim() ||
          DEFAULT_SHEET_LANG;

        setUiLang(savedUiLang);
        setGasUrl(savedGas);
        setSheetLang(savedSheet);

        if (savedGas) {
          const expectedKey = `${savedGas}::${savedSheet}`;
          const todayStr = getTodayDateString();
          const hasMatchingCache =
            cached && cached.key === expectedKey && cached.date === todayStr;

          if (hasMatchingCache) {
            setDueWords(cached.words);
            setLastUpdatedAt(cached.updatedAt || null);
          }

          const isFresh =
            hasMatchingCache &&
            Date.now() - Number(cached.updatedAt || 0) < CACHE_TTL_MS;

          if (!isFresh) {
            fetchDueWords(savedGas, savedSheet, savedUiLang, { force: false });
          }
        }
      } catch (err) {
        if (active) {
          setErrorMsg(I18N.vi.loadSettingsErr(err.message));
        }
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchDueWords]);

  const handleSpeak = (e, item) => {
    e.stopPropagation();
    speakWord(item.word, sheetLang, {
      onStart: () => setSpeakingId(item.id),
      onEnd: () => setSpeakingId((curr) => (curr === item.id ? null : curr)),
      onError: () => setSpeakingId((curr) => (curr === item.id ? null : curr)),
    });
  };

  const handleChangeUiLang = async (nextLang) => {
    const normalized = nextLang === 'en' ? 'en' : 'vi';
    setUiLang(normalized);
    await saveSyncSettings({ UI_LANG: normalized });
  };

  const toggleWordReveal = (id) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    const trimmedGas = normalizeGasUrl(gasUrl);

    if (!trimmedGas) {
      setGasInvalid(true);
      setErrorMsg(t.gasRequired);
      return;
    }

    try {
      await saveSyncSettings({
        GAS_WEB_APP_URL: trimmedGas,
        NOTE_WORD_LANG: sheetLang,
        UI_LANG: uiLang,
      });
      setGasUrl(trimmedGas);
      setStatusMsg(t.savedSuccess);
      await fetchDueWords(trimmedGas, sheetLang, uiLang, { force: true });
      setTimeout(() => {
        setStatusMsg('');
        setView('words');
      }, 900);
    } catch (err) {
      setErrorMsg(t.saveSettingsErr(err.message));
    }
  };

  const handleOpenWebApp = async () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      await chrome.tabs.create({ url: WEB_APP_URL });
    } else {
      window.open(WEB_APP_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const isConfigured = Boolean(gasUrl.trim());

  return (
    <div className="w-[380px] bg-slate-50 text-slate-900">
      {/* Blue Top Header */}
      <header className="border-b border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/icons/icon48.png"
              alt="NoteWords"
              className="h-8 w-8 shrink-0 rounded-xl shadow-xs ring-1 ring-white/30"
            />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight text-white">
                NoteWords
              </h1>
              <p className="truncate text-[11px] text-blue-100">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* VI / EN Quick Switcher */}
            <div
              role="group"
              aria-label={t.langGroupAria}
              className="inline-flex rounded-lg bg-blue-800/60 p-0.5 ring-1 ring-white/15"
            >
              <button
                type="button"
                onClick={() => handleChangeUiLang('vi')}
                aria-pressed={uiLang === 'vi'}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                  uiLang === 'vi'
                    ? 'nw-active-pill bg-white text-blue-700 shadow-2xs'
                    : 'text-blue-100 hover:text-white'
                }`}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => handleChangeUiLang('en')}
                aria-pressed={uiLang === 'en'}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                  uiLang === 'en'
                    ? 'nw-active-pill bg-white text-blue-700 shadow-2xs'
                    : 'text-blue-100 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            {/* Settings Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setStatusMsg('');
                setView((prev) => (prev === 'settings' ? 'words' : 'settings'));
              }}
              aria-label={view === 'settings' ? t.backToWords : t.openSettingsAria}
              title={view === 'settings' ? t.backToWords : t.openSettingsAria}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                view === 'settings'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'bg-blue-800/50 text-blue-50 ring-1 ring-white/15 hover:bg-blue-800/80'
              }`}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-4">
        {view === 'words' ? (
          <div className="space-y-3.5">
            {/* Section Title + Due Count Badge + Quick Controls */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-slate-900">
                      {t.wordsHeading}
                    </h2>
                    <span
                      aria-label={t.dueCountAria(dueWords.length)}
                      className={`nw-count-badge inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                        dueWords.length > 0
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {dueWords.length}
                    </span>
                  </div>
                  {lastUpdatedAt && (
                    <p className="text-[10px] text-slate-400">
                      {formatCacheTime(lastUpdatedAt, t)}
                    </p>
                  )}
                </div>
              </div>

              {isConfigured && (
                <div className="flex items-center gap-1">
                  {dueWords.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowMeanings((prev) => !prev)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      {showMeanings ? (
                        <EyeOff className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      )}
                      <span>{showMeanings ? t.hideMeaning : t.showMeaning}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={loadingWords}
                    onClick={() =>
                      fetchDueWords(gasUrl, sheetLang, uiLang, { force: true })
                    }
                    aria-label={t.refreshAria}
                    title={t.refreshAria}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loadingWords ? 'animate-spin text-blue-600' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              )}
            </div>

            {/* Body States */}
            {!loaded ? (
              <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
              </div>
            ) : !isConfigured ? (
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/80 to-white p-5 text-center shadow-2xs">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-slate-900">
                  {t.unconfiguredTitle}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {t.unconfiguredDesc}
                </p>
                <button
                  type="button"
                  onClick={() => setView('settings')}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.goToSettings}</span>
                </button>
              </div>
            ) : loadingWords && dueWords.length === 0 ? (
              <div className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
                <p className="mt-2.5 text-xs font-medium">{t.loadingWords}</p>
              </div>
            ) : wordsError && dueWords.length === 0 ? (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center"
              >
                <AlertCircle className="mx-auto h-6 w-6 text-rose-600" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-rose-900">{wordsError}</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      fetchDueWords(gasUrl, sheetLang, uiLang, { force: true })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                    <span>{t.retry}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('settings')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="h-3 w-3" aria-hidden="true" />
                    <span>{t.settingsTitle}</span>
                  </button>
                </div>
              </div>
            ) : dueWords.length === 0 ? (
              <div className="rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-2xs">
                <CheckCircle2
                  className="mx-auto h-9 w-9 text-blue-600"
                  aria-hidden="true"
                />
                <h3 className="mt-2.5 text-sm font-bold text-slate-900">
                  {t.allCaughtUpTitle}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {t.allCaughtUpDesc}
                </p>
              </div>
            ) : (
              <ul className="max-h-[280px] space-y-2 overflow-y-auto pr-0.5">
                {dueWords.map((item) => {
                  const isRevealed = showMeanings || revealedIds.has(item.id);
                  const rep = Number(item.repetition) || 0;
                  return (
                    <li key={item.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleWordReveal(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleWordReveal(item.id);
                          }
                        }}
                        className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xs transition-colors hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-bold text-slate-900">
                              {item.word}
                            </span>
                            {speechAvailable && (
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => handleSpeak(e, item)}
                                onKeyDown={(e) => e.stopPropagation()}
                                aria-label={t.pronounceAria(item.word)}
                                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                                  speakingId === item.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                                }`}
                              >
                                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              rep === 0
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {rep === 0 ? t.newBadge : t.repBadge(rep)}
                          </span>
                        </div>

                        <PopupPhonetic
                          word={item.word}
                          phonetic={item.phonetic}
                          lang={sheetLang}
                          stressBadge={t.stressBadge}
                        />

                        <div className="mt-1">
                          {isRevealed ? (
                            <p className="text-xs font-semibold text-blue-700">
                              {item.meaning || (
                                <span className="italic font-normal text-slate-400">
                                  {t.noMeaning}
                                </span>
                              )}
                            </p>
                          ) : (
                            <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                              {t.tapToReveal}
                            </span>
                          )}
                        </div>

                        {isRevealed && item.context && (
                          <p className="mt-1.5 line-clamp-2 border-l-2 border-blue-200 pl-2 text-[11px] leading-relaxed text-slate-500">
                            {item.context}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Launch Web App CTA */}
            <button
              type="button"
              onClick={handleOpenWebApp}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span>
                {dueWords.length > 0
                  ? t.openWebAppWithCount(dueWords.length)
                  : t.openWebApp}
              </span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          /* Settings View */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView('words')}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.backToWords}</span>
              </button>

              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  isConfigured
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isConfigured ? 'bg-blue-600' : 'bg-amber-500'
                  }`}
                />
                {isConfigured ? t.statusReady : t.statusMissing}
              </span>
            </div>

            <form
              onSubmit={handleSaveSettings}
              className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
            >
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
                {t.settingsTitle}
              </h2>

              {/* GAS_WEB_APP_URL */}
              <div className="space-y-1">
                <label
                  htmlFor="gas-url"
                  className="block text-xs font-semibold text-slate-800"
                >
                  {t.gasLabel}
                </label>
                <p id="gas-url-hint" className="text-[11px] text-slate-500">
                  {t.gasHint}
                </p>
                <input
                  id="gas-url"
                  type="url"
                  required
                  disabled={!loaded}
                  value={gasUrl}
                  onChange={(e) => {
                    setGasUrl(e.target.value);
                    setStatusMsg('');
                    if (gasInvalid) setGasInvalid(e.target.matches(':user-invalid'));
                  }}
                  onBlur={(e) => setGasInvalid(e.target.matches(':user-invalid'))}
                  onInvalid={() => setGasInvalid(true)}
                  aria-invalid={gasInvalid ? 'true' : 'false'}
                  aria-describedby={
                    gasInvalid ? 'gas-url-hint gas-url-err' : 'gas-url-hint'
                  }
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="validated-input w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-60"
                />
                <div
                  id="gas-url-err"
                  className="field-error-msg items-center gap-1 text-[11px] font-medium text-rose-600"
                >
                  <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{t.gasError}</span>
                </div>
              </div>

              {/* Display Language Selector */}
              <div className="space-y-1">
                <label
                  htmlFor="ui-lang-select"
                  className="flex items-center gap-1 text-xs font-semibold text-slate-800"
                >
                  <Globe className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>{t.uiLangLabel}</span>
                </label>
                <select
                  id="ui-lang-select"
                  value={uiLang}
                  onChange={(e) => handleChangeUiLang(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={!loaded}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.saveBtn}</span>
              </button>

              {statusMsg && (
                <div
                  role="status"
                  className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-medium text-blue-800"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-800"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

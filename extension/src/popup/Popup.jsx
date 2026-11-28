import { useCallback, useEffect, useRef, useState } from 'react';
import { isSpeechSupported, speakWord, stopSpeaking } from '../utils/speech';
import { getPopupTranslations } from './i18n';
import {
  CACHE_TTL_MS,
  DEFAULT_SHEET_LANG,
  fetchDueWordsData,
  getTodayDateString,
  loadCachedDueWords,
  loadSyncSettings,
  normalizeGasUrl,
  openWebAppTab,
  saveSyncSettings,
} from './storage';
import PopupHeader from './components/PopupHeader';
import DueWordsView from './components/DueWordsView';
import SettingsView from './components/SettingsView';

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

  const uiLangRef = useRef(uiLang);
  uiLangRef.current = uiLang;
  const saveRedirectTimerRef = useRef(null);

  const t = getPopupTranslations(uiLang);
  const speechAvailable = isSpeechSupported();

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (saveRedirectTimerRef.current !== null) {
        clearTimeout(saveRedirectTimerRef.current);
      }
    };
  }, []);

  const fetchDueWords = useCallback(
    async (
      targetGasUrl,
      targetSheetLang = DEFAULT_SHEET_LANG,
      langKey,
      { force = false } = {}
    ) => {
      const effectiveLang = langKey || uiLangRef.current || 'vi';
      const copy = getPopupTranslations(effectiveLang);
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
        const result = await fetchDueWordsData({
          gasUrl: cleanUrl,
          sheetLang: targetSheetLang,
          copy,
          force,
        });
        setDueWords(result.words);
        setLastUpdatedAt(result.updatedAt);
      } catch (err) {
        setWordsError(copy.fetchErr(err?.message || 'Network error'));
      } finally {
        setLoadingWords(false);
      }
    },
    []
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
          setErrorMsg(getPopupTranslations('vi').loadSettingsErr(err.message));
        }
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchDueWords]);

  const handleSpeak = useCallback(
    (e, item) => {
      e.stopPropagation();
      speakWord(item.word, sheetLang, {
        onStart: () => setSpeakingId(item.id),
        onEnd: () => setSpeakingId((curr) => (curr === item.id ? null : curr)),
        onError: () =>
          setSpeakingId((curr) => (curr === item.id ? null : curr)),
      });
    },
    [sheetLang]
  );

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;

    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'sync' && changes.UI_LANG) {
        setUiLang(changes.UI_LANG.newValue === 'en' ? 'en' : 'vi');
      }
      if (areaName === 'local' && changes.CACHED_DUE_WORDS) {
        const nextWords = Array.isArray(changes.CACHED_DUE_WORDS.newValue)
          ? changes.CACHED_DUE_WORDS.newValue
          : [];
        setDueWords(nextWords);
        setLastUpdatedAt(
          Number(changes.CACHED_DUE_UPDATED_AT?.newValue) || Date.now()
        );
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleChangeUiLang = useCallback(async (nextLang) => {
    const normalized = nextLang === 'en' ? 'en' : 'vi';
    setUiLang(normalized);
    await saveSyncSettings({
      UI_LANG: normalized,
      UI_LANG_UPDATED_AT: Date.now(),
    });
  }, []);

  const toggleWordReveal = useCallback((id) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
      if (saveRedirectTimerRef.current !== null) {
        clearTimeout(saveRedirectTimerRef.current);
      }
      saveRedirectTimerRef.current = setTimeout(() => {
        saveRedirectTimerRef.current = null;
        setStatusMsg('');
        setView('words');
      }, 900);
    } catch (err) {
      setErrorMsg(t.saveSettingsErr(err.message));
    }
  };

  const isConfigured = Boolean(gasUrl.trim());

  return (
    <div className="w-[380px] bg-slate-50 text-slate-900">
      <PopupHeader
        view={view}
        uiLang={uiLang}
        t={t}
        onChangeUiLang={handleChangeUiLang}
        onToggleSettings={() => {
          setErrorMsg('');
          setStatusMsg('');
          setView((prev) => (prev === 'settings' ? 'words' : 'settings'));
        }}
      />

      <div className="p-4">
        {view === 'words' ? (
          <DueWordsView
            loaded={loaded}
            isConfigured={isConfigured}
            dueWords={dueWords}
            loadingWords={loadingWords}
            wordsError={wordsError}
            lastUpdatedAt={lastUpdatedAt}
            showMeanings={showMeanings}
            revealedIds={revealedIds}
            speechAvailable={speechAvailable}
            speakingId={speakingId}
            sheetLang={sheetLang}
            t={t}
            onToggleShowMeanings={() => setShowMeanings((prev) => !prev)}
            onRefresh={() =>
              fetchDueWords(gasUrl, sheetLang, uiLang, { force: true })
            }
            onOpenSettings={() => setView('settings')}
            onToggleReveal={toggleWordReveal}
            onSpeak={handleSpeak}
            onOpenWebApp={openWebAppTab}
          />
        ) : (
          <SettingsView
            loaded={loaded}
            isConfigured={isConfigured}
            gasUrl={gasUrl}
            gasInvalid={gasInvalid}
            uiLang={uiLang}
            statusMsg={statusMsg}
            errorMsg={errorMsg}
            t={t}
            onBack={() => setView('words')}
            onGasUrlChange={(val) => {
              setGasUrl(val);
              setStatusMsg('');
            }}
            onGasInvalidChange={setGasInvalid}
            onChangeUiLang={handleChangeUiLang}
            onSubmit={handleSaveSettings}
          />
        )}
      </div>
    </div>
  );
}

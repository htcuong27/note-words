import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, Search } from 'lucide-react';
import WordTable from '../components/WordTable';
import {
  cleanWordText,
  deleteWord,
  editWord,
  getWords,
  getWordsCacheMeta,
  normalizeWordKey,
} from '../utils/api';
import { isWordDue } from '../utils/sm2';
import { formatCacheAge, getTranslations } from '../utils/i18n';

export default function VocabularyListPage({
  apiUrl,
  currentLang,
  uiLang = 'vi',
  onOpenSettings,
}) {
  const [words, setWords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'due'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const t = getTranslations(uiLang).list;
  const loadErrRef = useRef(t.loadErr);
  loadErrRef.current = t.loadErr;

  const loadAllWords = useCallback(
    async ({ forceRefresh = false } = {}) => {
      if (!apiUrl) {
        setWords([]);
        setError('');
        setLastSyncedAt(null);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await getWords({
          lang: currentLang,
          dueOnly: false,
          forceRefresh,
        });
        setWords(data);
        const meta = getWordsCacheMeta({ lang: currentLang });
        setLastSyncedAt(meta?.updatedAt || Date.now());
      } catch (err) {
        setError(err.message || loadErrRef.current);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, currentLang]
  );

  useEffect(() => {
    loadAllWords();
  }, [loadAllWords]);

  const dueCount = useMemo(
    () => words.filter((w) => isWordDue(w)).length,
    [words]
  );

  const filteredWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return words.filter((item) => {
      if (filterMode === 'due' && !isWordDue(item)) {
        return false;
      }
      if (!q) return true;
      return (
        String(item.word || '').toLowerCase().includes(q) ||
        String(item.phonetic || '').toLowerCase().includes(q) ||
        String(item.meaning || '').toLowerCase().includes(q) ||
        String(item.context || '').toLowerCase().includes(q)
      );
    });
  }, [words, searchQuery, filterMode]);

  const handleSaveEdit = async ({ id, word, phonetic, meaning, context }) => {
    setActionError('');
    const cleanedWord = cleanWordText(word);
    const targetKey = normalizeWordKey(cleanedWord);
    const hasDuplicate = words.some(
      (item) => item.id !== id && normalizeWordKey(item.word) === targetKey
    );
    if (hasDuplicate) {
      const msg = t.duplicateErr(cleanedWord);
      setActionError(msg);
      throw new Error(msg);
    }

    try {
      const updated = await editWord({
        id,
        word: cleanedWord,
        phonetic,
        meaning,
        context,
        lang: currentLang,
      });
      setWords((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
    } catch (err) {
      setActionError(t.editErr(err.message));
      throw err;
    }
  };

  const handleDelete = async (id) => {
    setActionError('');
    try {
      await deleteWord({ id, lang: currentLang });
      setWords((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActionError(t.deleteErr(err.message));
      throw err;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {t.title}
          </h1>
          <p className="text-sm text-slate-500">
            {t.sheetPrefix}{' '}
            <span className="font-semibold text-blue-700">{currentLang}</span> ·{' '}
            {t.summary(words.length, dueCount)}
            {lastSyncedAt ? ` · ${formatCacheAge(lastSyncedAt, uiLang)}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadAllWords({ forceRefresh: true })}
          disabled={loading || !apiUrl}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`}
            aria-hidden="true"
          />
          {t.refresh}
        </button>
      </div>

      {/* Search & Filter */}
      {apiUrl && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchAria}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3 pl-9 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          <div
            role="group"
            aria-label={t.filterGroupAria}
            className="inline-flex self-start rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs"
          >
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              aria-pressed={filterMode === 'all'}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                filterMode === 'all'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.filterAll(words.length)}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('due')}
              aria-pressed={filterMode === 'due'}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                filterMode === 'due'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.filterDue(dueCount)}
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {!apiUrl ? (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">{t.noApiPrompt}</p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
          >
            {t.openSettings}
          </button>
        </div>
      ) : loading ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">{t.loadingAll}</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"
        >
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-rose-900">{error}</p>
          <button
            type="button"
            onClick={() => loadAllWords({ forceRefresh: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t.retry}
          </button>
        </div>
      ) : (
        <WordTable
          words={filteredWords}
          onSaveEdit={handleSaveEdit}
          onDelete={handleDelete}
          lang={currentLang}
          uiLang={uiLang}
        />
      )}
    </div>
  );
}

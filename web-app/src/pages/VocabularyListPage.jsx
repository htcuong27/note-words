import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, Search } from 'lucide-react';
import WordTable from '../components/WordTable';
import { deleteWord, editWord, getWords } from '../utils/api';
import { isWordDue } from '../utils/sm2';

export default function VocabularyListPage({ apiUrl, currentLang, onOpenSettings }) {
  const [words, setWords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'due'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const loadAllWords = useCallback(async () => {
    if (!apiUrl) {
      setWords([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await getWords({ lang: currentLang, dueOnly: false });
      setWords(data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách từ vựng.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, currentLang]);

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
        String(item.meaning || '').toLowerCase().includes(q) ||
        String(item.context || '').toLowerCase().includes(q)
      );
    });
  }, [words, searchQuery, filterMode]);

  const handleSaveEdit = async ({ id, word, meaning, context }) => {
    setActionError('');
    try {
      const updated = await editWord({
        id,
        word,
        meaning,
        context,
        lang: currentLang,
      });
      setWords((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
    } catch (err) {
      setActionError(`Lỗi cập nhật từ: ${err.message}`);
      throw err;
    }
  };

  const handleDelete = async (id) => {
    setActionError('');
    try {
      await deleteWord({ id, lang: currentLang });
      setWords((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActionError(`Lỗi xóa từ: ${err.message}`);
      throw err;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Danh sách từ vựng
          </h1>
          <p className="text-sm text-slate-500">
            Tab <span className="font-medium text-slate-700">{currentLang}</span> ·{' '}
            {words.length} từ ({dueCount} từ đến hạn ôn)
          </p>
        </div>

        <button
          type="button"
          onClick={loadAllWords}
          disabled={loading || !apiUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Làm mới
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
              placeholder="Tìm theo từ, nghĩa tiếng Việt hoặc ngữ cảnh..."
              aria-label="Tìm kiếm từ vựng"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3 pl-9 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            />
          </div>

          <div
            role="group"
            aria-label="Lọc danh sách từ"
            className="inline-flex self-start rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs"
          >
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterMode === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({words.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('due')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterMode === 'due'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đến hạn ({dueCount})
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {!apiUrl ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            Hãy cấu hình Google Apps Script Web App URL để xem danh sách từ.
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Mở trang Cài đặt
          </button>
        </div>
      ) : loading ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Đang tải toàn bộ từ vựng…</p>
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-rose-900">{error}</p>
          <button
            type="button"
            onClick={loadAllWords}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      ) : (
        <WordTable
          words={filteredWords}
          onSaveEdit={handleSaveEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

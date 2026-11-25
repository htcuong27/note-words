import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import Flashcard from '../components/Flashcard';
import ReviewControls from '../components/ReviewControls';
import { getWords, updateReview } from '../utils/api';
import { RATING, calculateSM2 } from '../utils/sm2';

export default function ReviewPage({ apiUrl, currentLang, onOpenSettings }) {
  const [dueOnly, setDueOnly] = useState(true);
  const [queue, setQueue] = useState([]);
  const [totalInitial, setTotalInitial] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [requeuedNotice, setRequeuedNotice] = useState('');

  const loadCards = useCallback(
    async (targetDueOnly = dueOnly) => {
      if (!apiUrl) {
        setQueue([]);
        setTotalInitial(0);
        setReviewedCount(0);
        setError('');
        return;
      }

      setLoading(true);
      setError('');
      setIsFlipped(false);
      setRequeuedNotice('');

      try {
        const words = await getWords({ lang: currentLang, dueOnly: targetDueOnly });
        setQueue(words);
        setTotalInitial(words.length);
        setReviewedCount(0);
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách từ cần ôn.');
        setQueue([]);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, currentLang, dueOnly]
  );

  useEffect(() => {
    loadCards(dueOnly);
  }, [loadCards, dueOnly]);

  const currentCard = queue[0] || null;

  const handleFlip = useCallback(() => {
    if (!currentCard) return;
    setIsFlipped((prev) => !prev);
  }, [currentCard]);

  const handleRate = useCallback(
    (quality) => {
      if (!currentCard) return;

      const sm2Result = calculateSM2(currentCard, quality);
      const updatedCard = {
        ...currentCard,
        repetition: sm2Result.repetition,
        interval: sm2Result.interval,
        easeFactor: sm2Result.easeFactor,
        nextReviewDate: sm2Result.nextReviewDate,
        lastReviewedAt: sm2Result.lastReviewedAt,
      };

      // Optimistic UI update: immediately advance the queue
      setIsFlipped(false);
      setReviewedCount((prev) => prev + 1);

      if (quality === RATING.AGAIN) {
        // Re-queue forgotten word at the end of current session for reinforcement
        setQueue((prev) => {
          const rest = prev.slice(1);
          return [...rest, updatedCard];
        });
        setRequeuedNotice(`Đã đưa "${currentCard.word}" về cuối hàng đợi để ôn lại trong phiên này.`);
      } else {
        setQueue((prev) => prev.slice(1));
        setRequeuedNotice('');
      }

      // Sync UPDATE_REVIEW to Google Sheets in background
      setPendingSyncs((c) => c + 1);
      setSyncError('');

      updateReview({
        id: currentCard.id,
        repetition: sm2Result.repetition,
        interval: sm2Result.interval,
        easeFactor: sm2Result.easeFactor,
        nextReviewDate: sm2Result.nextReviewDate,
        lastReviewedAt: sm2Result.lastReviewedAt,
        quality,
        lang: currentLang,
      })
        .catch((err) => {
          setSyncError(
            `Không thể đồng bộ "${currentCard.word}" lên Google Sheets: ${err.message}`
          );
        })
        .finally(() => {
          setPendingSyncs((c) => Math.max(0, c - 1));
        });
    },
    [currentCard, currentLang]
  );

  // Keyboard shortcuts: Space to flip, 1-4 to rate when flipped
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }
      if (!currentCard || loading) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
        return;
      }

      if (isFlipped) {
        if (e.key === '1') {
          e.preventDefault();
          handleRate(RATING.AGAIN);
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate(RATING.HARD);
        } else if (e.key === '3') {
          e.preventDefault();
          handleRate(RATING.GOOD);
        } else if (e.key === '4') {
          e.preventDefault();
          handleRate(RATING.EASY);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, loading, isFlipped, handleFlip, handleRate]);

  const completedUnique = Math.max(0, totalInitial - queue.length);
  const progressPercent =
    totalInitial > 0 ? Math.min(100, Math.round((completedUnique / totalInitial) * 100)) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Ôn tập Flashcards
          </h1>
          <p className="text-sm text-slate-500">
            Tab <span className="font-medium text-slate-700">{currentLang}</span> ·{' '}
            {dueOnly ? 'Các từ đến hạn hôm nay' : 'Tất cả từ vựng'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Chế độ lọc thẻ ôn tập"
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs"
          >
            <button
              type="button"
              onClick={() => setDueOnly(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                dueOnly
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đến hạn
            </button>
            <button
              type="button"
              onClick={() => setDueOnly(false)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                !dueOnly
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ôn tất cả
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadCards(dueOnly)}
            disabled={loading || !apiUrl}
            aria-label="Tải lại danh sách ôn tập"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Tải lại
          </button>
        </div>
      </div>

      {/* Progress & Sync Status */}
      {apiUrl && !loading && totalInitial > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Còn lại <strong className="text-slate-800">{queue.length}</strong> thẻ · Đã trả lời{' '}
              <strong className="text-slate-800">{reviewedCount}</strong> lượt
            </span>
            <span className="inline-flex items-center gap-1">
              {pendingSyncs > 0 ? (
                <>
                  <CloudUpload className="h-3.5 w-3.5 animate-pulse text-indigo-600" aria-hidden="true" />
                  <span className="text-indigo-600">Đang đồng bộ ({pendingSyncs})…</span>
                </>
              ) : (
                <span>{progressPercent}% hoàn thành</span>
              )}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Notices */}
      {requeuedNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800">
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{requeuedNotice}</span>
        </div>
      )}

      {syncError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Main Content Area */}
      {!apiUrl ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            Bạn chưa cấu hình Google Apps Script Web App URL.
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
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">Đang tải từ vựng từ Google Sheets…</p>
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-rose-900">{error}</p>
          <button
            type="button"
            onClick={() => loadCards(dueOnly)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      ) : currentCard ? (
        <div className="space-y-5">
          <Flashcard card={currentCard} isFlipped={isFlipped} onFlip={handleFlip} />
          <ReviewControls
            card={currentCard}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            onRate={handleRate}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-white p-10 text-center shadow-xs">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            {totalInitial > 0
              ? 'Xuất sắc! Bạn đã hoàn thành phiên ôn tập.'
              : dueOnly
                ? 'Không có từ nào đến hạn ôn hôm nay!'
                : 'Chưa có từ vựng nào trong tab này.'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {dueOnly
              ? 'Bạn có thể chuyển sang chế độ "Ôn tất cả" nếu muốn luyện tập thêm.'
              : 'Hãy dùng Chrome Extension hoặc API để thêm từ mới vào Google Sheets.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {dueOnly && (
              <button
                type="button"
                onClick={() => setDueOnly(false)}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Xem & ôn tất cả từ
              </button>
            )}
            <button
              type="button"
              onClick={() => loadCards(dueOnly)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Kiểm tra lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

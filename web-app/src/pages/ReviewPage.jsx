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
import WordFillPractice from '../components/WordFillPractice';
import {
  getWords,
  getWordsCacheMeta,
  patchCachedWord,
  updateReview,
} from '../utils/api';
import { RATING, calculateSM2 } from '../utils/sm2';
import { formatCacheAge, getTranslations } from '../utils/i18n';
import { speakWord, stopSpeaking } from '../utils/speech';
import {
  getFillableIndices,
  pickRandomBlankIndices,
} from '../utils/wordFill';

export default function ReviewPage({
  apiUrl,
  currentLang,
  uiLang = 'vi',
  onOpenSettings,
}) {
  const [dueOnly, setDueOnly] = useState(true);
  const [queue, setQueue] = useState([]);
  const [totalInitial, setTotalInitial] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [stage, setStage] = useState('front'); // 'front' | 'back' | 'practice' | 'rate'
  const [wrongAttemptsById, setWrongAttemptsById] = useState({});
  const [blankIndices, setBlankIndices] = useState([]);
  const [practicePassed, setPracticePassed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [syncError, setSyncError] = useState('');
  const [requeuedWord, setRequeuedWord] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const t = getTranslations(uiLang).review;

  const resetCardPractice = useCallback(() => {
    setStage('front');
    setBlankIndices([]);
    setPracticePassed(false);
  }, []);

  const loadCards = useCallback(
    async (targetDueOnly = dueOnly, { forceRefresh = false } = {}) => {
      if (!apiUrl) {
        setQueue([]);
        setTotalInitial(0);
        setReviewedCount(0);
        setError('');
        setLastSyncedAt(null);
        setWrongAttemptsById({});
        resetCardPractice();
        return;
      }

      setLoading(true);
      setError('');
      setWrongAttemptsById({});
      resetCardPractice();
      setRequeuedWord('');

      try {
        const words = await getWords({
          lang: currentLang,
          dueOnly: targetDueOnly,
          forceRefresh,
        });
        setQueue(words);
        setTotalInitial(words.length);
        setReviewedCount(0);
        const meta = getWordsCacheMeta({ lang: currentLang });
        setLastSyncedAt(meta?.updatedAt || Date.now());
      } catch (err) {
        setError(err.message || t.loadError);
        setQueue([]);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, currentLang, dueOnly, resetCardPractice, t.loadError]
  );

  useEffect(() => {
    loadCards(dueOnly);
  }, [loadCards, dueOnly]);

  const currentCard = queue[0] || null;
  const currentWrongAttempts = currentCard
    ? wrongAttemptsById[currentCard.id] || 0
    : 0;
  const isFlipped = stage === 'back' || stage === 'rate';

  const handleFlip = useCallback(() => {
    if (!currentCard) return;
    setStage((prev) => {
      if (prev === 'practice') return prev;
      if (prev === 'front') return practicePassed ? 'rate' : 'back';
      return 'front';
    });
  }, [currentCard, practicePassed]);

  const startPractice = useCallback(() => {
    if (!currentCard) return;
    const fillable = getFillableIndices(currentCard.word);
    if (fillable.length === 0) {
      setPracticePassed(true);
      setStage('rate');
      return;
    }
    const cardWrongCount = wrongAttemptsById[currentCard.id] || 0;
    setBlankIndices((prev) =>
      prev.length > 0
        ? prev
        : pickRandomBlankIndices(currentCard.word, cardWrongCount)
    );
    setStage('practice');
  }, [currentCard, wrongAttemptsById]);

  const handleWrongRequeue = useCallback(() => {
    if (!currentCard) return;
    stopSpeaking();
    setWrongAttemptsById((prev) => ({
      ...prev,
      [currentCard.id]: (prev[currentCard.id] || 0) + 1,
    }));
    setQueue((prev) => {
      if (prev.length <= 1) return [...prev];
      const [first, ...rest] = prev;
      return [...rest, first];
    });
    setRequeuedWord(currentCard.word);
    resetCardPractice();
  }, [currentCard, resetCardPractice]);

  const handlePracticeSuccess = useCallback(() => {
    if (currentCard?.word) {
      speakWord(currentCard.word, currentLang);
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    setPracticePassed(true);
    setStage('rate');
  }, [currentCard, currentLang]);

  useEffect(() => {
    if (stage === 'practice') return;
    const active = document.activeElement;
    const tag = active?.tagName?.toLowerCase();
    if (tag === 'button' || tag === 'a') {
      active.blur?.();
    }
  }, [stage]);

  const handleBackToCard = useCallback(() => {
    setStage('back');
  }, []);

  const handleRate = useCallback(
    (quality) => {
      if (!currentCard) return;

      const sm2Result = calculateSM2(currentCard, quality);
      const sm2Patch = {
        repetition: sm2Result.repetition,
        interval: sm2Result.interval,
        easeFactor: sm2Result.easeFactor,
        nextReviewDate: sm2Result.nextReviewDate,
        lastReviewedAt: sm2Result.lastReviewedAt,
      };
      const updatedCard = {
        ...currentCard,
        ...sm2Patch,
      };

      stopSpeaking();
      patchCachedWord({
        id: currentCard.id,
        patch: sm2Patch,
        lang: currentLang,
      });

      resetCardPractice();
      setReviewedCount((prev) => prev + 1);

      if (quality === RATING.AGAIN) {
        setQueue((prev) => {
          const rest = prev.slice(1);
          return [...rest, updatedCard];
        });
        setRequeuedWord(currentCard.word);
      } else {
        setQueue((prev) => prev.slice(1));
        setRequeuedWord('');
      }

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
          setSyncError(t.syncError(currentCard.word, err.message));
        })
        .finally(() => {
          setPendingSyncs((c) => Math.max(0, c - 1));
        });
    },
    [currentCard, currentLang, resetCardPractice, t]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!currentCard || loading) return;

      const isPKey = e.code === 'KeyP' || e.key.toLowerCase() === 'p';

      // Alt+P works everywhere (including inside WordFillPractice inputs)
      if (isPKey && e.altKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        speakWord(currentCard.word, currentLang);
        return;
      }

      const tag = e.target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        e.target?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space' && stage !== 'practice') {
        e.preventDefault();
        const active = document.activeElement;
        const activeTag = active?.tagName?.toLowerCase();
        if (activeTag === 'button' || activeTag === 'a') {
          active.blur?.();
        }
        handleFlip();
        return;
      }

      if (e.key === 'Enter' && stage === 'back') {
        e.preventDefault();
        const active = document.activeElement;
        const activeTag = active?.tagName?.toLowerCase();
        if (activeTag === 'button' || activeTag === 'a') {
          active.blur?.();
        }
        startPractice();
        return;
      }

      if (isPKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        speakWord(currentCard.word, currentLang);
        return;
      }

      if (stage === 'rate') {
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
  }, [
    currentCard,
    currentLang,
    loading,
    stage,
    handleFlip,
    startPractice,
    handleRate,
  ]);

  const completedUnique = Math.max(0, totalInitial - queue.length);
  const progressPercent =
    totalInitial > 0
      ? Math.min(100, Math.round((completedUnique / totalInitial) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {t.title}
          </h1>
          <p className="text-sm text-slate-500">
            {t.sheetPrefix}{' '}
            <span className="font-semibold text-blue-700">{currentLang}</span> ·{' '}
            {dueOnly ? t.modeDue : t.modeAll}
            {lastSyncedAt ? ` · ${formatCacheAge(lastSyncedAt, uiLang)}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={t.filterGroupAria}
            className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs"
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setDueOnly(true)}
              aria-pressed={dueOnly}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                dueOnly
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.dueBtn}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setDueOnly(false)}
              aria-pressed={!dueOnly}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                !dueOnly
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.allBtn}
            </button>
          </div>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => loadCards(dueOnly, { forceRefresh: true })}
            disabled={loading || !apiUrl}
            aria-label={t.reloadAria}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`}
              aria-hidden="true"
            />
            {t.reloadBtn}
          </button>
        </div>
      </div>

      {/* Progress & Sync Status */}
      {apiUrl && !loading && totalInitial > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {t.remainingPrefix}{' '}
              <strong className="text-slate-800">{queue.length}</strong>{' '}
              {t.remainingUnit} · {t.answeredPrefix}{' '}
              <strong className="text-slate-800">{reviewedCount}</strong>{' '}
              {t.answeredUnit}
            </span>
            <span className="inline-flex items-center gap-1">
              {pendingSyncs > 0 ? (
                <>
                  <CloudUpload
                    className="h-3.5 w-3.5 animate-pulse text-blue-600"
                    aria-hidden="true"
                  />
                  <span className="font-medium text-blue-600">
                    {t.syncing(pendingSyncs)}
                  </span>
                </>
              ) : (
                <span>{t.completedPct(progressPercent)}</span>
              )}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Notices */}
      {requeuedWord && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-blue-900">
          <RotateCcw className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
          <span>{t.requeuedNotice(requeuedWord)}</span>
        </div>
      )}

      {syncError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Main Content Area */}
      {!apiUrl ? (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-700">{t.noApiPrompt}</p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-4 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {t.openSettings}
          </button>
        </div>
      ) : loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">{t.loadingCards}</p>
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
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => loadCards(dueOnly, { forceRefresh: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t.retry}
          </button>
        </div>
      ) : currentCard ? (
        <div className="space-y-5">
          {stage === 'practice' ? (
            <WordFillPractice
              card={currentCard}
              lang={currentLang}
              uiLang={uiLang}
              wrongAttempts={currentWrongAttempts}
              blankIndices={blankIndices}
              onWrongRequeue={handleWrongRequeue}
              onSuccess={handlePracticeSuccess}
              onBackToCard={handleBackToCard}
            />
          ) : (
            <>
              <Flashcard
                card={currentCard}
                isFlipped={isFlipped}
                onFlip={handleFlip}
                lang={currentLang}
                uiLang={uiLang}
              />
              {stage === 'rate' && practicePassed && (
                <div
                  role="status"
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
                >
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>
                    {currentWrongAttempts > 0
                      ? t.practicePassedWithRetries(currentWrongAttempts)
                      : t.practicePassed}
                  </span>
                </div>
              )}
              <ReviewControls
                card={currentCard}
                isFlipped={isFlipped}
                stage={stage}
                onFlip={handleFlip}
                onStartPractice={startPractice}
                onRate={handleRate}
                uiLang={uiLang}
              />
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-blue-200 bg-white p-10 text-center shadow-xs">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-blue-600"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            {totalInitial > 0
              ? t.doneSession
              : dueOnly
                ? t.emptyDue
                : t.emptySheet}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {dueOnly ? t.dueHint : t.emptyHint}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {dueOnly && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setDueOnly(false)}
                className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
              >
                {t.reviewAllCta}
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => loadCards(dueOnly, { forceRefresh: true })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t.checkAgain}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

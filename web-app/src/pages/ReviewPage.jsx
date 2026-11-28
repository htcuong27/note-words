import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Flashcard from '../components/Flashcard';
import ReviewControls from '../components/ReviewControls';
import WordFillPractice from '../components/WordFillPractice';
import ReviewToolbar from '../components/review/ReviewToolbar';
import ReviewProgress from '../components/review/ReviewProgress';
import {
  ReviewDoneState,
  ReviewErrorState,
  ReviewLoadingState,
  ReviewNoApiState,
  ReviewNotices,
} from '../components/review/ReviewStatusStates';
import { useReviewShortcuts } from '../hooks/useReviewShortcuts';
import {
  getCachedDueWords,
  getWords,
  getWordsCacheMeta,
  patchCachedWord,
  updateReview,
} from '../utils/api';
import { notifyExtensionReviewUpdated } from '../utils/extensionBridge';
import { RATING, calculateSM2 } from '../utils/sm2';
import { getTranslations } from '../utils/i18n';
import { fetchPhonetic } from '../utils/phonetics';
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
  const loadErrorRef = useRef(t.loadError);
  loadErrorRef.current = t.loadError;

  const resetCardPractice = useCallback(() => {
    setStage('front');
    setBlankIndices([]);
    setPracticePassed(false);
  }, []);

  const syncExtensionDueWords = useCallback(
    ({ forceRefresh = false } = {}) => {
      if (!apiUrl) return;
      const dueWords = getCachedDueWords({ lang: currentLang, url: apiUrl });
      notifyExtensionReviewUpdated({
        gasUrl: apiUrl,
        sheetLang: currentLang,
        dueWords,
        forceRefresh: forceRefresh || dueWords === null,
      });
    },
    [apiUrl, currentLang]
  );

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
        syncExtensionDueWords();
      } catch (err) {
        setError(err.message || loadErrorRef.current);
        setQueue([]);
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, currentLang, dueOnly, resetCardPractice, syncExtensionDueWords]
  );

  useEffect(() => {
    loadCards(dueOnly);
  }, [loadCards, dueOnly]);

  // Notify extension when a review session finishes and all GAS syncs have settled
  const sessionCompletedNotifiedRef = useRef(false);
  useEffect(() => {
    if (reviewedCount === 0 || queue.length > 0) {
      sessionCompletedNotifiedRef.current = false;
      return;
    }
    if (!loading && pendingSyncs === 0 && !sessionCompletedNotifiedRef.current) {
      sessionCompletedNotifiedRef.current = true;
      syncExtensionDueWords();
    }
  }, [reviewedCount, queue.length, loading, pendingSyncs, syncExtensionDueWords]);

  // Warn before closing tab if review syncs are still in flight
  useEffect(() => {
    if (pendingSyncs <= 0) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingSyncs]);

  const currentCard = queue[0] || null;
  const nextCard = queue[1] || null;

  // Pre-warm IPA cache for the next card in the review queue
  useEffect(() => {
    if (nextCard?.word && !nextCard.phonetic) {
      fetchPhonetic(nextCard.word, currentLang);
    }
  }, [nextCard?.id, nextCard?.word, nextCard?.phonetic, currentLang]);
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
    if (
      document.activeElement &&
      typeof document.activeElement.blur === 'function'
    ) {
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
      syncExtensionDueWords();

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
        .then(() => {
          syncExtensionDueWords();
        })
        .catch((err) => {
          setSyncError(t.syncError(currentCard.word, err.message));
        })
        .finally(() => {
          setPendingSyncs((c) => Math.max(0, c - 1));
        });
    },
    [currentCard, currentLang, resetCardPractice, syncExtensionDueWords, t]
  );

  useReviewShortcuts({
    currentCard,
    currentLang,
    loading,
    stage,
    onFlip: handleFlip,
    onStartPractice: startPractice,
    onRate: handleRate,
  });

  const completedUnique = Math.max(0, totalInitial - queue.length);
  const progressPercent =
    totalInitial > 0
      ? Math.min(100, Math.round((completedUnique / totalInitial) * 100))
      : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ReviewToolbar
        t={t}
        currentLang={currentLang}
        uiLang={uiLang}
        dueOnly={dueOnly}
        lastSyncedAt={lastSyncedAt}
        loading={loading}
        apiUrl={apiUrl}
        onChangeDueOnly={setDueOnly}
        onReload={() => loadCards(dueOnly, { forceRefresh: true })}
      />

      {apiUrl && !loading && totalInitial > 0 && (
        <ReviewProgress
          t={t}
          remainingCount={queue.length}
          reviewedCount={reviewedCount}
          pendingSyncs={pendingSyncs}
          progressPercent={progressPercent}
        />
      )}

      <ReviewNotices requeuedWord={requeuedWord} syncError={syncError} t={t} />

      {!apiUrl ? (
        <ReviewNoApiState t={t} onOpenSettings={onOpenSettings} />
      ) : loading ? (
        <ReviewLoadingState t={t} />
      ) : error ? (
        <ReviewErrorState
          error={error}
          t={t}
          onRetry={() => loadCards(dueOnly, { forceRefresh: true })}
        />
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
        <ReviewDoneState
          totalInitial={totalInitial}
          dueOnly={dueOnly}
          t={t}
          onReviewAll={() => setDueOnly(false)}
          onCheckAgain={() => loadCards(dueOnly, { forceRefresh: true })}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { getTranslations } from '../utils/i18n';
import { isSpeechSupported, speakWord, stopSpeaking } from '../utils/speech';
import { checkFillAnswer, getFillableIndices } from '../utils/wordFill';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function MaskedContext({ context, word }) {
  if (!context) return null;
  const trimmedWord = String(word || '').trim();
  if (!trimmedWord) return <span>{context}</span>;

  const regex = new RegExp(`(${escapeRegExp(trimmedWord)})`, 'gi');
  const parts = String(context).split(regex);

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === trimmedWord.toLowerCase() ? (
          <span
            key={idx}
            aria-hidden="true"
            className="mx-0.5 inline-block rounded bg-blue-100/80 px-2 py-0.5 font-mono text-xs font-semibold tracking-widest text-blue-700"
          >
            _____
          </span>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  );
}

export default function WordFillPractice({
  card,
  lang = 'English',
  uiLang = 'vi',
  wrongAttempts = 0,
  blankIndices = [],
  onWrongRequeue,
  onSuccess,
  onBackToCard,
}) {
  const [inputs, setInputs] = useState({});
  const [failedWrongIndices, setFailedWrongIndices] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const inputRefs = useRef({});
  const continueBtnRef = useRef(null);
  const passedRef = useRef(false);
  const lastFocusedBlankIdxRef = useRef(null);

  const isFailed = Array.isArray(failedWrongIndices);
  const wrongIndexSet = useMemo(
    () => new Set(failedWrongIndices || []),
    [failedWrongIndices]
  );

  const t = getTranslations(uiLang).fillPractice;
  const flashT = getTranslations(uiLang).flashcard;
  const controlsT = getTranslations(uiLang).controls;
  const speechAvailable = isSpeechSupported();

  const chars = useMemo(() => Array.from(String(card?.word || '')), [card?.word]);
  const totalFillable = useMemo(
    () => getFillableIndices(card?.word).length,
    [card?.word]
  );
  const blankSet = useMemo(() => new Set(blankIndices), [blankIndices]);

  const tokenGroups = useMemo(() => {
    const groups = [];
    let currentWordTokens = [];

    chars.forEach((ch, idx) => {
      if (/\s/.test(ch)) {
        if (currentWordTokens.length > 0) {
          groups.push({ type: 'word', items: currentWordTokens });
          currentWordTokens = [];
        }
        groups.push({ type: 'space', index: idx, char: ch });
      } else {
        currentWordTokens.push({ index: idx, char: ch });
      }
    });

    if (currentWordTokens.length > 0) {
      groups.push({ type: 'word', items: currentWordTokens });
    }
    return groups;
  }, [chars]);

  useEffect(() => {
    setInputs({});
    setFailedWrongIndices(null);
    if (blankIndices.length > 0) {
      const firstIdx = blankIndices[0];
      requestAnimationFrame(() => {
        inputRefs.current[firstIdx]?.focus();
      });
    }
  }, [card?.id, blankIndices]);

  useEffect(() => {
    if (!isFailed) return;
    requestAnimationFrame(() => {
      continueBtnRef.current?.focus();
    });
    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onWrongRequeue?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFailed, onWrongRequeue]);

  useEffect(() => {
    passedRef.current = false;
    setFailedWrongIndices(null);
    return () => {
      setIsSpeaking(false);
      if (!passedRef.current) {
        stopSpeaking();
      }
    };
  }, [card?.id]);

  if (!card) return null;

  const allFilled =
    blankIndices.length > 0 &&
    blankIndices.every((idx) => String(inputs[idx] || '').trim().length > 0);

  const tryAutoAdvance = (nextInputs) => {
    const filledAll =
      blankIndices.length > 0 &&
      blankIndices.every((idx) => String(nextInputs[idx] || '').trim().length > 0);
    if (!filledAll) return false;

    const { isCorrect } = checkFillAnswer(card.word, blankIndices, nextInputs);
    if (!isCorrect) return false;

    setFailedWrongIndices(null);
    passedRef.current = true;
    onSuccess?.();
    return true;
  };

  const handleSpeak = () => {
    speakWord(card.word, lang, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
    if (isFailed) {
      continueBtnRef.current?.focus();
      return;
    }
    const targetIdx =
      lastFocusedBlankIdxRef.current !== null &&
      blankSet.has(lastFocusedBlankIdxRef.current)
        ? lastFocusedBlankIdxRef.current
        : blankIndices.find((idx) => !String(inputs[idx] || '').trim()) ??
          blankIndices[0];
    if (targetIdx !== undefined) {
      inputRefs.current[targetIdx]?.focus();
    }
  };

  const focusBlankAtPos = (pos) => {
    if (pos < 0 || pos >= blankIndices.length) return;
    const targetIndex = blankIndices[pos];
    const el = inputRefs.current[targetIndex];
    if (el) {
      el.focus();
      el.select?.();
    }
  };

  const handleInputChange = (charIdx, blankPos, rawValue) => {
    const cleaned = Array.from(String(rawValue || '').replace(/\s+/g, ''));
    const nextChar = cleaned[cleaned.length - 1] || '';

    const nextInputs = {
      ...inputs,
      [charIdx]: nextChar,
    };
    setInputs(nextInputs);

    if (tryAutoAdvance(nextInputs)) {
      return;
    }

    if (nextChar && blankPos < blankIndices.length - 1) {
      focusBlankAtPos(blankPos + 1);
    }
  };

  const handleInputKeyDown = (e, charIdx, blankPos) => {
    if (e.key === 'Backspace') {
      const currentVal = String(inputs[charIdx] || '');
      if (!currentVal && blankPos > 0) {
        e.preventDefault();
        const prevIdx = blankIndices[blankPos - 1];
        setInputs((prev) => ({
          ...prev,
          [prevIdx]: '',
        }));
        focusBlankAtPos(blankPos - 1);
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      if (blankPos > 0) {
        e.preventDefault();
        focusBlankAtPos(blankPos - 1);
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      if (blankPos < blankIndices.length - 1) {
        e.preventDefault();
        focusBlankAtPos(blankPos + 1);
      }
    }
  };

  const handlePaste = (e, blankPos) => {
    const pasted = e.clipboardData?.getData('text') || '';
    const pastedChars = Array.from(pasted.replace(/\s+/g, ''));
    if (pastedChars.length <= 1) return;

    e.preventDefault();
    const nextInputs = { ...inputs };
    let cursor = blankPos;
    for (const ch of pastedChars) {
      if (cursor >= blankIndices.length) break;
      nextInputs[blankIndices[cursor]] = ch;
      cursor += 1;
    }
    setInputs(nextInputs);

    if (tryAutoAdvance(nextInputs)) {
      return;
    }

    const targetPos = Math.min(
      blankIndices.length - 1,
      blankPos + pastedChars.length
    );
    requestAnimationFrame(() => focusBlankAtPos(targetPos));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFailed) {
      onWrongRequeue?.();
      return;
    }
    if (!allFilled) return;

    const { isCorrect, wrongIndices } = checkFillAnswer(
      card.word,
      blankIndices,
      inputs
    );
    if (isCorrect) {
      setFailedWrongIndices(null);
      passedRef.current = true;
      onSuccess?.();
    } else {
      setFailedWrongIndices(wrongIndices);
    }
  };

  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm sm:p-8">
      {/* Header Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 font-semibold text-white">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {t.badge}
        </span>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
            {t.blanksCount(blankIndices.length, totalFillable)}
          </span>
          {wrongAttempts > 0 && (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
              {t.wrongCount(wrongAttempts)}
            </span>
          )}
        </div>
      </div>

      {/* Meaning + Speaker */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center justify-center gap-2">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {card.meaning || (
              <span className="italic text-slate-400">{flashT.noMeaning}</span>
            )}
          </h2>
          {speechAvailable && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSpeak}
              aria-label={flashT.pronounceAria(card.word)}
              title={t.pronounceTitle}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isSpeaking
                  ? 'border-blue-500 bg-blue-600 text-white shadow-xs'
                  : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
              }`}
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {card.context && (
          <p className="mx-auto mt-3 max-w-xl rounded-xl bg-slate-50 px-4 py-2.5 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200/80">
            <MaskedContext context={card.context} word={card.word} />
          </p>
        )}

        <p className="mt-5 text-xs font-medium text-slate-500">{t.instruction}</p>
      </div>

      {/* Underlined Letter Blanks Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-5">
          {tokenGroups.map((group, groupIdx) => {
            if (group.type === 'space') {
              return (
                <span key={`space-${group.index}-${groupIdx}`} className="w-1" />
              );
            }

            return (
              <div
                key={`word-${groupIdx}`}
                className="inline-flex flex-wrap items-baseline justify-center gap-1"
              >
                {group.items.map(({ index, char }) => {
                  if (!blankSet.has(index)) {
                    return (
                      <span
                        key={index}
                        className="inline-flex h-10 min-w-[14px] items-center justify-center font-mono text-xl font-bold text-slate-800 sm:text-2xl"
                      >
                        {char}
                      </span>
                    );
                  }

                  const blankPos = blankIndices.indexOf(index);
                  return (
                    <input
                      key={index}
                      ref={(el) => {
                        if (el) {
                          inputRefs.current[index] = el;
                        } else {
                          delete inputRefs.current[index];
                        }
                      }}
                      type="text"
                      maxLength={1}
                      value={inputs[index] || ''}
                      disabled={isFailed}
                      onFocus={() => {
                        lastFocusedBlankIdxRef.current = index;
                      }}
                      onChange={(e) =>
                        handleInputChange(index, blankPos, e.target.value)
                      }
                      onKeyDown={(e) => handleInputKeyDown(e, index, blankPos)}
                      onPaste={(e) => handlePaste(e, blankPos)}
                      aria-label={t.inputAria(blankPos + 1, blankIndices.length)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={`h-10 w-8 border-b-2 bg-transparent text-center font-mono text-xl font-bold transition-colors focus:outline-none sm:w-9 sm:text-2xl ${
                        isFailed
                          ? wrongIndexSet.has(index)
                            ? 'border-rose-500 text-rose-700'
                            : 'border-emerald-500 text-emerald-700'
                          : 'border-blue-500 text-blue-700 focus:border-blue-700'
                      }`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {isFailed && (
          <div
            role="alert"
            className="space-y-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-900"
          >
            <div className="flex items-center justify-center gap-1.5 font-semibold text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t.wrongAnswerTitle}</span>
            </div>
            <p className="text-sm text-rose-800">
              {t.correctAnswerLabel}{' '}
              <strong className="rounded bg-white px-2 py-0.5 font-mono text-base font-bold text-slate-900 ring-1 ring-rose-200">
                {card.word}
              </strong>
            </p>
            <p className="text-xs text-rose-700">{t.requeueHint}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {!isFailed ? (
            <>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onBackToCard}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t.backToCardBtn}
              </button>

              <button
                type="submit"
                disabled={!allFilled}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {t.checkBtn}
              </button>
            </>
          ) : (
            <button
              ref={continueBtnRef}
              type="button"
              onClick={() => onWrongRequeue?.()}
              className="mx-auto inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              <span>{t.continueNextBtn}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <kbd className="rounded bg-rose-500/80 px-1.5 py-0.5 font-mono text-xs text-rose-50">
                Enter
              </kbd>
            </button>
          )}
        </div>

        {speechAvailable && (
          <p className="text-center text-xs text-slate-400">
            {controlsT.shortcutsLabel}{' '}
            <kbd className="font-mono text-slate-600">Alt + P</kbd>{' '}
            {controlsT.pronounceLabel}
          </p>
        )}
      </form>
    </section>
  );
}

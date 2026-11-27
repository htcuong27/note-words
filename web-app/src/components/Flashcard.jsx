import { useEffect, useState } from 'react';
import { ExternalLink, RotateCw, Sparkles, Volume2 } from 'lucide-react';
import PhoneticBadge from './PhoneticBadge';
import { getTranslations } from '../utils/i18n';
import { isSpeechSupported, speakWord, stopSpeaking } from '../utils/speech';
import { escapeRegExp } from '../utils/text';

/**
 * Highlight occurrences of `word` inside `context` (case-insensitive).
 */
export function HighlightedContext({ context, word, uiLang = 'vi' }) {
  const t = getTranslations(uiLang).flashcard;

  if (!context) {
    return <span className="italic text-slate-400">{t.noContext}</span>;
  }

  const trimmedWord = String(word || '').trim();
  if (!trimmedWord) {
    return <span>{context}</span>;
  }

  const regex = new RegExp(`(${escapeRegExp(trimmedWord)})`, 'gi');
  const parts = String(context).split(regex);

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === trimmedWord.toLowerCase() ? (
          <mark
            key={idx}
            className="rounded bg-blue-100 px-1 py-0.5 font-semibold text-blue-950"
          >
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  );
}

export default function Flashcard({
  card,
  isFlipped,
  onFlip,
  lang = 'English',
  uiLang = 'vi',
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      setIsSpeaking(false);
      stopSpeaking();
    };
  }, [card?.id]);

  if (!card) return null;

  const t = getTranslations(uiLang).flashcard;
  const speechAvailable = isSpeechSupported();

  const handleSpeak = (e) => {
    e.stopPropagation();
    e.currentTarget?.blur();
    speakWord(card.word, lang, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const safeUrl =
    card.sourceUrl && /^https?:\/\//i.test(card.sourceUrl)
      ? card.sourceUrl
      : '';

  return (
    <div className="flashcard-scene w-full">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={isFlipped}
        aria-label={isFlipped ? t.flipFrontAria : t.flipBackAria}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          if (e.detail > 0) {
            e.currentTarget.blur();
          }
          onFlip();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isFlipped) {
            e.preventDefault();
            onFlip();
          }
        }}
        className={`flashcard-inner min-h-[300px] w-full cursor-pointer select-none rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 sm:min-h-[340px] ${
          isFlipped ? 'is-flipped' : ''
        }`}
      >
        {/* Front Face */}
        <section
          aria-hidden={isFlipped}
          className={`flashcard-face absolute inset-0 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:border-blue-200 hover:shadow-md sm:p-8 ${
            isFlipped ? 'pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/70">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t.frontBadge}
            </span>
            <span>
              Rep: {card.repetition ?? 0} · EF: {card.easeFactor ?? 2.5}
            </span>
          </div>

          <div className="my-auto py-6 text-center">
            <div className="inline-flex items-center justify-center gap-2.5">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {card.word}
              </h2>
              {speechAvailable && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSpeak}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation();
                  }}
                  aria-label={t.pronounceAria(card.word)}
                  title={t.pronounceTitle}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isSpeaking
                      ? 'border-blue-500 bg-blue-600 text-white shadow-xs'
                      : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                  }`}
                >
                  <Volume2 className="h-4.5 w-4.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="mt-2 min-h-[24px]">
              <PhoneticBadge
                word={card.word}
                phonetic={card.phonetic}
                lang={lang}
                uiLang={uiLang}
                size="lg"
              />
            </div>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              “<HighlightedContext context={card.context} word={card.word} uiLang={uiLang} />”
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
            <RotateCw className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
            <span>
              {t.clickOrSpacePrefix}{' '}
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                Space
              </kbd>{' '}
              {t.clickOrSpaceSuffix}
            </span>
          </div>
        </section>

        {/* Back Face */}
        <section
          aria-hidden={!isFlipped}
          className={`flashcard-face flashcard-face-back absolute inset-0 flex flex-col justify-between rounded-2xl border border-blue-200 bg-gradient-to-b from-white to-blue-50/50 p-6 shadow-sm sm:p-8 ${
            !isFlipped ? 'pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 font-semibold text-white">
              {t.backBadge}
            </span>
            <span>
              Interval: {card.interval ?? 0}d · Next:{' '}
              {card.nextReviewDate || t.today}
            </span>
          </div>

          <div className="my-auto py-4 text-center">
            <div className="inline-flex items-center justify-center gap-1.5">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                {card.word}
              </p>
              {speechAvailable && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSpeak}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation();
                  }}
                  aria-label={t.pronounceAria(card.word)}
                  title={t.pronounceTitle}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isSpeaking
                      ? 'border-blue-500 bg-blue-600 text-white shadow-xs'
                      : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="mt-1">
              <PhoneticBadge
                word={card.word}
                phonetic={card.phonetic}
                lang={lang}
                uiLang={uiLang}
                size="sm"
              />
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {card.meaning || (
                <span className="italic text-slate-400">{t.noMeaning}</span>
              )}
            </h2>

            {card.context && (
              <p className="mx-auto mt-4 max-w-xl rounded-xl bg-white/90 px-4 py-3 text-sm leading-relaxed text-slate-600 ring-1 ring-blue-100 sm:text-base">
                <HighlightedContext
                  context={card.context}
                  word={card.word}
                  uiLang={uiLang}
                />
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-blue-100 pt-3 text-xs text-slate-500">
            {safeUrl ? (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.currentTarget.blur();
                }}
                className="inline-flex max-w-full items-center gap-1.5 truncate font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{safeUrl}</span>
              </a>
            ) : (
              <span className="text-slate-400">{t.noSource}</span>
            )}
            <span className="text-slate-400">{t.spaceFlipBack}</span>
          </div>
        </section>
      </div>
    </div>
  );
}

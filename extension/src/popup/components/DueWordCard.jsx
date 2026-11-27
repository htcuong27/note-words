import { memo } from 'react';
import { Volume2 } from 'lucide-react';
import PopupPhonetic from './PopupPhonetic';

const DueWordCard = memo(function DueWordCard({
  item,
  isRevealed,
  speechAvailable,
  isSpeaking,
  sheetLang,
  t,
  onToggleReveal,
  onSpeak,
}) {
  const rep = Number(item.repetition) || 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggleReveal(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleReveal(item.id);
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
              onClick={(e) => onSpeak(e, item)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label={t.pronounceAria(item.word)}
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isSpeaking
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
  );
});

export default DueWordCard;

import { AlertCircle } from 'lucide-react';
import PhoneticBadge from '../PhoneticBadge';

export default function WrongAnswerFeedback({ card, lang, uiLang, t }) {
  return (
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
      <div className="pt-0.5">
        <PhoneticBadge
          word={card.word}
          phonetic={card.phonetic}
          lang={lang}
          uiLang={uiLang}
          size="sm"
        />
      </div>
      <p className="text-xs text-rose-700">{t.requeueHint}</p>
    </div>
  );
}

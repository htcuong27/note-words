import { REVIEW_OPTIONS, previewNextIntervals } from '../utils/sm2';

const BUTTON_STYLES = {
  again:
    'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 hover:border-rose-300 focus-visible:outline-rose-600',
  hard:
    'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-300 focus-visible:outline-amber-600',
  good:
    'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:border-emerald-300 focus-visible:outline-emerald-600',
  easy:
    'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100 hover:border-sky-300 focus-visible:outline-sky-600',
};

export default function ReviewControls({ card, isFlipped, onFlip, onRate }) {
  if (!isFlipped) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onFlip}
          className="inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <span>Hiển thị đáp án</span>
          <kbd className="rounded bg-indigo-500/80 px-1.5 py-0.5 font-mono text-xs text-indigo-50">
            Space
          </kbd>
        </button>
      </div>
    );
  }

  const previews = previewNextIntervals(card);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {REVIEW_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onRate(opt.quality)}
            className={`group flex flex-col items-center justify-center rounded-xl border px-3 py-3 transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 ${BUTTON_STYLES[opt.key]}`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold">{opt.label}</span>
              <kbd className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold opacity-80">
                {opt.shortcut}
              </kbd>
            </div>
            <span className="mt-1 text-xs opacity-80">
              {opt.viLabel} · {previews[opt.quality]}
            </span>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-slate-400">
        Phím tắt: <kbd className="font-mono text-slate-600">1</kbd> Again ·{' '}
        <kbd className="font-mono text-slate-600">2</kbd> Hard ·{' '}
        <kbd className="font-mono text-slate-600">3</kbd> Good ·{' '}
        <kbd className="font-mono text-slate-600">4</kbd> Easy
      </p>
    </div>
  );
}

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

export function ReviewNotices({ requeuedWord, syncError, t }) {
  return (
    <>
      {requeuedWord && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-blue-900">
          <RotateCcw
            className="h-4 w-4 shrink-0 text-blue-600"
            aria-hidden="true"
          />
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
    </>
  );
}

export function ReviewNoApiState({ t, onOpenSettings }) {
  return (
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
  );
}

export function ReviewLoadingState({ t }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
      <Loader2
        className="h-7 w-7 animate-spin text-blue-600"
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-medium">{t.loadingCards}</p>
    </div>
  );
}

export function ReviewErrorState({ error, t, onRetry }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"
    >
      <AlertCircle
        className="mx-auto h-8 w-8 text-rose-500"
        aria-hidden="true"
      />
      <p className="mt-2 text-sm font-semibold text-rose-900">{error}</p>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {t.retry}
      </button>
    </div>
  );
}

export function ReviewDoneState({
  totalInitial,
  dueOnly,
  t,
  onReviewAll,
  onCheckAgain,
}) {
  return (
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
            onClick={onReviewAll}
            className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
          >
            {t.reviewAllCta}
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCheckAgain}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t.checkAgain}
        </button>
      </div>
    </div>
  );
}

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react';
import { formatCacheTime } from '../i18n';
import VirtualDueWordList from './VirtualDueWordList';

export default function DueWordsView({
  loaded,
  isConfigured,
  dueWords,
  loadingWords,
  wordsError,
  lastUpdatedAt,
  showMeanings,
  revealedIds,
  speechAvailable,
  speakingId,
  sheetLang,
  t,
  onToggleShowMeanings,
  onRefresh,
  onOpenSettings,
  onToggleReveal,
  onSpeak,
  onOpenWebApp,
}) {
  return (
    <div className="space-y-3.5">
      {/* Section Title + Due Count Badge + Quick Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900">
                {t.wordsHeading}
              </h2>
              <span
                aria-label={t.dueCountAria(dueWords.length)}
                className={`nw-count-badge inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                  dueWords.length > 0
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {dueWords.length}
              </span>
            </div>
            {lastUpdatedAt && (
              <p className="text-[10px] text-slate-400">
                {formatCacheTime(lastUpdatedAt, t)}
              </p>
            )}
          </div>
        </div>

        {isConfigured && (
          <div className="flex items-center gap-1">
            {dueWords.length > 0 && (
              <button
                type="button"
                onClick={onToggleShowMeanings}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {showMeanings ? (
                  <EyeOff
                    className="h-3.5 w-3.5 text-blue-600"
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    className="h-3.5 w-3.5 text-blue-600"
                    aria-hidden="true"
                  />
                )}
                <span>{showMeanings ? t.hideMeaning : t.showMeaning}</span>
              </button>
            )}

            <button
              type="button"
              disabled={loadingWords}
              onClick={onRefresh}
              aria-label={t.refreshAria}
              title={t.refreshAria}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingWords ? 'animate-spin text-blue-600' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </div>

      {/* Body States */}
      {!loaded ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
          <Loader2
            className="h-6 w-6 animate-spin text-blue-600"
            aria-hidden="true"
          />
        </div>
      ) : !isConfigured ? (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/80 to-white p-5 text-center shadow-2xs">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="mt-3 text-sm font-bold text-slate-900">
            {t.unconfiguredTitle}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t.unconfiguredDesc}
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.goToSettings}</span>
          </button>
        </div>
      ) : loadingWords && dueWords.length === 0 ? (
        <div className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
          <Loader2
            className="h-6 w-6 animate-spin text-blue-600"
            aria-hidden="true"
          />
          <p className="mt-2.5 text-xs font-medium">{t.loadingWords}</p>
        </div>
      ) : wordsError && dueWords.length === 0 ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center"
        >
          <AlertCircle
            className="mx-auto h-6 w-6 text-rose-600"
            aria-hidden="true"
          />
          <p className="mt-2 text-xs font-medium text-rose-900">{wordsError}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span>{t.retry}</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-3 w-3" aria-hidden="true" />
              <span>{t.settingsTitle}</span>
            </button>
          </div>
        </div>
      ) : dueWords.length === 0 ? (
        <div className="rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-2xs">
          <CheckCircle2
            className="mx-auto h-9 w-9 text-blue-600"
            aria-hidden="true"
          />
          <h3 className="mt-2.5 text-sm font-bold text-slate-900">
            {t.allCaughtUpTitle}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {t.allCaughtUpDesc}
          </p>
        </div>
      ) : (
        <VirtualDueWordList
          words={dueWords}
          showMeanings={showMeanings}
          revealedIds={revealedIds}
          speechAvailable={speechAvailable}
          speakingId={speakingId}
          sheetLang={sheetLang}
          t={t}
          onToggleReveal={onToggleReveal}
          onSpeak={onSpeak}
        />
      )}

      {/* Launch Web App CTA */}
      <button
        type="button"
        onClick={onOpenWebApp}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span>
          {dueWords.length > 0
            ? t.openWebAppWithCount(dueWords.length)
            : t.openWebApp}
        </span>
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

import { RefreshCw } from 'lucide-react';
import { formatCacheAge } from '../../utils/i18n';

export default function ReviewToolbar({
  t,
  currentLang,
  uiLang,
  dueOnly,
  lastSyncedAt,
  loading,
  apiUrl,
  onChangeDueOnly,
  onReload,
}) {
  return (
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
            onClick={() => onChangeDueOnly(true)}
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
            onClick={() => onChangeDueOnly(false)}
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
          onClick={onReload}
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
  );
}

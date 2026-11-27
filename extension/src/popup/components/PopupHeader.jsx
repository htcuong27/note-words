import { Settings } from 'lucide-react';

export default function PopupHeader({
  view,
  uiLang,
  t,
  onChangeUiLang,
  onToggleSettings,
}) {
  return (
    <header className="border-b border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/icons/icon48.png"
            alt="NoteWords"
            className="h-8 w-8 shrink-0 rounded-xl shadow-xs ring-1 ring-white/30"
          />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-white">
              NoteWords
            </h1>
            <p className="truncate text-[11px] text-blue-100">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div
            role="group"
            aria-label={t.langGroupAria}
            className="inline-flex rounded-lg bg-blue-800/60 p-0.5 ring-1 ring-white/15"
          >
            <button
              type="button"
              onClick={() => onChangeUiLang('vi')}
              aria-pressed={uiLang === 'vi'}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                uiLang === 'vi'
                  ? 'nw-active-pill bg-white text-blue-700 shadow-2xs'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => onChangeUiLang('en')}
              aria-pressed={uiLang === 'en'}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                uiLang === 'en'
                  ? 'nw-active-pill bg-white text-blue-700 shadow-2xs'
                  : 'text-blue-100 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleSettings}
            aria-label={
              view === 'settings' ? t.backToWords : t.openSettingsAria
            }
            title={view === 'settings' ? t.backToWords : t.openSettingsAria}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-white ${
              view === 'settings'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'bg-blue-800/50 text-blue-50 ring-1 ring-white/15 hover:bg-blue-800/80'
            }`}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

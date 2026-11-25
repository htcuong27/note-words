import { BookOpen, Globe, Layers, Settings } from 'lucide-react';
import { getTranslations } from '../utils/i18n';

export default function Navbar({
  activePage,
  onNavigate,
  uiLang,
  onChangeUiLang,
}) {
  const t = getTranslations(uiLang).nav;

  const navItems = [
    { id: 'review', label: t.review, icon: Layers },
    { id: 'list', label: t.list, icon: BookOpen },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('review')}
          className="flex items-center gap-2.5 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-extrabold text-white shadow-xs">
            NW
          </span>
          <div>
            <span className="block text-base font-bold tracking-tight text-slate-900">
              NoteWords
            </span>
            <span className="block text-xs text-slate-500">{t.brandSub}</span>
          </div>
        </button>

        <nav
          aria-label={t.mainNavAria}
          className="flex flex-wrap items-center gap-1.5 sm:gap-2.5"
        >
          <ul className="flex items-center gap-1 sm:gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isCurrent = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => onNavigate(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      isCurrent
                        ? 'bg-blue-50 font-semibold text-blue-700 ring-1 ring-inset ring-blue-200'
                        : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* VI / EN Display Language Switcher */}
          <div
            role="group"
            aria-label={t.langGroupAria}
            className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50/70 p-0.5"
          >
            <button
              type="button"
              onClick={() => onChangeUiLang('vi')}
              aria-pressed={uiLang === 'vi'}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                uiLang === 'vi'
                  ? 'nw-lang-active bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-700 hover:bg-blue-100/70'
              }`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => onChangeUiLang('en')}
              aria-pressed={uiLang === 'en'}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                uiLang === 'en'
                  ? 'nw-lang-active bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-700 hover:bg-blue-100/70'
              }`}
            >
              EN
            </button>
          </div>

         
        </nav>
      </div>
    </header>
  );
}

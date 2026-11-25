import { BookOpen, Layers, Settings, Globe } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'review', label: 'Ôn tập', icon: Layers },
  { id: 'list', label: 'Danh sách từ', icon: BookOpen },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

export default function Navbar({ activePage, onNavigate, currentLang }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('review')}
          className="flex items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">
            NW
          </span>
          <div>
            <span className="block text-base font-bold tracking-tight text-slate-900">
              NoteWords
            </span>
            <span className="block text-xs text-slate-500">
              SRS Flashcards
            </span>
          </div>
        </button>

        <nav aria-label="Điều hướng chính" className="flex items-center gap-1 sm:gap-2">
          <ul className="flex items-center gap-1 sm:gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isCurrent = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => onNavigate(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                      isCurrent
                        ? 'bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200'
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

          <span
            className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex"
            title="Ngôn ngữ đang học"
          >
            <Globe className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
            {currentLang}
          </span>
        </nav>
      </div>
    </header>
  );
}

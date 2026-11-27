import { Suspense, lazy, useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import ReviewPage from './pages/ReviewPage';

const VocabularyListPage = lazy(() => import('./pages/VocabularyListPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
import {
  getApiUrl,
  getCurrentLang,
  getUiLang,
  setApiUrl,
  setCurrentLang,
  setUiLang,
} from './utils/api';
import { getTranslations } from './utils/i18n';

export default function App() {
  const [activePage, setActivePage] = useState('review');
  const [apiUrl, setApiUrlState] = useState(() => getApiUrl());
  const [currentLang, setCurrentLangState] = useState(() => getCurrentLang());
  const [uiLang, setUiLangState] = useState(() => getUiLang());

  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  const handleChangeUiLang = (nextLang) => {
    const saved = setUiLang(nextLang);
    setUiLangState(saved);
  };

  const handleSaveSettings = ({ url, lang, uiLanguage }) => {
    const savedUrl = setApiUrl(url);
    const savedLang = setCurrentLang(lang);
    setApiUrlState(savedUrl);
    setCurrentLangState(savedLang);
    if (uiLanguage) {
      handleChangeUiLang(uiLanguage);
    }
  };

  const t = getTranslations(uiLang);

  return (
    <div data-ui-lang={uiLang} className="min-h-dvh bg-slate-50 text-slate-900">
      <Navbar
        activePage={activePage}
        onNavigate={setActivePage}
        uiLang={uiLang}
        onChangeUiLang={handleChangeUiLang}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {!apiUrl && activePage !== 'settings' && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-950"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
              <span>
                {t.banner.missingUrlPrefix}
                <strong>GAS_WEB_APP_URL</strong>
                {t.banner.missingUrlSuffix}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('settings')}
              className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {t.banner.configureNow}
            </button>
          </div>
        )}

        {activePage === 'review' && (
          <ReviewPage
            apiUrl={apiUrl}
            currentLang={currentLang}
            uiLang={uiLang}
            onOpenSettings={() => setActivePage('settings')}
          />
        )}

        <Suspense
          fallback={
            <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Loader2
                className="h-7 w-7 animate-spin text-blue-600"
                aria-hidden="true"
              />
            </div>
          }
        >
          {activePage === 'list' && (
            <VocabularyListPage
              apiUrl={apiUrl}
              currentLang={currentLang}
              uiLang={uiLang}
              onOpenSettings={() => setActivePage('settings')}
            />
          )}

          {activePage === 'settings' && (
            <SettingsPage
              apiUrl={apiUrl}
              currentLang={currentLang}
              uiLang={uiLang}
              onChangeUiLang={handleChangeUiLang}
              onSaveSettings={handleSaveSettings}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}

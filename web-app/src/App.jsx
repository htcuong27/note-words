import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Navbar from './components/Navbar';
import ReviewPage from './pages/ReviewPage';
import VocabularyListPage from './pages/VocabularyListPage';
import SettingsPage from './pages/SettingsPage';
import {
  getApiUrl,
  getCurrentLang,
  setApiUrl,
  setCurrentLang,
} from './utils/api';

export default function App() {
  const [activePage, setActivePage] = useState('review');
  const [apiUrl, setApiUrlState] = useState(() => getApiUrl());
  const [currentLang, setCurrentLangState] = useState(() => getCurrentLang());

  const handleSaveSettings = ({ url, lang }) => {
    const savedUrl = setApiUrl(url);
    const savedLang = setCurrentLang(lang);
    setApiUrlState(savedUrl);
    setCurrentLangState(savedLang);
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <Navbar
        activePage={activePage}
        onNavigate={setActivePage}
        currentLang={currentLang}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {!apiUrl && activePage !== 'settings' && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <span>
                Chưa có <strong>GAS_WEB_APP_URL</strong>. Hãy nhập đường dẫn Web App Google Apps Script để đồng bộ từ vựng.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('settings')}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Cấu hình ngay
            </button>
          </div>
        )}

        {activePage === 'review' && (
          <ReviewPage
            apiUrl={apiUrl}
            currentLang={currentLang}
            onOpenSettings={() => setActivePage('settings')}
          />
        )}

        {activePage === 'list' && (
          <VocabularyListPage
            apiUrl={apiUrl}
            currentLang={currentLang}
            onOpenSettings={() => setActivePage('settings')}
          />
        )}

        {activePage === 'settings' && (
          <SettingsPage
            apiUrl={apiUrl}
            currentLang={currentLang}
            onSaveSettings={handleSaveSettings}
          />
        )}
      </main>
    </div>
  );
}

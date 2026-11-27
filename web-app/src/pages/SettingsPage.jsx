import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  PlugZap,
  Save,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, getWords } from '../utils/api';
import { UI_LANGUAGES, getTranslations } from '../utils/i18n';

export default function SettingsPage({
  apiUrl,
  currentLang,
  uiLang = 'vi',
  onChangeUiLang,
  onSaveSettings,
}) {
  const [urlInput, setUrlInput] = useState(apiUrl || '');
  const [langInput, setLangInput] = useState(currentLang || 'English');
  const [urlInvalid, setUrlInvalid] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const urlInputRef = useRef(null);
  const savedNoticeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (savedNoticeTimerRef.current !== null) {
        clearTimeout(savedNoticeTimerRef.current);
      }
    };
  }, []);

  const t = getTranslations(uiLang).settings;

  const syncUrlAria = (el) => {
    if (!el) return;
    setUrlInvalid(el.matches(':user-invalid'));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      urlInputRef.current?.focus();
      setUrlInvalid(true);
      return;
    }

    onSaveSettings({ url: trimmedUrl, lang: langInput, uiLanguage: uiLang });
    setSavedNotice(true);
    if (savedNoticeTimerRef.current !== null) {
      clearTimeout(savedNoticeTimerRef.current);
    }
    savedNoticeTimerRef.current = setTimeout(() => {
      savedNoticeTimerRef.current = null;
      setSavedNotice(false);
    }, 3500);
  };

  const handleTestConnection = async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      setTestResult({
        ok: false,
        message: t.missingUrlBeforeTest,
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const dueWords = await getWords({
        url: trimmedUrl,
        lang: langInput,
        dueOnly: true,
        forceRefresh: true,
      });
      setTestResult({
        ok: true,
        message: t.testOk(langInput, dueWords.length),
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.message || t.testFail,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {t.title}
        </h1>
        <p className="text-sm text-slate-500">{t.subtitle}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        {/* Display Language (VI / EN) */}
        <div className="space-y-1.5">
          <label
            htmlFor="ui-lang-select"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"
          >
            <Globe className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>{t.uiLangLabel}</span>
          </label>
          <p id="ui-lang-hint" className="text-xs text-slate-500">
            {t.uiLangHint}
          </p>
          <select
            id="ui-lang-select"
            value={uiLang}
            onChange={(e) => onChangeUiLang?.(e.target.value)}
            aria-describedby="ui-lang-hint"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            {UI_LANGUAGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* GAS Web App URL Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="gas-url-input"
            className="block text-sm font-semibold text-slate-800"
          >
            {t.gasUrlLabel}
          </label>
          <p id="gas-url-hint" className="text-xs text-slate-500">
            {t.formatPrefix}{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">
              https://script.google.com/macros/s/.../exec
            </code>
          </p>
          <input
            ref={urlInputRef}
            id="gas-url-input"
            name="gasUrl"
            type="url"
            required
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setSavedNotice(false);
              if (urlInvalid) syncUrlAria(e.target);
            }}
            onBlur={(e) => syncUrlAria(e.target)}
            onInvalid={() => setUrlInvalid(true)}
            aria-invalid={urlInvalid ? 'true' : 'false'}
            aria-describedby={
              urlInvalid ? 'gas-url-hint gas-url-error' : 'gas-url-hint'
            }
            placeholder="https://script.google.com/macros/s/.../exec"
            className="validated-input w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          />
          <div
            id="gas-url-error"
            className="field-error-msg items-center gap-1.5 text-xs font-medium text-rose-600"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t.gasUrlErr}</span>
          </div>
        </div>

        {/* Vocabulary Sheet Tab Selector */}
        <div className="space-y-1.5">
          <label
            htmlFor="lang-select"
            className="block text-sm font-semibold text-slate-800"
          >
            {t.sheetLangLabel}
          </label>
          <p id="lang-hint" className="text-xs text-slate-500">
            {t.sheetLangHint}
          </p>
          <select
            id="lang-select"
            value={langInput}
            onChange={(e) => {
              setLangInput(e.target.value);
              setSavedNotice(false);
            }}
            aria-describedby="lang-hint"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {uiLang === 'en' ? lang.labelEn : lang.labelVi}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {t.saveBtn}
          </button>

          <button
            type="button"
            disabled={testing}
            onClick={handleTestConnection}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
            ) : (
              <PlugZap className="h-4 w-4 text-blue-600" aria-hidden="true" />
            )}
            {t.testBtn}
          </button>
        </div>

        {/* Feedback */}
        {savedNotice && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-blue-800"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <span>{t.savedNotice}</span>
          </div>
        )}

        {testResult && (
          <div
            role={testResult.ok ? 'status' : 'alert'}
            className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              testResult.ok
                ? 'border-blue-200 bg-blue-50 text-blue-900'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                aria-hidden="true"
              />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </form>
    </div>
  );
}

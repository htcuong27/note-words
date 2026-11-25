import { useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, PlugZap, Save } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getWords } from '../utils/api';

export default function SettingsPage({ apiUrl, currentLang, onSaveSettings }) {
  const [urlInput, setUrlInput] = useState(apiUrl || '');
  const [langInput, setLangInput] = useState(currentLang || 'English');
  const [urlInvalid, setUrlInvalid] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: boolean, message: string }
  const urlInputRef = useRef(null);

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

    onSaveSettings({ url: trimmedUrl, lang: langInput });
    setSavedNotice('Đã lưu cấu hình vào localStorage.');
    setTimeout(() => setSavedNotice(''), 3500);
  };

  const handleTestConnection = async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      setTestResult({
        ok: false,
        message: 'Vui lòng nhập Web App URL trước khi kiểm tra kết nối.',
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
      });
      setTestResult({
        ok: true,
        message: `Kết nối thành công! Tab "${langInput}" hiện có ${dueWords.length} từ đến hạn ôn hôm nay.`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.message || 'Không thể kết nối đến Web App URL.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Cài đặt
        </h1>
        <p className="text-sm text-slate-500">
          Cấu hình đường dẫn Google Apps Script Web App và ngôn ngữ học tập.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        {/* GAS Web App URL Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="gas-url-input"
            className="block text-sm font-semibold text-slate-800"
          >
            Google Apps Script Web App URL (GAS_WEB_APP_URL)
          </label>
          {/* Format hint placed above input so autocomplete popovers do not cover it */}
          <p id="gas-url-hint" className="text-xs text-slate-500">
            Định dạng: <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">https://script.google.com/macros/s/.../exec</code>
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
              setSavedNotice('');
              if (urlInvalid) syncUrlAria(e.target);
            }}
            onBlur={(e) => syncUrlAria(e.target)}
            onInvalid={() => setUrlInvalid(true)}
            aria-invalid={urlInvalid ? 'true' : 'false'}
            aria-describedby={urlInvalid ? 'gas-url-hint gas-url-error' : 'gas-url-hint'}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="validated-input w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          />
          <div
            id="gas-url-error"
            className="field-error-msg items-center gap-1.5 text-xs font-medium text-rose-600"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Vui lòng nhập URL hợp lệ bắt đầu bằng https://</span>
          </div>
        </div>

        {/* Language Selector */}
        <div className="space-y-1.5">
          <label
            htmlFor="lang-select"
            className="block text-sm font-semibold text-slate-800"
          >
            Ngôn ngữ hiện tại (Sheet Tab)
          </label>
          <p id="lang-hint" className="text-xs text-slate-500">
            Phase 1 tập trung vào tab <strong>English</strong>; kiến trúc sẵn sàng mở rộng thêm ngôn ngữ khác.
          </p>
          <select
            id="lang-select"
            value={langInput}
            onChange={(e) => {
              setLangInput(e.target.value);
              setSavedNotice('');
            }}
            aria-describedby="lang-hint"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Lưu cài đặt
          </button>

          <button
            type="button"
            disabled={testing}
            onClick={handleTestConnection}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlugZap className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            )}
            Kiểm tra kết nối
          </button>
        </div>

        {/* Feedback */}
        {savedNotice && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{savedNotice}</span>
          </div>
        )}

        {testResult && (
          <div
            role={testResult.ok ? 'status' : 'alert'}
            className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              testResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
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

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Save,
} from 'lucide-react';

const DEFAULT_WEB_APP_URL = 'http://localhost:5173';
const DEFAULT_LANG = 'English';

async function loadSyncSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    return await chrome.storage.sync.get([
      'GAS_WEB_APP_URL',
      'WEB_APP_URL',
      'NOTE_WORD_LANG',
    ]);
  }
  return {
    GAS_WEB_APP_URL: localStorage.getItem('GAS_WEB_APP_URL') || '',
    WEB_APP_URL: localStorage.getItem('WEB_APP_URL') || '',
    NOTE_WORD_LANG: DEFAULT_LANG,
  };
}

async function saveSyncSettings(values) {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    await chrome.storage.sync.set(values);
  } else {
    localStorage.setItem('GAS_WEB_APP_URL', values.GAS_WEB_APP_URL);
    localStorage.setItem('WEB_APP_URL', values.WEB_APP_URL);
    localStorage.setItem('NOTE_WORD_LANG', values.NOTE_WORD_LANG);
  }
}

export default function Popup() {
  const [gasUrl, setGasUrl] = useState('');
  const [webAppUrl, setWebAppUrl] = useState('');
  const [lang] = useState(DEFAULT_LANG);
  const [gasInvalid, setGasInvalid] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await loadSyncSettings();
        if (!active) return;
        setGasUrl((stored.GAS_WEB_APP_URL || '').trim());
        setWebAppUrl((stored.WEB_APP_URL || '').trim());
      } catch (err) {
        if (active) setErrorMsg('Không thể đọc cài đặt: ' + err.message);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    const trimmedGas = gasUrl.trim();
    const trimmedWeb = webAppUrl.trim();

    if (!trimmedGas) {
      setGasInvalid(true);
      setErrorMsg('Vui lòng nhập GAS_WEB_APP_URL.');
      return;
    }

    try {
      await saveSyncSettings({
        GAS_WEB_APP_URL: trimmedGas,
        WEB_APP_URL: trimmedWeb,
        NOTE_WORD_LANG: lang,
      });
      setGasUrl(trimmedGas);
      setWebAppUrl(trimmedWeb);
      setStatusMsg('Đã lưu cài đặt thành công.');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Lỗi lưu cài đặt: ' + err.message);
    }
  };

  const handleOpenWebApp = async () => {
    const targetUrl = webAppUrl.trim() || DEFAULT_WEB_APP_URL;
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      await chrome.tabs.create({ url: targetUrl });
    } else {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const isConfigured = Boolean(gasUrl.trim());

  return (
    <div className="w-[360px] bg-slate-50 p-4 text-slate-900">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
            NW
          </span>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900">
              NoteWords
            </h1>
            <p className="text-[11px] text-slate-500">
              Quét chọn từ tiếng Anh để lưu nhanh
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isConfigured
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConfigured ? 'bg-emerald-600' : 'bg-amber-500'
            }`}
          />
          {isConfigured ? 'Sẵn sàng' : 'Chưa cấu hình'}
        </span>
      </header>

      {/* Settings Form */}
      <form
        onSubmit={handleSave}
        className="space-y-3.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
      >
        {/* GAS_WEB_APP_URL */}
        <div className="space-y-1">
          <label
            htmlFor="gas-url"
            className="block text-xs font-semibold text-slate-800"
          >
            GAS_WEB_APP_URL
          </label>
          <p id="gas-url-hint" className="text-[11px] text-slate-500">
            URL Web App đã deploy từ Google Apps Script
          </p>
          <input
            id="gas-url"
            type="url"
            required
            disabled={!loaded}
            value={gasUrl}
            onChange={(e) => {
              setGasUrl(e.target.value);
              setStatusMsg('');
              if (gasInvalid) setGasInvalid(e.target.matches(':user-invalid'));
            }}
            onBlur={(e) => setGasInvalid(e.target.matches(':user-invalid'))}
            onInvalid={() => setGasInvalid(true)}
            aria-invalid={gasInvalid ? 'true' : 'false'}
            aria-describedby={gasInvalid ? 'gas-url-hint gas-url-err' : 'gas-url-hint'}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="validated-input w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:opacity-60"
          />
          <div
            id="gas-url-err"
            className="field-error-msg items-center gap-1 text-[11px] font-medium text-rose-600"
          >
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Nhập URL hợp lệ bắt đầu bằng https://</span>
          </div>
        </div>

        {/* WEB_APP_URL */}
        <div className="space-y-1">
          <label
            htmlFor="web-app-url"
            className="block text-xs font-semibold text-slate-800"
          >
            WEB_APP_URL
          </label>
          <p id="web-url-hint" className="text-[11px] text-slate-500">
            Mặc định: <code className="rounded bg-slate-100 px-1 text-slate-700">{DEFAULT_WEB_APP_URL}</code>
          </p>
          <input
            id="web-app-url"
            type="url"
            disabled={!loaded}
            value={webAppUrl}
            onChange={(e) => {
              setWebAppUrl(e.target.value);
              setStatusMsg('');
            }}
            aria-describedby="web-url-hint"
            placeholder={DEFAULT_WEB_APP_URL}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Language Selector (Locked to English for Phase 1) */}
        <div className="space-y-1">
          <label
            htmlFor="lang-select"
            className="flex items-center gap-1 text-xs font-semibold text-slate-800"
          >
            <Globe className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
            <span>Ngôn ngữ lưu từ</span>
          </label>
          <select
            id="lang-select"
            value={lang}
            disabled
            aria-label="Ngôn ngữ lưu từ (Giai đoạn 1 khóa ở English)"
            className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-600"
          >
            <option value="English">English (Giai đoạn 1)</option>
          </select>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={!loaded}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          Lưu cài đặt
        </button>

        {statusMsg && (
          <div
            role="status"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-800"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>

      {/* Launch Web App */}
      <button
        type="button"
        onClick={handleOpenWebApp}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Mở trang ôn tập
      </button>
    </div>
  );
}

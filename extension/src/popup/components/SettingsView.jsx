import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Save,
} from 'lucide-react';

export default function SettingsView({
  loaded,
  isConfigured,
  gasUrl,
  gasInvalid,
  uiLang,
  statusMsg,
  errorMsg,
  t,
  onBack,
  onGasUrlChange,
  onGasInvalidChange,
  onChangeUiLang,
  onSubmit,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.backToWords}</span>
        </button>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            isConfigured
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConfigured ? 'bg-blue-600' : 'bg-amber-500'
            }`}
          />
          {isConfigured ? t.statusReady : t.statusMissing}
        </span>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"
      >
        <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700">
          {t.settingsTitle}
        </h2>

        {/* GAS_WEB_APP_URL */}
        <div className="space-y-1">
          <label
            htmlFor="gas-url"
            className="block text-xs font-semibold text-slate-800"
          >
            {t.gasLabel}
          </label>
          <p id="gas-url-hint" className="text-[11px] text-slate-500">
            {t.gasHint}
          </p>
          <input
            id="gas-url"
            type="url"
            required
            disabled={!loaded}
            value={gasUrl}
            onChange={(e) => {
              onGasUrlChange(e.target.value);
              if (gasInvalid) {
                onGasInvalidChange(e.target.matches(':user-invalid'));
              }
            }}
            onBlur={(e) =>
              onGasInvalidChange(e.target.matches(':user-invalid'))
            }
            onInvalid={() => onGasInvalidChange(true)}
            aria-invalid={gasInvalid ? 'true' : 'false'}
            aria-describedby={
              gasInvalid ? 'gas-url-hint gas-url-err' : 'gas-url-hint'
            }
            placeholder="https://script.google.com/macros/s/.../exec"
            className="validated-input w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-60"
          />
          <div
            id="gas-url-err"
            className="field-error-msg items-center gap-1 text-[11px] font-medium text-rose-600"
          >
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{t.gasError}</span>
          </div>
        </div>

        {/* Display Language Selector */}
        <div className="space-y-1">
          <label
            htmlFor="ui-lang-select"
            className="flex items-center gap-1 text-xs font-semibold text-slate-800"
          >
            <Globe className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            <span>{t.uiLangLabel}</span>
          </label>
          <select
            id="ui-lang-select"
            value={uiLang}
            onChange={(e) => onChangeUiLang(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={!loaded}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.saveBtn}</span>
        </button>

        {statusMsg && (
          <div
            role="status"
            className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-medium text-blue-800"
          >
            <CheckCircle2
              className="h-3.5 w-3.5 shrink-0 text-blue-600"
              aria-hidden="true"
            />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-800"
          >
            <AlertCircle
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>
    </div>
  );
}

/**
 * Bridge for bidirectional sync between the NoteWords Web App and Chrome Extension
 * via `window.postMessage` (handled by `extension/src/content/webBridge.js`).
 *
 * Safe no-op when the extension is not installed.
 */

const WEB_SOURCE = 'notewords-web';
const EXT_SOURCE = 'notewords-extension';

function postToExtension(type, payload = {}) {
  if (typeof window === 'undefined' || !window.postMessage) return;
  try {
    window.postMessage(
      {
        source: WEB_SOURCE,
        type,
        ...payload,
      },
      window.location.origin
    );
  } catch {
    // Ignore cross-origin or restricted window errors
  }
}

/**
 * Notify the extension that the Web App UI language changed.
 */
export function notifyExtensionUiLang(uiLang, updatedAt = Date.now()) {
  const normalized = uiLang === 'en' ? 'en' : 'vi';
  postToExtension('SYNC_UI_LANG', {
    uiLang: normalized,
    updatedAt: Number(updatedAt) || Date.now(),
  });
}

/**
 * Ask the extension for its current UI language state on Web App startup.
 */
export function requestExtensionUiLang() {
  postToExtension('REQUEST_UI_LANG');
}

/**
 * Notify the extension that review progress / due words have updated so it can
 * refresh its cached due list and toolbar badge immediately.
 */
export function notifyExtensionReviewUpdated({
  gasUrl,
  sheetLang,
  dueWords = null,
  forceRefresh = false,
} = {}) {
  postToExtension('SYNC_REVIEW_RESULT', {
    payload: {
      gasUrl: String(gasUrl || '').trim(),
      sheetLang: String(sheetLang || '').trim(),
      dueWords: Array.isArray(dueWords) ? dueWords : null,
      forceRefresh: Boolean(forceRefresh),
    },
  });
}

/**
 * Subscribe to UI language sync messages coming from the Chrome Extension.
 * Returns an unsubscribe function.
 */
export function subscribeExtensionUiLang({ onState, onChanged } = {}) {
  if (typeof window === 'undefined') return () => {};

  const handleMessage = (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== EXT_SOURCE) return;

    if (data.type === 'EXT_UI_LANG_STATE' && typeof onState === 'function') {
      onState({
        uiLang: data.uiLang === 'en' ? 'en' : 'vi',
        updatedAt: Number(data.updatedAt) || 0,
        hasStoredValue: Boolean(data.hasStoredValue),
      });
    } else if (
      data.type === 'EXT_UI_LANG_CHANGED' &&
      typeof onChanged === 'function'
    ) {
      onChanged({
        uiLang: data.uiLang === 'en' ? 'en' : 'vi',
        updatedAt: Number(data.updatedAt) || Date.now(),
      });
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}

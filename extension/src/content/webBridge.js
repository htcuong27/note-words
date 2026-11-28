/**
 * Bridge between the NoteWords Web App and the Chrome Extension content script.
 * Only activates on trusted NoteWords Web App origins (Cloudflare Pages + localhost dev).
 */

const WEB_SOURCE = 'notewords-web';
const EXT_SOURCE = 'notewords-extension';

function isAllowedWebAppOrigin() {
  try {
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') {
      return (
        hostname === 'note-word.pages.dev' ||
        hostname.endsWith('.note-word.pages.dev')
      );
    }
    if (protocol === 'http:') {
      return hostname === 'localhost' || hostname === '127.0.0.1';
    }
    return false;
  } catch {
    return false;
  }
}

function postToWeb(type, payload = {}) {
  try {
    window.postMessage(
      {
        source: EXT_SOURCE,
        type,
        ...payload,
      },
      window.location.origin
    );
  } catch {
    // Ignore restricted window errors
  }
}

export function createWebBridge() {
  if (!isAllowedWebAppOrigin()) {
    return {
      notifyUiLangChanged: () => {},
    };
  }

  let lastWebSyncTs = 0;

  async function publishCurrentUiLangState() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;
      const stored = await chrome.storage.sync.get([
        'UI_LANG',
        'UI_LANG_UPDATED_AT',
      ]);
      const hasStoredValue =
        stored.UI_LANG === 'en' || stored.UI_LANG === 'vi';
      const uiLang = stored.UI_LANG === 'en' ? 'en' : 'vi';
      const updatedAt = Number(stored.UI_LANG_UPDATED_AT) || 0;
      postToWeb('EXT_UI_LANG_STATE', {
        uiLang,
        updatedAt,
        hasStoredValue,
      });
    } catch {
      // Ignore storage errors
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== WEB_SOURCE) return;

    if (data.type === 'REQUEST_UI_LANG') {
      publishCurrentUiLangState();
      return;
    }

    if (data.type === 'SYNC_UI_LANG') {
      const nextLang = data.uiLang === 'en' ? 'en' : 'vi';
      const updatedAt = Number(data.updatedAt) || Date.now();
      (async () => {
        try {
          if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;
          const stored = await chrome.storage.sync.get([
            'UI_LANG',
            'UI_LANG_UPDATED_AT',
          ]);
          const currentLang = stored.UI_LANG === 'en' ? 'en' : 'vi';
          const currentTs = Number(stored.UI_LANG_UPDATED_AT) || 0;
          if (stored.UI_LANG && currentLang === nextLang && currentTs >= updatedAt) {
            return;
          }
          lastWebSyncTs = updatedAt;
          await chrome.storage.sync.set({
            UI_LANG: nextLang,
            UI_LANG_UPDATED_AT: updatedAt,
          });
        } catch {
          // Ignore storage errors
        }
      })();
      return;
    }

    if (data.type === 'SYNC_REVIEW_RESULT') {
      (async () => {
        try {
          if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
          await chrome.runtime.sendMessage({
            type: 'SYNC_DUE_WORDS_FROM_WEB',
            payload: data.payload || {},
          });
        } catch {
          // Ignore if service worker is temporarily unavailable
        }
      })();
    }
  });

  // Proactively announce extension UI language in case the Web App mounted before document_idle
  publishCurrentUiLangState();

  return {
    notifyUiLangChanged(uiLang, updatedAt) {
      const ts = Number(updatedAt) || Date.now();
      // Skip echoing back a change that originated from this web tab
      if (ts && ts === lastWebSyncTs) return;
      postToWeb('EXT_UI_LANG_CHANGED', {
        uiLang: uiLang === 'en' ? 'en' : 'vi',
        updatedAt: ts,
      });
    },
  };
}

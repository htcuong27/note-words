/**
 * NoteWords Content Script (Manifest V3)
 *
 * - Listens to text selection (`mouseup`) on web pages.
 * - Renders an isolated Blue Floating Save Button & Toast inside a Shadow DOM root
 *   so host page CSS never conflicts with extension UI.
 * - Supports Vietnamese (`vi`) and English (`en`) UI language from `chrome.storage.sync`.
 */
import { getContentCopy } from './i18n';
import { isContentSpeechSupported, speakSelectedWord } from './speech';
import {
  MAX_WORD_LENGTH,
  cleanSelectedWord,
  extractContext,
  isEditableTarget,
} from './contextExtractor';
import { createShadowUi } from './shadowUi';
import { createWebBridge } from './webBridge';

(function initNoteWordsContentScript() {
  if (window.__NOTEWORDS_CONTENT_LOADED__) return;
  window.__NOTEWORDS_CONTENT_LOADED__ = true;

  let currentPayload = null;
  let isSaving = false;
  let uiLang = 'vi';
  let selectionTimer = null;

  const t = () => getContentCopy(uiLang);
  const webBridge = createWebBridge();

  const ui = createShadowUi({
    getCopy: t,
    isSpeechSupported: isContentSpeechSupported,
    onSpeak: () => {
      if (currentPayload?.word) {
        speakSelectedWord(currentPayload.word);
      }
    },
    onSave: () => {
      handleSaveClick();
    },
  });

  function hideButton() {
    if (selectionTimer !== null) {
      clearTimeout(selectionTimer);
      selectionTimer = null;
    }
    ui.hideToolbar();
    currentPayload = null;
    isSaving = false;
  }

  async function syncUiLang() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
        const stored = await chrome.storage.sync.get(['UI_LANG']);
        uiLang = stored.UI_LANG === 'en' ? 'en' : 'vi';
        ui.updateLabels(isSaving);
      }
    } catch {
      // Ignore storage access errors on restricted pages
    }
  }

  syncUiLang();

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.UI_LANG) {
        uiLang = changes.UI_LANG.newValue === 'en' ? 'en' : 'vi';
        ui.updateLabels(isSaving);
        webBridge.notifyUiLangChanged(
          uiLang,
          changes.UI_LANG_UPDATED_AT?.newValue || Date.now()
        );
      }
    });
  }

  async function handleSaveClick() {
    if (!currentPayload || isSaving) return;

    isSaving = true;
    const payloadToSend = { ...currentPayload };
    const copy = t();

    ui.setSavingState();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_WORD',
        payload: payloadToSend,
      });

      hideButton();

      if (!response) {
        ui.showToast(copy.noResp, 'error');
        return;
      }

      if (response.ok) {
        if (response.duplicate) {
          const matchedWord = String(
            response.data?.word || payloadToSend.word
          ).trim();
          ui.showToast(copy.duplicate(matchedWord), 'warning');
        } else {
          const savedWord = String(
            response.data?.word || payloadToSend.word
          ).trim();
          const phonetic = response.data?.phonetic
            ? ` ${response.data.phonetic}`
            : '';
          const meaning = response.data?.meaning
            ? ` → ${response.data.meaning}`
            : '';
          ui.showToast(copy.saved(savedWord, `${phonetic}${meaning}`), 'success');
        }
      } else if (response.duplicate) {
        ui.showToast(copy.duplicate(payloadToSend.word), 'warning');
      } else if (response.code === 'MISSING_URL') {
        ui.showToast(copy.missingUrl, 'warning');
      } else {
        ui.showToast(response.error || copy.saveFailed, 'error');
      }
    } catch (err) {
      hideButton();
      ui.showToast(copy.connErr(err?.message || 'Unknown'), 'error');
    }
  }

  document.addEventListener(
    'mouseup',
    (event) => {
      if (ui.isHostEvent(event.target)) return;
      if (isEditableTarget(event.target)) {
        hideButton();
        return;
      }

      if (selectionTimer !== null) {
        clearTimeout(selectionTimer);
        selectionTimer = null;
      }

      // Fast path: skip scheduling a timer on ordinary clicks with no text selection
      const preSelection = window.getSelection();
      if (!preSelection || preSelection.isCollapsed || preSelection.rangeCount === 0) {
        if (ui.isVisible() && !isSaving) {
          hideButton();
        }
        return;
      }

      selectionTimer = setTimeout(() => {
        selectionTimer = null;
        if (isSaving) return;
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          hideButton();
          return;
        }

        const word = cleanSelectedWord(selection.toString());
        if (!word || word.length > MAX_WORD_LENGTH || !/[a-zA-Z]/.test(word)) {
          hideButton();
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          hideButton();
          return;
        }

        // Omit `lang` so background.js uses the active `NOTE_WORD_LANG` from chrome.storage.sync
        currentPayload = {
          word,
          context: extractContext(selection, word),
          sourceUrl: window.location.href,
        };

        ui.positionToolbar(rect);
      }, 10);
    },
    { passive: true }
  );

  document.addEventListener(
    'mousedown',
    (event) => {
      if (ui.isHostEvent(event.target)) return;
      if (ui.isVisible() && !isSaving) {
        hideButton();
      }
    },
    { passive: true }
  );

  window.addEventListener(
    'scroll',
    () => {
      if (ui.isVisible() && !isSaving) {
        hideButton();
      }
    },
    { capture: true, passive: true }
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.isVisible() && !isSaving) {
      hideButton();
    }
  });
})();

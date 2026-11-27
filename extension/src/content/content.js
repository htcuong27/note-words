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

(function initNoteWordsContentScript() {
  if (window.__NOTEWORDS_CONTENT_LOADED__) return;
  window.__NOTEWORDS_CONTENT_LOADED__ = true;

  const DEFAULT_LANG = 'English';

  let currentPayload = null;
  let isSaving = false;
  let uiLang = 'vi';

  const t = () => getContentCopy(uiLang);

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

  document.addEventListener('mouseup', (event) => {
    if (ui.isHostEvent(event.target)) return;
    if (isEditableTarget(event.target)) {
      hideButton();
      return;
    }

    setTimeout(() => {
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

      currentPayload = {
        word,
        context: extractContext(selection, word),
        sourceUrl: window.location.href,
        lang: DEFAULT_LANG,
      };

      ui.positionToolbar(rect);
    }, 10);
  });

  document.addEventListener('mousedown', (event) => {
    if (ui.isHostEvent(event.target)) return;
    if (!isSaving) {
      hideButton();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !isSaving) {
      hideButton();
    }
  });
})();

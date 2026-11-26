/**
 * NoteWords Content Script (Manifest V3)
 *
 * - Listens to text selection (`mouseup`) on web pages.
 * - Renders an isolated Blue Floating Save Button & Toast inside a Shadow DOM root
 *   so host page CSS never conflicts with extension UI.
 * - Supports Vietnamese (`vi`) and English (`en`) UI language from `chrome.storage.sync`.
 */

(function initNoteWordsContentScript() {
  if (window.__NOTEWORDS_CONTENT_LOADED__) return;
  window.__NOTEWORDS_CONTENT_LOADED__ = true;

  const HOST_ID = 'notewords-extension-shadow-host';
  const DEFAULT_LANG = 'English';
  const MAX_WORD_LENGTH = 120;
  const MAX_CONTEXT_LENGTH = 360;

  const COPY = {
    vi: {
      saveBtn: '+ Lưu từ',
      saving: 'Đang lưu…',
      speakTitle: 'Phát âm từ',
      connErr: (msg) => `Lỗi kết nối Extension: ${msg}`,
      noResp: 'Không nhận được phản hồi từ background.',
      duplicate: (w) => `Từ "${w}" đã tồn tại trong sổ từ.`,
      saved: (w, m) => `Đã lưu "${w}"${m}`,
      missingUrl:
        'Chưa cấu hình GAS_WEB_APP_URL. Hãy mở cài đặt trong popup NoteWords để nhập link.',
      saveFailed: 'Không thể lưu từ. Vui lòng thử lại.',
      sendErr: (msg) => `Lỗi gửi dữ liệu: ${msg}`,
    },
    en: {
      saveBtn: '+ Save word',
      saving: 'Saving…',
      speakTitle: 'Pronounce word',
      connErr: (msg) => `Extension connection error: ${msg}`,
      noResp: 'No response received from background service.',
      duplicate: (w) => `"${w}" is already in your vocabulary list.`,
      saved: (w, m) => `Saved "${w}"${m}`,
      missingUrl:
        'GAS_WEB_APP_URL is not set. Open NoteWords popup settings to add your link.',
      saveFailed: 'Failed to save word. Please try again.',
      sendErr: (msg) => `Failed to send data: ${msg}`,
    },
  };

  let shadowRoot = null;
  let hostEl = null;
  let toolbarEl = null;
  let speakBtn = null;
  let floatBtn = null;
  let toastEl = null;
  let toastTimer = null;
  let currentPayload = null;
  let isSaving = false;
  let uiLang = 'vi';
  let activeUtterance = null;
  let speakDelayTimer = null;

  function t() {
    return COPY[uiLang] || COPY.vi;
  }

  function isSpeechSupported() {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  function prewarmVoices() {
    if (!isSpeechSupported()) return;
    try {
      window.speechSynthesis.getVoices();
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener(
          'voiceschanged',
          () => {
            try {
              window.speechSynthesis.getVoices();
            } catch {
              // Ignore voice loading errors
            }
          },
          { once: true }
        );
      }
    } catch {
      // Ignore restricted page errors
    }
  }

  prewarmVoices();

  function pickLocalEnglishVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    const localVoices = voices.filter((v) => v.localService === true);
    return (
      localVoices.find(
        (v) =>
          v.lang &&
          v.lang.toLowerCase().startsWith('en') &&
          /samantha|ava|allison|nicky|alex|daniel|aaron|karen/i.test(
            v.name || ''
          )
      ) ||
      localVoices.find(
        (v) => v.lang && v.lang.toLowerCase() === 'en-us'
      ) ||
      localVoices.find(
        (v) => v.lang && v.lang.toLowerCase().startsWith('en')
      ) ||
      voices.find((v) => v.lang && v.lang.toLowerCase() === 'en-us') ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en')) ||
      null
    );
  }

  function speakSelectedWord(text) {
    const cleaned = String(text || '').trim();
    if (!cleaned || !isSpeechSupported()) return;
    try {
      if (speakDelayTimer !== null) {
        clearTimeout(speakDelayTimer);
        speakDelayTimer = null;
      }

      const synth = window.speechSynthesis;
      const wasBusy = synth.speaking || synth.pending;
      if (wasBusy) {
        synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      const enVoice = pickLocalEnglishVoice();
      if (enVoice) utterance.voice = enVoice;

      activeUtterance = utterance;
      utterance.onend = () => {
        if (activeUtterance === utterance) activeUtterance = null;
      };
      utterance.onerror = () => {
        if (activeUtterance === utterance) activeUtterance = null;
      };

      const runSpeak = () => {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
      };

      if (wasBusy) {
        speakDelayTimer = setTimeout(() => {
          speakDelayTimer = null;
          runSpeak();
        }, 60);
      } else {
        runSpeak();
      }
    } catch {
      // Ignore speech synthesis errors on restricted pages
    }
  }

  async function syncUiLang() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
        const stored = await chrome.storage.sync.get(['UI_LANG']);
        uiLang = stored.UI_LANG === 'en' ? 'en' : 'vi';
        if (floatBtn && !isSaving) {
          floatBtn.textContent = t().saveBtn;
        }
        if (speakBtn) {
          speakBtn.title = t().speakTitle;
          speakBtn.setAttribute('aria-label', t().speakTitle);
        }
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
        if (floatBtn && !isSaving) {
          floatBtn.textContent = t().saveBtn;
        }
        if (speakBtn) {
          speakBtn.title = t().speakTitle;
          speakBtn.setAttribute('aria-label', t().speakTitle);
        }
      }
    });
  }

  function ensureShadowUI() {
    if (shadowRoot && document.contains(hostEl)) return;

    hostEl = document.createElement('div');
    hostEl.id = HOST_ID;
    hostEl.style.all = 'initial';
    hostEl.style.position = 'fixed';
    hostEl.style.top = '0';
    hostEl.style.left = '0';
    hostEl.style.zIndex = '2147483647';
    hostEl.style.pointerEvents = 'none';

    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .nw-toolbar {
        position: fixed;
        display: none;
        align-items: center;
        gap: 4px;
        padding: 3px;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid #bfdbfe;
        box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.35);
        pointer-events: auto;
        user-select: none;
      }

      .nw-toolbar.visible {
        display: inline-flex;
      }

      .nw-speak-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1px solid #bfdbfe;
        border-radius: 9999px;
        background: #eff6ff;
        color: #2563eb;
        cursor: pointer;
        transition: transform 0.12s ease, background 0.12s ease;
      }

      .nw-speak-btn:hover {
        background: #dbeafe;
        color: #1d4ed8;
        transform: translateY(-1px);
      }

      .nw-speak-btn:active {
        transform: scale(0.95);
      }

      .nw-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border: 1px solid #1d4ed8;
        border-radius: 9999px;
        background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
        cursor: pointer;
        transition: transform 0.12s ease, background 0.12s ease, opacity 0.12s ease;
        user-select: none;
      }

      .nw-btn:hover:not(:disabled) {
        background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-1px);
      }

      .nw-btn:active:not(:disabled) {
        transform: scale(0.97);
      }

      .nw-btn:disabled {
        opacity: 0.88;
        cursor: wait;
      }

      .nw-spinner {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: nw-spin 0.7s linear infinite;
      }

      @keyframes nw-spin {
        to { transform: rotate(360deg); }
      }

      .nw-toast {
        position: fixed;
        right: 20px;
        bottom: 20px;
        max-width: 340px;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        color: #ffffff;
        background: #0f172a;
        box-shadow: 0 12px 28px -6px rgba(15, 23, 42, 0.35);
        pointer-events: auto;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        display: none;
      }

      .nw-toast.visible {
        display: block;
        opacity: 1;
        transform: translateY(0);
      }

      .nw-toast.success {
        background: #1e40af;
        border: 1px solid #3b82f6;
      }

      .nw-toast.warning {
        background: #92400e;
        border: 1px solid #d97706;
      }

      .nw-toast.error {
        background: #9f1239;
        border: 1px solid #e11d48;
      }
    `;

    toolbarEl = document.createElement('div');
    toolbarEl.className = 'nw-toolbar';

    speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'nw-speak-btn';
    speakBtn.title = t().speakTitle;
    speakBtn.setAttribute('aria-label', t().speakTitle);
    speakBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';

    speakBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    speakBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentPayload?.word) {
        speakSelectedWord(currentPayload.word);
      }
    });

    floatBtn = document.createElement('button');
    floatBtn.type = 'button';
    floatBtn.className = 'nw-btn';
    floatBtn.textContent = t().saveBtn;

    // Prevent mousedown on button from clearing the page's text selection
    floatBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    floatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleSaveClick();
    });

    toastEl = document.createElement('div');
    toastEl.className = 'nw-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');

    if (isSpeechSupported()) {
      toolbarEl.appendChild(speakBtn);
    }
    toolbarEl.appendChild(floatBtn);

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(toolbarEl);
    shadowRoot.appendChild(toastEl);

    (document.documentElement || document.body).appendChild(hostEl);
  }

  function showToast(message, variant = 'success') {
    ensureShadowUI();
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.className = `nw-toast visible ${variant}`;

    toastTimer = setTimeout(() => {
      if (toastEl) {
        toastEl.className = 'nw-toast';
      }
    }, 3400);
  }

  function hideButton() {
    if (toolbarEl) {
      toolbarEl.classList.remove('visible');
    }
    if (floatBtn) {
      floatBtn.disabled = false;
      floatBtn.textContent = t().saveBtn;
    }
    currentPayload = null;
    isSaving = false;
  }

  function isEditableTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target.isContentEditable;
  }

  function extractContext(selection, selectedWord) {
    if (!selection || selection.rangeCount === 0) return selectedWord;

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    const blockTags = new Set([
      'P',
      'LI',
      'BLOCKQUOTE',
      'TD',
      'TH',
      'DIV',
      'ARTICLE',
      'SECTION',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'FIGCAPTION',
    ]);

    let blockEl = node;
    while (blockEl && blockEl !== document.body && !blockTags.has(blockEl.tagName)) {
      blockEl = blockEl.parentElement;
    }

    const rawText = ((blockEl && blockEl.innerText) || (node && node.textContent) || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawText) return selectedWord;
    if (rawText.length <= MAX_CONTEXT_LENGTH) {
      const sentences = rawText.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
      if (sentences && sentences.length > 1) {
        const lowerWord = selectedWord.toLowerCase();
        const matched = sentences.find((s) => s.toLowerCase().includes(lowerWord));
        if (matched) return matched.trim();
      }
      return rawText;
    }

    const sentences = rawText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [rawText];
    const lowerWord = selectedWord.toLowerCase();
    const matchedSentence = sentences.find((s) => s.toLowerCase().includes(lowerWord));

    if (matchedSentence && matchedSentence.trim().length <= MAX_CONTEXT_LENGTH) {
      return matchedSentence.trim();
    }

    const idx = rawText.toLowerCase().indexOf(lowerWord);
    if (idx === -1) {
      return rawText.slice(0, MAX_CONTEXT_LENGTH).trim() + '…';
    }

    const half = Math.floor((MAX_CONTEXT_LENGTH - selectedWord.length) / 2);
    const start = Math.max(0, idx - half);
    const end = Math.min(rawText.length, idx + selectedWord.length + half);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < rawText.length ? '…' : '';
    return `${prefix}${rawText.slice(start, end).trim()}${suffix}`;
  }

  function positionButton(rect) {
    ensureShadowUI();
    const btnWidth = isSpeechSupported() ? 144 : 112;
    const btnHeight = 36;
    const margin = 8;

    let top = rect.top - btnHeight - margin;
    if (top < margin) {
      top = rect.bottom + margin;
    }
    if (top + btnHeight > window.innerHeight - margin) {
      top = window.innerHeight - btnHeight - margin;
    }

    let left = rect.left + rect.width / 2 - btnWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - btnWidth - margin));

    toolbarEl.style.top = `${Math.round(top)}px`;
    toolbarEl.style.left = `${Math.round(left)}px`;
    toolbarEl.classList.add('visible');
  }

  async function handleSaveClick() {
    if (!currentPayload || isSaving) return;

    isSaving = true;
    const payloadToSend = { ...currentPayload };
    const copy = t();

    floatBtn.disabled = true;
    floatBtn.innerHTML = `<span class="nw-spinner"></span><span>${copy.saving}</span>`;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_WORD',
        payload: payloadToSend,
      });

      hideButton();

      if (!response) {
        showToast(copy.noResp, 'error');
        return;
      }

      if (response.ok) {
        if (response.duplicate) {
          showToast(copy.duplicate(payloadToSend.word), 'warning');
        } else {
          const meaning = response.data?.meaning
            ? ` → ${response.data.meaning}`
            : '';
          showToast(copy.saved(payloadToSend.word, meaning), 'success');
        }
      } else if (response.code === 'MISSING_URL') {
        showToast(copy.missingUrl, 'warning');
      } else {
        showToast(response.error || copy.saveFailed, 'error');
      }
    } catch (err) {
      hideButton();
      showToast(copy.connErr(err?.message || 'Unknown'), 'error');
    }
  }

  document.addEventListener('mouseup', (event) => {
    if (hostEl && (event.target === hostEl || hostEl.contains(event.target))) {
      return;
    }
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

      const word = selection.toString().replace(/\s+/g, ' ').trim();
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

      positionButton(rect);
    }, 10);
  });

  document.addEventListener('mousedown', (event) => {
    if (hostEl && (event.target === hostEl || hostEl.contains(event.target))) {
      return;
    }
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

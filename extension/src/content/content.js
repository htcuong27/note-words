/**
 * NoteWords Content Script (Manifest V3)
 *
 * - Listens to text selection (`mouseup`) on web pages.
 * - Renders an isolated Floating Save Button & Toast inside a Shadow DOM root
 *   so host page CSS never conflicts with extension UI.
 * - Extracts `word`, surrounding `context`, `sourceUrl`, and `lang` ("English"),
 *   then sends them to `background.js` via `chrome.runtime.sendMessage`.
 */

(function initNoteWordsContentScript() {
  if (window.__NOTEWORDS_CONTENT_LOADED__) return;
  window.__NOTEWORDS_CONTENT_LOADED__ = true;

  const HOST_ID = 'notewords-extension-shadow-host';
  const DEFAULT_LANG = 'English';
  const MAX_WORD_LENGTH = 120;
  const MAX_CONTEXT_LENGTH = 360;

  let shadowRoot = null;
  let hostEl = null;
  let floatBtn = null;
  let toastEl = null;
  let toastTimer = null;
  let currentPayload = null;
  let isSaving = false;

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

      .nw-btn {
        position: fixed;
        display: none;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid #4338ca;
        border-radius: 9999px;
        background: #4f46e5;
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.3);
        transition: transform 0.12s ease, background-color 0.12s ease, opacity 0.12s ease;
        user-select: none;
      }

      .nw-btn:hover:not(:disabled) {
        background: #4338ca;
        transform: translateY(-1px);
      }

      .nw-btn:active:not(:disabled) {
        transform: scale(0.97);
      }

      .nw-btn:disabled {
        opacity: 0.85;
        cursor: wait;
      }

      .nw-btn.visible {
        display: inline-flex;
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
        background: #065f46;
        border: 1px solid #059669;
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

    floatBtn = document.createElement('button');
    floatBtn.type = 'button';
    floatBtn.className = 'nw-btn';
    floatBtn.textContent = '+ Lưu từ';

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

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(floatBtn);
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
    if (floatBtn) {
      floatBtn.classList.remove('visible');
      floatBtn.disabled = false;
      floatBtn.textContent = '+ Lưu từ';
    }
    currentPayload = null;
    isSaving = false;
  }

  function isEditableTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target.isContentEditable;
  }

  /**
   * Extract the nearest sentence or short paragraph containing the selected word.
   */
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
      // Try extracting the exact sentence if there are multiple sentences
      const sentences = rawText.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
      if (sentences && sentences.length > 1) {
        const lowerWord = selectedWord.toLowerCase();
        const matched = sentences.find((s) => s.toLowerCase().includes(lowerWord));
        if (matched) return matched.trim();
      }
      return rawText;
    }

    // Long paragraph: extract sentence or window around the selected word
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
    const btnWidth = 96;
    const btnHeight = 32;
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

    floatBtn.style.top = `${Math.round(top)}px`;
    floatBtn.style.left = `${Math.round(left)}px`;
    floatBtn.classList.add('visible');
  }

  function handleSaveClick() {
    if (!currentPayload || isSaving) return;

    isSaving = true;
    const payloadToSend = { ...currentPayload };

    floatBtn.disabled = true;
    floatBtn.innerHTML = '<span class="nw-spinner"></span><span>Đang lưu…</span>';

    try {
      chrome.runtime.sendMessage(
        {
          type: 'SAVE_WORD',
          payload: payloadToSend,
        },
        (response) => {
          const runtimeError = chrome.runtime.lastError;
          hideButton();

          if (runtimeError) {
            showToast(
              `Lỗi kết nối Extension: ${runtimeError.message}`,
              'error'
            );
            return;
          }

          if (!response) {
            showToast('Không nhận được phản hồi từ background.', 'error');
            return;
          }

          if (response.ok) {
            if (response.duplicate) {
              showToast(
                `Từ "${payloadToSend.word}" đã tồn tại trong sổ từ.`,
                'warning'
              );
            } else {
              const meaning = response.data?.meaning
                ? ` → ${response.data.meaning}`
                : '';
              showToast(`Đã lưu "${payloadToSend.word}"${meaning}`, 'success');
            }
          } else if (response.code === 'MISSING_URL') {
            showToast(
              'Chưa cấu hình GAS_WEB_APP_URL. Hãy mở popup NoteWords để nhập URL.',
              'warning'
            );
          } else {
            showToast(
              response.error || 'Không thể lưu từ. Vui lòng thử lại.',
              'error'
            );
          }
        }
      );
    } catch (err) {
      hideButton();
      showToast(`Lỗi gửi dữ liệu: ${err.message}`, 'error');
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
      // Only show button for reasonable English text selections
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

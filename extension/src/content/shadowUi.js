const HOST_ID = 'notewords-extension-shadow-host';

const SHADOW_STYLES = `
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

const SPEAKER_ICON_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';

export function createShadowUi({
  getCopy,
  isSpeechSupported,
  onSpeak,
  onSave,
}) {
  let shadowRoot = null;
  let hostEl = null;
  let toolbarEl = null;
  let speakBtn = null;
  let floatBtn = null;
  let toastEl = null;
  let toastTimer = null;
  let toolbarVisible = false;

  function ensureMounted() {
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
    style.textContent = SHADOW_STYLES;

    const copy = getCopy();

    toolbarEl = document.createElement('div');
    toolbarEl.className = 'nw-toolbar';

    speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'nw-speak-btn';
    speakBtn.title = copy.speakTitle;
    speakBtn.setAttribute('aria-label', copy.speakTitle);
    speakBtn.innerHTML = SPEAKER_ICON_SVG;

    speakBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    speakBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSpeak();
    });

    floatBtn = document.createElement('button');
    floatBtn.type = 'button';
    floatBtn.className = 'nw-btn';
    floatBtn.textContent = copy.saveBtn;

    // Prevent mousedown on button from clearing the page's text selection
    floatBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    floatBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSave();
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

  function isHostEvent(target) {
    return Boolean(hostEl && (target === hostEl || hostEl.contains(target)));
  }

  function updateLabels(isSaving) {
    const copy = getCopy();
    if (floatBtn && !isSaving) {
      floatBtn.textContent = copy.saveBtn;
    }
    if (speakBtn) {
      speakBtn.title = copy.speakTitle;
      speakBtn.setAttribute('aria-label', copy.speakTitle);
    }
  }

  function positionToolbar(rect) {
    ensureMounted();
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
    toolbarVisible = true;
  }

  function setSavingState() {
    if (!floatBtn) return;
    const copy = getCopy();
    floatBtn.disabled = true;
    floatBtn.innerHTML = `<span class="nw-spinner"></span><span>${copy.saving}</span>`;
  }

  function hideToolbar() {
    if (!toolbarVisible && !floatBtn?.disabled) return;
    toolbarVisible = false;
    if (toolbarEl) {
      toolbarEl.classList.remove('visible');
    }
    if (floatBtn) {
      floatBtn.disabled = false;
      floatBtn.textContent = getCopy().saveBtn;
    }
  }

  function isVisible() {
    return toolbarVisible;
  }

  function showToast(message, variant = 'success') {
    ensureMounted();
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.className = `nw-toast visible ${variant}`;

    toastTimer = setTimeout(() => {
      if (toastEl) {
        toastEl.className = 'nw-toast';
      }
    }, 3400);
  }

  return {
    isHostEvent,
    isVisible,
    updateLabels,
    positionToolbar,
    setSavingState,
    hideToolbar,
    showToast,
  };
}

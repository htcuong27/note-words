/**
 * NoteWords Background Service Worker (Manifest V3)
 *
 * Receives SAVE_WORD messages from content.js, reads GAS_WEB_APP_URL from
 * chrome.storage.sync, and sends a POST request (action: "ADD_WORD") to
 * Google Apps Script using Content-Type: text/plain;charset=utf-8.
 */

const DEFAULT_LANG = 'English';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'SAVE_WORD') {
    return false;
  }

  (async () => {
    try {
      const stored = await chrome.storage.sync.get([
        'GAS_WEB_APP_URL',
        'NOTE_WORD_LANG',
      ]);
      const gasUrl = String(stored.GAS_WEB_APP_URL || '').trim();

      if (!gasUrl) {
        sendResponse({
          ok: false,
          code: 'MISSING_URL',
          error: 'Chưa cấu hình GAS_WEB_APP_URL trong popup Extension.',
        });
        return;
      }

      const payload = message.payload || {};
      const word = String(payload.word || '').trim();
      if (!word) {
        sendResponse({
          ok: false,
          error: 'Từ vựng rỗng, không thể lưu.',
        });
        return;
      }

      const lang = String(payload.lang || stored.NOTE_WORD_LANG || DEFAULT_LANG).trim() || DEFAULT_LANG;

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'ADD_WORD',
          lang,
          word,
          context: String(payload.context || '').trim(),
          sourceUrl: String(payload.sourceUrl || '').trim(),
        }),
      });

      if (!response.ok) {
        sendResponse({
          ok: false,
          error: `Google Apps Script trả về lỗi HTTP ${response.status}.`,
        });
        return;
      }

      let json;
      try {
        json = await response.json();
      } catch {
        sendResponse({
          ok: false,
          error: 'Phản hồi từ GAS không phải JSON hợp lệ. Kiểm tra lại URL Web App.',
        });
        return;
      }

      if (json && json.success === false) {
        sendResponse({
          ok: false,
          duplicate: Boolean(json.duplicate),
          error: json.error || 'Không thể lưu từ lên Google Sheets.',
        });
        return;
      }

      sendResponse({
        ok: true,
        duplicate: Boolean(json && json.duplicate),
        data: json ? json.data : null,
      });
    } catch (err) {
      sendResponse({
        ok: false,
        error: err?.message || 'Lỗi mạng khi gọi Google Apps Script.',
      });
    }
  })();

  // Keep message channel open for async sendResponse
  return true;
});

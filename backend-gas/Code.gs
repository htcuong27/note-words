/**
 * NoteWords Personal Vocabulary & SRS Backend (Google Apps Script)
 *
 * Entry points (`doGet`, `doPost`) and shared schema/config constants.
 * All `.gs` files in `backend-gas/` share the same Google Apps Script global scope:
 *   - Code.gs            : Constants, `doGet`, `doPost`, HTTP helpers
 *   - Handlers.gs        : Action handlers (`handleGetWords`, `handleAddWord`, etc.)
 *   - SheetRepository.gs : Google Sheets lookup, row serialization, date formatting
 *   - Services.gs        : Auto-translation, Datamuse IPA lookup, server-side SM-2
 *
 * Sheet Columns (Row 1 Headers):
 *   A: id | B: word | C: meaning | D: context | E: sourceUrl | F: createdAt
 *   G: repetition | H: interval | I: easeFactor | J: nextReviewDate | K: lastReviewedAt | L: phonetic
 */

const DEFAULT_LANG = "English";

const SHEET_HEADERS = [
  "id",
  "word",
  "meaning",
  "context",
  "sourceUrl",
  "createdAt",
  "repetition",
  "interval",
  "easeFactor",
  "nextReviewDate",
  "lastReviewedAt",
  "phonetic",
];

const DEFAULT_SM2 = {
  repetition: 0,
  interval: 0,
  easeFactor: 2.5,
};

const LANG_TRANSLATE_MAP = {
  English: { source: "en", target: "vi" },
};

/**
 * HTTP GET handler
 * Query params:
 *   - action: "getWords" (default)
 *   - lang: Sheet tab name (default: "English")
 *   - dueOnly: "true" | "1" to return only words due on or before today
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || "getWords";
    const lang = sanitizeSheetName(params.lang || DEFAULT_LANG);

    if (action === "getWords") {
      const dueOnly = params.dueOnly === "true" || params.dueOnly === "1";
      const words = handleGetWords(lang, dueOnly);
      return jsonResponse({
        success: true,
        lang: lang,
        dueOnly: dueOnly,
        count: words.length,
        data: words,
      });
    }

    return jsonResponse({
      success: false,
      error: "Unsupported GET action: " + action,
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message || String(err),
    });
  }
}

/**
 * Execute a callback while holding the Apps Script document/script lock.
 */
function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/**
 * HTTP POST handler
 * Expects JSON body (sent with Content-Type: text/plain;charset=utf-8 to avoid CORS preflight,
 * or application/json from server/curl):
 *   { action: "ADD_WORD" | "UPDATE_REVIEW" | "EDIT_WORD" | "DELETE_WORD", lang?: "English", ... }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        error: "Missing request body.",
      });
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({
        success: false,
        error: "Invalid JSON payload: " + parseErr.message,
      });
    }

    const action = payload.action;
    const lang = sanitizeSheetName(payload.lang || DEFAULT_LANG);

    switch (action) {
      case "ADD_WORD": {
        // handleAddWord performs external translate/IPA fetches outside the lock
        // and acquires ScriptLock only for the atomic duplicate check + row insert.
        const result = handleAddWord(lang, payload);
        return jsonResponse({
          success: true,
          action: action,
          lang: lang,
          duplicate: result.duplicate,
          data: result.data,
        });
      }

      case "UPDATE_REVIEW": {
        const updated = withScriptLock(function () {
          return handleUpdateReview(lang, payload);
        });
        return jsonResponse({
          success: true,
          action: action,
          lang: lang,
          data: updated,
        });
      }

      case "EDIT_WORD": {
        const edited = withScriptLock(function () {
          return handleEditWord(lang, payload);
        });
        return jsonResponse({
          success: true,
          action: action,
          lang: lang,
          data: edited,
        });
      }

      case "DELETE_WORD": {
        const deletedId = withScriptLock(function () {
          return handleDeleteWord(lang, payload);
        });
        return jsonResponse({
          success: true,
          action: action,
          lang: lang,
          deletedId: deletedId,
        });
      }

      default:
        return jsonResponse({
          success: false,
          error: "Unsupported POST action: " + action,
        });
    }
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message || String(err),
    });
  }
}

function sanitizeSheetName(name) {
  const cleaned = String(name || DEFAULT_LANG).trim();
  return cleaned || DEFAULT_LANG;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

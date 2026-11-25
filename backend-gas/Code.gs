/**
 * NoteWords Personal Vocabulary & SRS Backend (Google Apps Script)
 *
 * Scope (Phase 1): Default language tab is "English", extensible to other language tabs via `lang`.
 *
 * Sheet Columns (Row 1 Headers):
 *   A: id
 *   B: word
 *   C: meaning
 *   D: context
 *   E: sourceUrl
 *   F: createdAt
 *   G: repetition
 *   H: interval
 *   I: easeFactor
 *   J: nextReviewDate
 *   K: lastReviewedAt
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
 * HTTP POST handler
 * Expects JSON body (sent with Content-Type: text/plain;charset=utf-8 to avoid CORS preflight,
 * or application/json from server/curl):
 *   { action: "ADD_WORD" | "UPDATE_REVIEW" | "EDIT_WORD" | "DELETE_WORD", lang?: "English", ... }
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

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
        const created = handleAddWord(lang, payload);
        return jsonResponse({
          success: true,
          action: action,
          lang: lang,
          data: created,
        });
      }

      case "UPDATE_REVIEW": {
        const updated = handleUpdateReview(lang, payload);
        return jsonResponse({
          success: true,
          action: action,
          lang: lang,
          data: updated,
        });
      }

      case "EDIT_WORD": {
        const edited = handleEditWord(lang, payload);
        return jsonResponse({
          success: true,
          action: action,
          lang: lang,
          data: edited,
        });
      }

      case "DELETE_WORD": {
        const deletedId = handleDeleteWord(lang, payload);
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
  } finally {
    lock.releaseLock();
  }
}

/* ========================================================================== *
 * Action Handlers
 * ========================================================================== */

/**
 * Fetch all words from the target language sheet, optionally filtered by dueOnly.
 */
function handleGetWords(lang, dueOnly) {
  const sheet = getOrCreateSheet(lang);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, SHEET_HEADERS.length)
    .getValues();
  const todayStr = getTodayDateString();
  const words = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0] && !row[1]) {
      continue; // Skip empty rows
    }

    const item = rowToObject(row);
    if (dueOnly) {
      if (!item.nextReviewDate || item.nextReviewDate <= todayStr) {
        words.push(item);
      }
    } else {
      words.push(item);
    }
  }

  return words;
}

/**
 * Add a new vocabulary word with auto EN->VI translation (if meaning is empty)
 * and default SM-2 values.
 */
function handleAddWord(lang, payload) {
  const word = String(payload.word || "").trim();
  if (!word) {
    throw new Error('Field "word" is required.');
  }

  let meaning =
    payload.meaning !== undefined && payload.meaning !== null
      ? String(payload.meaning).trim()
      : "";

  if (!meaning) {
    meaning = translateWord(word, lang);
  }

  const context = payload.context ? String(payload.context).trim() : "";
  const sourceUrl = payload.sourceUrl ? String(payload.sourceUrl).trim() : "";
  const nowIso = new Date().toISOString();
  const todayStr = getTodayDateString();

  const newRecord = {
    id: Utilities.getUuid(),
    word: word,
    meaning: meaning,
    context: context,
    sourceUrl: sourceUrl,
    createdAt: nowIso,
    repetition: DEFAULT_SM2.repetition,
    interval: DEFAULT_SM2.interval,
    easeFactor: DEFAULT_SM2.easeFactor,
    nextReviewDate: payload.nextReviewDate
      ? formatDateOnly(payload.nextReviewDate)
      : todayStr,
    lastReviewedAt: "",
  };

  const sheet = getOrCreateSheet(lang);
  const nextRow = sheet.getLastRow() + 1;
  const rowValues = objectToRow(newRecord);

  // Format date/string columns as plain text so Sheets won't coerce YYYY-MM-DD into a Date serial
  const range = sheet.getRange(nextRow, 1, 1, SHEET_HEADERS.length);
  range.setValues([rowValues]);
  sheet.getRange(nextRow, 6).setNumberFormat("@"); // createdAt
  sheet.getRange(nextRow, 10).setNumberFormat("@"); // nextReviewDate
  sheet.getRange(nextRow, 11).setNumberFormat("@"); // lastReviewedAt

  return newRecord;
}

/**
 * Update SM-2 spaced repetition state for a word after a review session.
 * Accepts either explicit SM-2 values (repetition, interval, easeFactor, nextReviewDate)
 * or a SM-2 quality score (0..5) to calculate them server-side.
 */
function handleUpdateReview(lang, payload) {
  const id = String(payload.id || "").trim();
  if (!id) {
    throw new Error('Field "id" is required.');
  }

  const sheet = getOrCreateSheet(lang);
  const match = findRowById(sheet, id);
  if (!match) {
    throw new Error("Word not found with id: " + id);
  }

  const current = rowToObject(match.values);
  let repetition = current.repetition;
  let interval = current.interval;
  let easeFactor = current.easeFactor;
  let nextReviewDate = current.nextReviewDate;

  const hasExplicitSm2 =
    payload.repetition !== undefined &&
    payload.interval !== undefined &&
    payload.easeFactor !== undefined &&
    payload.nextReviewDate !== undefined;

  if (hasExplicitSm2) {
    repetition = Number(payload.repetition);
    interval = Number(payload.interval);
    easeFactor = Number(payload.easeFactor);
    nextReviewDate = formatDateOnly(payload.nextReviewDate);
  } else if (payload.quality !== undefined) {
    const computed = calculateSm2(current, Number(payload.quality));
    repetition = computed.repetition;
    interval = computed.interval;
    easeFactor = computed.easeFactor;
    nextReviewDate = computed.nextReviewDate;
  } else {
    throw new Error(
      "Provide either (repetition, interval, easeFactor, nextReviewDate) or (quality: 0-5).",
    );
  }

  const lastReviewedAt = payload.lastReviewedAt
    ? String(payload.lastReviewedAt)
    : new Date().toISOString();

  const updated = {
    id: current.id,
    word: current.word,
    meaning: current.meaning,
    context: current.context,
    sourceUrl: current.sourceUrl,
    createdAt: current.createdAt,
    repetition: repetition,
    interval: interval,
    easeFactor: Math.round(easeFactor * 100) / 100,
    nextReviewDate: nextReviewDate,
    lastReviewedAt: lastReviewedAt,
  };

  const range = sheet.getRange(match.rowIndex, 1, 1, SHEET_HEADERS.length);
  range.setValues([objectToRow(updated)]);
  sheet.getRange(match.rowIndex, 10).setNumberFormat("@");
  sheet.getRange(match.rowIndex, 11).setNumberFormat("@");

  return updated;
}

/**
 * Edit word content fields (word, meaning, context, sourceUrl) without resetting SM-2 progress.
 */
function handleEditWord(lang, payload) {
  const id = String(payload.id || "").trim();
  if (!id) {
    throw new Error('Field "id" is required.');
  }

  const sheet = getOrCreateSheet(lang);
  const match = findRowById(sheet, id);
  if (!match) {
    throw new Error("Word not found with id: " + id);
  }

  const current = rowToObject(match.values);
  const updatedWord =
    payload.word !== undefined ? String(payload.word).trim() : current.word;
  if (!updatedWord) {
    throw new Error('Field "word" cannot be empty.');
  }

  let updatedMeaning =
    payload.meaning !== undefined
      ? String(payload.meaning).trim()
      : current.meaning;

  if (payload.autoTranslate === true && !updatedMeaning) {
    updatedMeaning = translateWord(updatedWord, lang);
  }

  const updated = {
    id: current.id,
    word: updatedWord,
    meaning: updatedMeaning,
    context:
      payload.context !== undefined
        ? String(payload.context).trim()
        : current.context,
    sourceUrl:
      payload.sourceUrl !== undefined
        ? String(payload.sourceUrl).trim()
        : current.sourceUrl,
    createdAt: current.createdAt,
    repetition: current.repetition,
    interval: current.interval,
    easeFactor: current.easeFactor,
    nextReviewDate: current.nextReviewDate,
    lastReviewedAt: current.lastReviewedAt,
  };

  sheet
    .getRange(match.rowIndex, 1, 1, SHEET_HEADERS.length)
    .setValues([objectToRow(updated)]);
  return updated;
}

/**
 * Delete a word row by id.
 */
function handleDeleteWord(lang, payload) {
  const id = String(payload.id || "").trim();
  if (!id) {
    throw new Error('Field "id" is required.');
  }

  const sheet = getOrCreateSheet(lang);
  const match = findRowById(sheet, id);
  if (!match) {
    throw new Error("Word not found with id: " + id);
  }

  sheet.deleteRow(match.rowIndex);
  return id;
}

/* ========================================================================== *
 * Helpers
 * ========================================================================== */

/**
 * Get the sheet tab for the given language, creating it with headers if it does not exist.
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      "No active spreadsheet found. Bind this Apps Script project to a Google Sheet.",
    );
  }

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    const headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
    headerRange.setValues([SHEET_HEADERS]);
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Find a row by its `id` in column A.
 * Returns { rowIndex (1-based), values } or null.
 */
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return null;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, SHEET_HEADERS.length)
    .getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === id) {
      return {
        rowIndex: i + 2,
        values: values[i],
      };
    }
  }
  return null;
}

/**
 * Auto-translate text using Google Apps Script LanguageApp (EN -> VI for English).
 */
function translateWord(text, lang) {
  const langConfig =
    LANG_TRANSLATE_MAP[lang] || LANG_TRANSLATE_MAP[DEFAULT_LANG];
  try {
    return LanguageApp.translate(text, langConfig.source, langConfig.target);
  } catch (err) {
    Logger.log('Translation failed for "' + text + '": ' + err.message);
    return "";
  }
}

/**
 * Server-side SM-2 calculation fallback (used when UPDATE_REVIEW receives `quality` 0-5).
 */
function calculateSm2(current, quality) {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let repetition = Number(current.repetition) || 0;
  let interval = Number(current.interval) || 0;
  let easeFactor = Number(current.easeFactor) || DEFAULT_SM2.easeFactor;

  if (q < 3) {
    repetition = 0;
    interval = 1;
  } else {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    repetition: repetition,
    interval: interval,
    easeFactor: Math.round(easeFactor * 100) / 100,
    nextReviewDate: formatDateOnly(nextDate),
  };
}

function rowToObject(row) {
  return {
    id: String(row[0] || ""),
    word: String(row[1] || ""),
    meaning: String(row[2] || ""),
    context: String(row[3] || ""),
    sourceUrl: String(row[4] || ""),
    createdAt: formatIsoOrString(row[5]),
    repetition: Number(row[6]) || 0,
    interval: Number(row[7]) || 0,
    easeFactor:
      row[8] !== "" && row[8] !== null && row[8] !== undefined
        ? Number(row[8])
        : DEFAULT_SM2.easeFactor,
    nextReviewDate: formatDateOnly(row[9]),
    lastReviewedAt: formatIsoOrString(row[10]),
  };
}

function objectToRow(obj) {
  return [
    obj.id,
    obj.word,
    obj.meaning,
    obj.context,
    obj.sourceUrl,
    obj.createdAt,
    obj.repetition,
    obj.interval,
    obj.easeFactor,
    obj.nextReviewDate,
    obj.lastReviewedAt,
  ];
}

function getTodayDateString() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
}

function formatDateOnly(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const str = String(val).trim();
  // Keep YYYY-MM-DD prefix if ISO timestamp was passed
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  return str;
}

function formatIsoOrString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return val.toISOString();
  }
  return String(val);
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

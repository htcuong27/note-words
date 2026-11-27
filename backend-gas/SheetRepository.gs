/**
 * Google Sheets Repository, Row Serialization & Date Helpers
 */

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
  } else {
    // Auto-migrate older sheets missing newer trailing columns (e.g. `phonetic`)
    const existingHeaders = sheet
      .getRange(1, 1, 1, SHEET_HEADERS.length)
      .getValues()[0];
    for (let col = 0; col < SHEET_HEADERS.length; col++) {
      if (!String(existingHeaders[col] || "").trim()) {
        const cell = sheet.getRange(1, col + 1);
        cell.setValue(SHEET_HEADERS[col]);
        cell.setFontWeight("bold");
      }
    }
  }

  return sheet;
}

/**
 * Format date/timestamp columns as plain text ("@") to prevent Google Sheets Date coercion.
 */
function formatDateColumnsAsText(sheet, rowIndex, includeCreatedAt) {
  if (includeCreatedAt) {
    sheet.getRange(rowIndex, 6).setNumberFormat("@"); // createdAt
  }
  sheet.getRange(rowIndex, 10).setNumberFormat("@"); // nextReviewDate
  sheet.getRange(rowIndex, 11).setNumberFormat("@"); // lastReviewedAt
}

/**
 * Find a row by its `id` in column A (reads only column A first, then fetches the matching row).
 * Returns { rowIndex (1-based), values } or null.
 */
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return null;
  }

  const idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < idColumn.length; i++) {
    if (String(idColumn[i][0]).trim() === id) {
      const rowIndex = i + 2;
      return {
        rowIndex: rowIndex,
        values: sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).getValues()[0],
      };
    }
  }
  return null;
}

/**
 * Strip invisible zero-width chars, collapse internal whitespace, and trim both ends.
 */
function cleanWordText(raw) {
  return String(raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical comparison key for checking 100% duplicate words (trimmed & case-insensitive).
 */
function normalizeWordKey(raw) {
  return cleanWordText(raw).toLowerCase();
}

/**
 * Find an existing row matching `word` (after trimming & whitespace normalization, case-insensitive).
 * Reads only columns A-B first, then fetches the matching full row.
 * Optionally skips `excludeId` when validating inline edits.
 * Returns { rowIndex (1-based), values } or null.
 */
function findRowByWord(sheet, word, excludeId) {
  const targetKey = normalizeWordKey(word);
  if (!targetKey) {
    return null;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return null;
  }

  const keyColumns = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (let i = 0; i < keyColumns.length; i++) {
    const rowId = String(keyColumns[i][0] || "").trim();
    if (excludeId && rowId === excludeId) {
      continue;
    }
    if (normalizeWordKey(keyColumns[i][1]) === targetKey) {
      const rowIndex = i + 2;
      return {
        rowIndex: rowIndex,
        values: sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).getValues()[0],
      };
    }
  }
  return null;
}

function rowToObject(row) {
  return {
    id: String(row[0] || "").trim(),
    word: cleanWordText(row[1]),
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
    phonetic: String(row[11] || ""),
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
    obj.phonetic || "",
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

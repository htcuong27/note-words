/**
 * Action Handlers for NoteWords GAS Web App
 *
 * Handles GET (`getWords`) and POST (`ADD_WORD`, `UPDATE_REVIEW`, `EDIT_WORD`, `DELETE_WORD`)
 * operations against the target language Google Sheet tab.
 */

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
 * and default SM-2 values. Skips inserting if an identical word (after trim) already exists.
 *
 * External API calls (`translateWord`, `fetchPhonetic`) run outside ScriptLock to avoid
 * blocking concurrent requests; duplicate check + row insert run atomically under ScriptLock.
 */
function handleAddWord(lang, payload) {
  const word = cleanWordText(payload.word);
  if (!word) {
    throw new Error('Field "word" is required.');
  }

  // Fast read-only pre-check to skip external translate/IPA calls on obvious duplicates
  const existingPre = findRowByWord(getOrCreateSheet(lang), word);
  if (existingPre) {
    return {
      duplicate: true,
      data: rowToObject(existingPre.values),
    };
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
  let phonetic =
    payload.phonetic !== undefined && payload.phonetic !== null
      ? String(payload.phonetic).trim()
      : "";
  if (!phonetic) {
    phonetic = fetchPhonetic(word, lang);
  }

  return withScriptLock(function () {
    const sheet = getOrCreateSheet(lang);
    const existing = findRowByWord(sheet, word);
    if (existing) {
      return {
        duplicate: true,
        data: rowToObject(existing.values),
      };
    }

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
      phonetic: phonetic,
    };

    const nextRow = sheet.getLastRow() + 1;
    const rowValues = objectToRow(newRecord);

    // Format date/string columns as plain text BEFORE setValues so Sheets won't coerce YYYY-MM-DD into a Date serial
    formatDateColumnsAsText(sheet, nextRow, true);
    sheet.getRange(nextRow, 1, 1, SHEET_HEADERS.length).setValues([rowValues]);

    return {
      duplicate: false,
      data: newRecord,
    };
  });
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
    phonetic: current.phonetic,
  };

  // Format date columns (J:K) BEFORE writing and update only SM-2 columns (G:K)
  formatDateColumnsAsText(sheet, match.rowIndex, false);
  sheet
    .getRange(match.rowIndex, 7, 1, 5)
    .setValues([
      [
        updated.repetition,
        updated.interval,
        updated.easeFactor,
        updated.nextReviewDate,
        updated.lastReviewedAt,
      ],
    ]);

  return updated;
}

/**
 * Edit word content fields (word, meaning, context, sourceUrl, phonetic) without resetting SM-2 progress.
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
    payload.word !== undefined
      ? cleanWordText(payload.word)
      : cleanWordText(current.word);
  if (!updatedWord) {
    throw new Error('Field "word" cannot be empty.');
  }

  // Only scan column B for duplicates if the canonical word text actually changed
  if (normalizeWordKey(updatedWord) !== normalizeWordKey(current.word)) {
    const duplicateMatch = findRowByWord(sheet, updatedWord, id);
    if (duplicateMatch) {
      throw new Error('Word "' + updatedWord + '" already exists.');
    }
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
    phonetic:
      payload.phonetic !== undefined
        ? String(payload.phonetic).trim()
        : current.phonetic,
  };

  // Write only editable content columns (B:E and L if changed), leaving date & SM-2 columns untouched
  sheet
    .getRange(match.rowIndex, 2, 1, 4)
    .setValues([
      [updated.word, updated.meaning, updated.context, updated.sourceUrl],
    ]);
  if (updated.phonetic !== current.phonetic) {
    sheet.getRange(match.rowIndex, 12).setValue(updated.phonetic);
  }
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

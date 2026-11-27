/**
 * External Services & Domain Logic:
 *   - Auto-translation via Google Apps Script LanguageApp
 *   - Best-effort English IPA phonetic lookup via Datamuse API
 *   - Server-side SM-2 calculation fallback
 */

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
 * Best-effort English IPA phonetic lookup via Datamuse API (CMUdict, always HTTP 200).
 */
function fetchPhonetic(text, lang) {
  const normalizedLang = String(lang || DEFAULT_LANG).trim().toLowerCase();
  if (normalizedLang !== "english" && normalizedLang !== "en") {
    return "";
  }

  const cleaned = String(text || "")
    .trim()
    .replace(/^[.,!?;:"()[\]{}]+|[.,!?;:"()[\]{}]+$/g, "")
    .toLowerCase();
  if (!cleaned || !/^[a-z'-]+$/.test(cleaned)) {
    return "";
  }

  try {
    const url =
      "https://api.datamuse.com/words?sp=" +
      encodeURIComponent(cleaned) +
      "&md=r&ipa=1&max=1";
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      return "";
    }

    const entries = JSON.parse(res.getContentText());
    if (!Array.isArray(entries) || entries.length === 0) return "";

    const exact = entries.find(function (item) {
      return (
        item &&
        typeof item.word === "string" &&
        item.word.toLowerCase() === cleaned
      );
    });
    if (!exact || !Array.isArray(exact.tags)) return "";

    const ipaTag = exact.tags.find(function (tag) {
      return typeof tag === "string" && tag.indexOf("ipa_pron:") === 0;
    });
    if (!ipaTag) return "";

    const ipa = ipaTag.slice("ipa_pron:".length).trim();
    if (!ipa) return "";
    if (
      (ipa.charAt(0) === "/" && ipa.charAt(ipa.length - 1) === "/") ||
      (ipa.charAt(0) === "[" && ipa.charAt(ipa.length - 1) === "]")
    ) {
      return ipa;
    }
    return "/" + ipa + "/";
  } catch (err) {
    Logger.log('Phonetic lookup failed for "' + text + '": ' + err.message);
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

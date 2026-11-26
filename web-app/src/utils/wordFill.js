/**
 * Fill-in-the-blank helpers for the Flashcard memorization round.
 * Picks random character positions to hide and increases the blank count on wrong attempts.
 */

export function isFillableChar(ch) {
  return /[\p{L}\p{N}]/u.test(ch);
}

export function getFillableIndices(word) {
  const chars = Array.from(String(word || ''));
  const indices = [];
  for (let i = 0; i < chars.length; i += 1) {
    if (isFillableChar(chars[i])) {
      indices.push(i);
    }
  }
  return indices;
}

export function getBlankCount(totalFillable, wrongAttempts = 0) {
  if (totalFillable <= 0) return 0;
  const initial =
    totalFillable <= 2
      ? 1
      : Math.min(totalFillable - 1, Math.max(1, Math.ceil(totalFillable * 0.35)));
  const step = Math.max(1, Math.floor(totalFillable * 0.2));
  return Math.min(totalFillable, initial + Math.max(0, wrongAttempts) * step);
}

function sameNumberArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function pickRandomBlankIndices(word, wrongAttempts = 0, prevBlanks = null) {
  const fillable = getFillableIndices(word);
  if (fillable.length === 0) return [];

  const count = getBlankCount(fillable.length, wrongAttempts);
  const maxTries = prevBlanks && count < fillable.length && fillable.length > 1 ? 3 : 1;

  let chosen = [];
  for (let attempt = 0; attempt < maxTries; attempt += 1) {
    const pool = [...fillable];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    chosen = pool.slice(0, count).sort((a, b) => a - b);
    if (!sameNumberArray(chosen, prevBlanks)) {
      break;
    }
  }

  return chosen;
}

export function checkFillAnswer(word, blankIndices, userInputs) {
  const chars = Array.from(String(word || ''));
  const wrongIndices = [];

  for (const idx of blankIndices || []) {
    const expected = String(chars[idx] || '').toLocaleLowerCase();
    const actual = String(userInputs?.[idx] || '')
      .trim()
      .toLocaleLowerCase();
    if (!actual || actual !== expected) {
      wrongIndices.push(idx);
    }
  }

  return {
    isCorrect: wrongIndices.length === 0,
    wrongIndices,
  };
}

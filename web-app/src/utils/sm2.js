/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Ratings:
 *   Again = 1
 *   Hard  = 3
 *   Good  = 4
 *   Easy  = 5
 */

export const RATING = {
  AGAIN: 1,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
};

export const REVIEW_OPTIONS = [
  {
    shortcut: '1',
    key: 'again',
    label: 'Again',
    viLabel: 'Quên',
    quality: RATING.AGAIN,
  },
  {
    shortcut: '2',
    key: 'hard',
    label: 'Hard',
    viLabel: 'Khó',
    quality: RATING.HARD,
  },
  {
    shortcut: '3',
    key: 'good',
    label: 'Good',
    viLabel: 'Tốt',
    quality: RATING.GOOD,
  },
  {
    shortcut: '4',
    key: 'easy',
    label: 'Easy',
    viLabel: 'Dễ',
    quality: RATING.EASY,
  },
];

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

/**
 * Format a Date object into local calendar YYYY-MM-DD (no UTC drift).
 */
export function formatDateYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Return today's local calendar date as YYYY-MM-DD.
 */
export function getTodayDateString(now = new Date()) {
  return formatDateYYYYMMDD(now);
}

/**
 * Check whether a word is due for review today (nextReviewDate <= today).
 */
export function isWordDue(word, now = new Date()) {
  if (!word || !word.nextReviewDate) return true;
  return String(word.nextReviewDate).slice(0, 10) <= getTodayDateString(now);
}

/**
 * Calculate the next SM-2 state for a card given a quality score (1, 3, 4, or 5).
 *
 * @param {object} card - { repetition, interval, easeFactor }
 * @param {number} quality - SM-2 quality (Again=1, Hard=3, Good=4, Easy=5)
 * @param {Date} [now=new Date()]
 * @returns {{ repetition: number, interval: number, easeFactor: number, nextReviewDate: string, nextReview: string, lastReviewedAt: string }}
 */
export function calculateSM2(card, quality, now = new Date()) {
  const q = Number(quality);
  let repetition = Number(card?.repetition) || 0;
  let interval = Number(card?.interval) || 0;
  let easeFactor =
    card?.easeFactor !== undefined && card?.easeFactor !== null && card?.easeFactor !== ''
      ? Number(card.easeFactor)
      : DEFAULT_EASE_FACTOR;

  if (q < 3) {
    // Again: reset repetition progress
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
  if (easeFactor < MIN_EASE_FACTOR) {
    easeFactor = MIN_EASE_FACTOR;
  }
  easeFactor = Math.round(easeFactor * 100) / 100;

  const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + interval);
  const nextReview = formatDateYYYYMMDD(nextDate);

  return {
    repetition,
    interval,
    easeFactor,
    nextReview,
    nextReviewDate: nextReview,
    lastReviewedAt: now.toISOString(),
  };
}

/**
 * Preview interval labels (in Vietnamese) for each of the 4 review options.
 */
export function previewNextIntervals(card, now = new Date()) {
  const previews = {};
  for (const opt of REVIEW_OPTIONS) {
    const result = calculateSM2(card, opt.quality, now);
    previews[opt.quality] = formatIntervalLabel(result.interval);
  }
  return previews;
}

export function formatIntervalLabel(days) {
  if (days <= 1) return '1 ngày';
  if (days < 30) return `${days} ngày`;
  const months = Math.round((days / 30) * 10) / 10;
  return `${months} tháng`;
}

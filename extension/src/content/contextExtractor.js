export const MAX_WORD_LENGTH = 120;
export const MAX_CONTEXT_LENGTH = 360;

const BLOCK_TAGS = new Set([
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

export function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function cleanSelectedWord(raw) {
  return String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractContext(selection, selectedWord) {
  if (!selection || selection.rangeCount === 0) return selectedWord;

  const range = selection.getRangeAt(0);
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }

  let blockEl = node;
  while (blockEl && blockEl !== document.body && !BLOCK_TAGS.has(blockEl.tagName)) {
    blockEl = blockEl.parentElement;
  }

  const rawText = (
    (blockEl && blockEl.innerText) ||
    (node && node.textContent) ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();

  if (!rawText) return selectedWord;

  const sentences = rawText.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  const lowerWord = selectedWord.toLowerCase();

  if (rawText.length <= MAX_CONTEXT_LENGTH) {
    if (sentences && sentences.length > 1) {
      const matched = sentences.find((s) => s.toLowerCase().includes(lowerWord));
      if (matched) return matched.trim();
    }
    return rawText;
  }

  const sentenceList = sentences || [rawText];
  const matchedSentence = sentenceList.find((s) =>
    s.toLowerCase().includes(lowerWord)
  );

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

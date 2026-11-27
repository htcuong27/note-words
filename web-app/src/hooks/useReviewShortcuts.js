import { useEffect } from 'react';
import { RATING } from '../utils/sm2';
import { speakWord } from '../utils/speech';

function blurActiveControl() {
  const active = document.activeElement;
  const activeTag = active?.tagName?.toLowerCase();
  if (activeTag === 'button' || activeTag === 'a') {
    active.blur?.();
  }
}

export function useReviewShortcuts({
  currentCard,
  currentLang,
  loading,
  stage,
  onFlip,
  onStartPractice,
  onRate,
}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!currentCard || loading) return;

      const isPKey = e.code === 'KeyP' || e.key.toLowerCase() === 'p';

      // Alt+P works everywhere (including inside WordFillPractice inputs)
      if (isPKey && e.altKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        speakWord(currentCard.word, currentLang);
        return;
      }

      const tag = e.target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        e.target?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space' && stage !== 'practice') {
        e.preventDefault();
        blurActiveControl();
        onFlip();
        return;
      }

      if (e.key === 'Enter' && stage === 'back') {
        e.preventDefault();
        blurActiveControl();
        onStartPractice();
        return;
      }

      if (isPKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        speakWord(currentCard.word, currentLang);
        return;
      }

      if (stage === 'rate') {
        if (e.key === '1') {
          e.preventDefault();
          onRate(RATING.AGAIN);
        } else if (e.key === '2') {
          e.preventDefault();
          onRate(RATING.HARD);
        } else if (e.key === '3') {
          e.preventDefault();
          onRate(RATING.GOOD);
        } else if (e.key === '4') {
          e.preventDefault();
          onRate(RATING.EASY);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentCard,
    currentLang,
    loading,
    stage,
    onFlip,
    onStartPractice,
    onRate,
  ]);
}

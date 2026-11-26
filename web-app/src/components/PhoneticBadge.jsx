import { useEffect, useMemo, useState } from 'react';
import { getTranslations } from '../utils/i18n';
import {
  analyzeIpaStress,
  fetchPhonetic,
  getCachedPhonetic,
  normalizeIpaString,
  tokenizeIpaForDisplay,
} from '../utils/phonetics';

export default function PhoneticBadge({
  word,
  phonetic = '',
  lang = 'English',
  uiLang = 'vi',
  size = 'md', // 'sm' | 'md' | 'lg'
  showStressPill = true,
  className = '',
}) {
  const explicitIpa = useMemo(() => normalizeIpaString(phonetic), [phonetic]);
  const [resolvedIpa, setResolvedIpa] = useState(() => {
    if (explicitIpa) return explicitIpa;
    const cached = getCachedPhonetic(word, lang);
    return cached || '';
  });

  useEffect(() => {
    if (explicitIpa) {
      setResolvedIpa(explicitIpa);
      return;
    }

    const cached = getCachedPhonetic(word, lang);
    if (cached !== undefined) {
      setResolvedIpa(cached);
      return;
    }

    setResolvedIpa('');
    let cancelled = false;
    fetchPhonetic(word, lang).then((ipa) => {
      if (!cancelled) {
        setResolvedIpa(ipa || '');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [word, explicitIpa, lang]);

  const activeIpa = explicitIpa || resolvedIpa;
  const analysis = useMemo(() => analyzeIpaStress(activeIpa), [activeIpa]);
  const tokens = useMemo(() => tokenizeIpaForDisplay(activeIpa), [activeIpa]);

  if (!activeIpa) return null;

  const t = getTranslations(uiLang).phonetic;

  const ipaTextClass =
    size === 'lg'
      ? 'text-base sm:text-lg'
      : size === 'sm'
        ? 'text-xs'
        : 'text-sm';

  const pillClass =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px]'
      : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex flex-wrap items-center justify-center gap-1.5 ${className}`}
    >
      <span
        title={t.ipaTitle}
        className={`font-sans font-normal tracking-normal text-slate-600 ${ipaTextClass}`}
      >
        {tokens.map((tok, idx) => {
          if (tok.type === 'primary') {
            return (
              <span
                key={idx}
                className="rounded bg-rose-50 px-0.5 font-bold text-rose-600"
              >
                {tok.text}
              </span>
            );
          }
          if (tok.type === 'secondary') {
            return (
              <span key={idx} className="font-semibold text-amber-600">
                {tok.text}
              </span>
            );
          }
          return <span key={idx}>{tok.text}</span>;
        })}
      </span>

      {showStressPill && analysis.primaryStressSyllable && (
        <span
          title={t.stressTitle(
            analysis.primaryStressSyllable,
            analysis.totalSyllables
          )}
          className={`inline-flex items-center rounded-full bg-rose-50 font-semibold text-rose-700 ring-1 ring-inset ring-rose-200/80 ${pillClass}`}
        >
          {t.stressBadge(analysis.primaryStressSyllable)}
        </span>
      )}
    </span>
  );
}

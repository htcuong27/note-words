import { memo, useEffect, useState } from 'react';
import {
  analyzeIpaStress,
  fetchPhonetic,
  getCachedPhonetic,
  normalizeIpaString,
  tokenizeIpaForDisplay,
} from '../../utils/phonetics';

const PopupPhonetic = memo(function PopupPhonetic({
  word,
  phonetic,
  lang,
  stressBadge,
}) {
  const explicit = normalizeIpaString(phonetic);
  const [ipa, setIpa] = useState(
    () => explicit || getCachedPhonetic(word, lang) || ''
  );

  useEffect(() => {
    if (explicit) {
      setIpa(explicit);
      return;
    }
    const cached = getCachedPhonetic(word, lang);
    if (cached !== undefined) {
      setIpa(cached);
      return;
    }
    setIpa('');
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      fetchPhonetic(word, lang).then((res) => {
        if (!cancelled) setIpa(res || '');
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [word, explicit, lang]);

  const activeIpa = explicit || ipa;
  if (!activeIpa) return null;

  const analysis = analyzeIpaStress(activeIpa);
  const tokens = tokenizeIpaForDisplay(activeIpa);

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-slate-500">
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
      {analysis.primaryStressSyllable && (
        <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200/80">
          {stressBadge(analysis.primaryStressSyllable)}
        </span>
      )}
    </div>
  );
});

export default PopupPhonetic;

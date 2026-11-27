import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { getTranslations } from '../utils/i18n';
import {
  analyzeIpaStress,
  fetchPhonetic,
  getCachedPhonetic,
  normalizeIpaString,
  tokenizeIpaForDisplay,
} from '../utils/phonetics';

const lazyCallbacks = new WeakMap();
let sharedLazyObserver = null;

function getSharedLazyObserver() {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (!sharedLazyObserver) {
    sharedLazyObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const cb = lazyCallbacks.get(entry.target);
          sharedLazyObserver.unobserve(entry.target);
          lazyCallbacks.delete(entry.target);
          cb?.();
        }
      },
      { rootMargin: '200px 0px' }
    );
  }
  return sharedLazyObserver;
}

const PhoneticBadge = memo(function PhoneticBadge({
  word,
  phonetic = '',
  lang = 'English',
  uiLang = 'vi',
  size = 'md', // 'sm' | 'md' | 'lg'
  showStressPill = true,
  lazy = false,
  className = '',
}) {
  const explicitIpa = useMemo(() => normalizeIpaString(phonetic), [phonetic]);
  const initialCached = explicitIpa
    ? explicitIpa
    : getCachedPhonetic(word, lang);

  const [resolvedIpa, setResolvedIpa] = useState(() => initialCached || '');
  const [canFetch, setCanFetch] = useState(
    () => !lazy || Boolean(explicitIpa) || initialCached !== undefined
  );
  const [fetchDone, setFetchDone] = useState(
    () => Boolean(explicitIpa) || initialCached !== undefined
  );
  const probeRef = useRef(null);

  useEffect(() => {
    if (explicitIpa) {
      setResolvedIpa(explicitIpa);
      setCanFetch(true);
      setFetchDone(true);
      return;
    }

    const cached = getCachedPhonetic(word, lang);
    if (cached !== undefined) {
      setResolvedIpa(cached);
      setCanFetch(true);
      setFetchDone(true);
      return;
    }

    setResolvedIpa('');
    setFetchDone(false);
    setCanFetch(!lazy);
  }, [word, explicitIpa, lang, lazy]);

  useEffect(() => {
    if (!lazy || canFetch) return;
    const el = probeRef.current;
    const observer = getSharedLazyObserver();
    if (!el || !observer) {
      setCanFetch(true);
      return;
    }

    lazyCallbacks.set(el, () => setCanFetch(true));
    observer.observe(el);

    return () => {
      observer.unobserve(el);
      lazyCallbacks.delete(el);
    };
  }, [lazy, canFetch, word, lang]);

  useEffect(() => {
    if (!canFetch || explicitIpa) return;

    const cached = getCachedPhonetic(word, lang);
    if (cached !== undefined) {
      setResolvedIpa(cached);
      setFetchDone(true);
      return;
    }

    let cancelled = false;
    fetchPhonetic(word, lang).then((ipa) => {
      if (!cancelled) {
        setResolvedIpa(ipa || '');
        setFetchDone(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canFetch, word, explicitIpa, lang]);

  const activeIpa = explicitIpa || resolvedIpa;
  const analysis = useMemo(() => analyzeIpaStress(activeIpa), [activeIpa]);
  const tokens = useMemo(() => tokenizeIpaForDisplay(activeIpa), [activeIpa]);

  if (!activeIpa) {
    if (lazy && !canFetch && !fetchDone) {
      return (
        <span
          ref={probeRef}
          className="inline-block h-2 w-1 align-middle"
          aria-hidden="true"
        />
      );
    }
    return null;
  }

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
});

export default PhoneticBadge;

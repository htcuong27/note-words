import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WordTableRow from './WordTableRow';
import { cleanWordText } from '../utils/api';
import { getTranslations } from '../utils/i18n';
import { isSpeechSupported, speakWord, stopSpeaking } from '../utils/speech';

const VIRTUAL_OVERSCAN = 4;
const ESTIMATED_ROW_DESKTOP = 76;
const ESTIMATED_ROW_MOBILE = 220;
const ESTIMATED_ROW_EDIT = 148;
const MOBILE_BREAKPOINT = 680;
const DEFAULT_VIEWPORT_HEIGHT = 640;

const EMPTY_DRAFT = {
  word: '',
  phonetic: '',
  meaning: '',
  context: '',
};

function findFirstIndexAfter(offsets, count, target) {
  let low = 0;
  let high = count;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (offsets[mid + 1] <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

export default function WordTable({
  words,
  onSaveEdit,
  onDelete,
  lang = 'English',
  uiLang = 'vi',
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [savingId, setSavingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [measureVersion, setMeasureVersion] = useState(0);

  const wrapperRef = useRef(null);
  const theadRef = useRef(null);
  const measuredHeightsRef = useRef(new Map());
  const nodeToKeyRef = useRef(new Map());
  const idToNodeRef = useRef(new Map());
  const rowObserverRef = useRef(null);
  const scrollRafRef = useRef(null);
  const latestScrollTopRef = useRef(0);
  const lastWidthRef = useRef(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const t = getTranslations(uiLang).table;
  const speechAvailable = isSpeechSupported();

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  // Observe wrapper size to track viewport height & mobile/desktop container breakpoint
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateSize = () => {
      const nextHeight = wrapper.clientHeight || DEFAULT_VIEWPORT_HEIGHT;
      const nextWidth = wrapper.clientWidth || 0;
      setViewportHeight((prev) => (prev === nextHeight ? prev : nextHeight));
      setIsMobileLayout(nextWidth > 0 && nextWidth < MOBILE_BREAKPOINT);

      if (lastWidthRef.current > 0 && Math.abs(lastWidthRef.current - nextWidth) > 24) {
        measuredHeightsRef.current.clear();
        setMeasureVersion((v) => v + 1);
      }
      lastWidthRef.current = nextWidth;
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(updateSize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [words.length === 0]);

  // Observe mounted table rows to keep dynamic height cache accurate
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const key =
          entry.target.dataset?.nwMeasureKey ||
          nodeToKeyRef.current.get(entry.target);
        if (!key) continue;
        const nextHeight = Math.ceil(
          entry.target.getBoundingClientRect().height ||
            entry.contentRect.height
        );
        if (nextHeight <= 0) continue;
        const prevHeight = measuredHeightsRef.current.get(key);
        if (prevHeight === undefined || Math.abs(prevHeight - nextHeight) >= 1) {
          measuredHeightsRef.current.set(key, nextHeight);
          changed = true;
        }
      }
      if (changed) {
        setMeasureVersion((v) => v + 1);
      }
    });

    rowObserverRef.current = ro;
    for (const el of nodeToKeyRef.current.keys()) {
      ro.observe(el);
    }

    return () => {
      ro.disconnect();
      rowObserverRef.current = null;
    };
  }, []);

  const registerRowRef = useCallback((id, measureKey, el) => {
    const prevEl = idToNodeRef.current.get(id);
    if (prevEl && prevEl !== el) {
      rowObserverRef.current?.unobserve(prevEl);
      nodeToKeyRef.current.delete(prevEl);
      idToNodeRef.current.delete(id);
    }

    if (el) {
      el.dataset.nwMeasureKey = measureKey;
      idToNodeRef.current.set(id, el);
      nodeToKeyRef.current.set(el, measureKey);
      rowObserverRef.current?.observe(el);
      const measured = Math.ceil(el.getBoundingClientRect().height);
      if (measured > 0) {
        const prevHeight = measuredHeightsRef.current.get(measureKey);
        if (prevHeight === undefined || Math.abs(prevHeight - measured) >= 1) {
          measuredHeightsRef.current.set(measureKey, measured);
          setMeasureVersion((v) => v + 1);
        }
      }
    }
  }, []);

  const handleScroll = useCallback((e) => {
    latestScrollTopRef.current = e.currentTarget.scrollTop;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      setScrollTop(latestScrollTopRef.current);
    });
  }, []);

  // Reset scroll to top if list shrinks below current scroll position
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (wrapper.scrollTop > 0 && words.length === 0) {
      wrapper.scrollTop = 0;
      setScrollTop(0);
    }
  }, [words.length]);

  const { offsets, totalHeight } = useMemo(() => {
    const count = words.length;
    const pos = new Float64Array(count + 1);
    const defaultRowHeight = isMobileLayout
      ? ESTIMATED_ROW_MOBILE
      : ESTIMATED_ROW_DESKTOP;
    // Matches `margin-block-end: 0.875rem` (14px) on stacked mobile cards in index.css
    const rowGap = isMobileLayout ? 14 : 0;
    let y = 0;
    for (let i = 0; i < count; i += 1) {
      pos[i] = y;
      const item = words[i];
      const isEditing = editingId === item.id;
      const measureKey = `${item.id}:${isEditing ? 1 : 0}`;
      const fallback = isEditing ? ESTIMATED_ROW_EDIT : defaultRowHeight;
      const h = measuredHeightsRef.current.get(measureKey) ?? fallback;
      y += h + (i < count - 1 ? rowGap : 0);
    }
    pos[count] = y;
    return { offsets: pos, totalHeight: y };
    // measureVersion intentionally invalidates prefix sums after ResizeObserver updates
  }, [words, editingId, isMobileLayout, measureVersion]);

  const count = words.length;
  const headerHeight = isMobileLayout ? 0 : theadRef.current?.offsetHeight || 41;
  const bodyScrollTop = Math.max(0, scrollTop - headerHeight);
  const clampedScrollTop = Math.min(
    bodyScrollTop,
    Math.max(0, totalHeight - viewportHeight)
  );
  const rawStart = findFirstIndexAfter(offsets, count, clampedScrollTop);
  const rawEnd = findFirstIndexAfter(
    offsets,
    count,
    clampedScrollTop + viewportHeight
  );
  const startIdx = Math.max(0, rawStart - VIRTUAL_OVERSCAN);
  const endIdx = Math.min(count, rawEnd + 1 + VIRTUAL_OVERSCAN);

  const visibleWords = useMemo(
    () => words.slice(startIdx, endIdx),
    [words, startIdx, endIdx]
  );
  const topSpacerHeight = offsets[startIdx] || 0;
  const bottomSpacerHeight = Math.max(0, totalHeight - (offsets[endIdx] || 0));

  const handleSpeak = useCallback(
    (item) => {
      speakWord(item.word, lang, {
        onStart: () => setSpeakingId(item.id),
        onEnd: () => setSpeakingId((curr) => (curr === item.id ? null : curr)),
        onError: () =>
          setSpeakingId((curr) => (curr === item.id ? null : curr)),
      });
    },
    [lang]
  );

  const handleStartEdit = useCallback((item) => {
    setConfirmDeleteId(null);
    setEditingId(item.id);
    setDraft({
      word: item.word || '',
      phonetic: item.phonetic || '',
      meaning: item.meaning || '',
      context: item.context || '',
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }, []);

  const handleDraftChange = useCallback((field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmitEdit = useCallback(
    async (id) => {
      const currentDraft = draftRef.current;
      setSavingId(id);
      try {
        await onSaveEdit({
          id,
          word: cleanWordText(currentDraft.word),
          phonetic: currentDraft.phonetic.trim(),
          meaning: currentDraft.meaning.trim(),
          context: currentDraft.context.trim(),
        });
        setEditingId(null);
      } finally {
        setSavingId(null);
      }
    },
    [onSaveEdit]
  );

  const handleRequestDelete = useCallback((id) => {
    setConfirmDeleteId(id);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const handleConfirmDelete = useCallback(
    async (id) => {
      setDeletingId(id);
      try {
        await onDelete(id);
        setConfirmDeleteId(null);
      } finally {
        setDeletingId(null);
      }
    },
    [onDelete]
  );

  if (words.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        {t.empty}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      onScroll={handleScroll}
      tabIndex={0}
      role="region"
      aria-labelledby="word-table-caption"
      className="word-table-wrapper rounded-2xl border border-slate-200 bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <table className="word-table text-left text-sm">
        <caption id="word-table-caption" className="sr-only">
          {t.caption}
        </caption>
        <thead
          ref={theadRef}
          className="bg-blue-50/60 text-xs font-semibold uppercase tracking-wide text-blue-900/75"
        >
          <tr>
            <th scope="col" className="word-col-word border-b border-blue-100 px-4 py-3">
              {t.colWord}
            </th>
            <th scope="col" className="word-col-meaning border-b border-blue-100 px-4 py-3">
              {t.colMeaning}
            </th>
            <th scope="col" className="word-col-context border-b border-blue-100 px-4 py-3">
              {t.colContext}
            </th>
            <th scope="col" className="word-col-next border-b border-blue-100 px-4 py-3">
              {t.colNext}
            </th>
            <th
              scope="col"
              className="word-col-actions border-b border-blue-100 px-4 py-3 text-right"
            >
              {t.colActions}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {topSpacerHeight > 0 && (
            <tr aria-hidden="true" className="word-table-spacer">
              <td
                colSpan={5}
                style={{ height: topSpacerHeight, padding: 0, border: 0 }}
              />
            </tr>
          )}
          {visibleWords.map((item) => {
            const isEditing = editingId === item.id;
            const measureKey = `${item.id}:${isEditing ? 1 : 0}`;
            return (
              <WordTableRow
                key={item.id}
                item={item}
                measureKey={measureKey}
                rowRef={registerRowRef}
                isEditing={isEditing}
                draft={isEditing ? draft : null}
                isSaving={savingId === item.id}
                isConfirmingDelete={confirmDeleteId === item.id}
                isDeleting={deletingId === item.id}
                isSpeaking={speakingId === item.id}
                speechAvailable={speechAvailable}
                lang={lang}
                uiLang={uiLang}
                t={t}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onSubmitEdit={handleSubmitEdit}
                onDraftChange={handleDraftChange}
                onRequestDelete={handleRequestDelete}
                onCancelDelete={handleCancelDelete}
                onConfirmDelete={handleConfirmDelete}
                onSpeak={handleSpeak}
              />
            );
          })}
          {bottomSpacerHeight > 0 && (
            <tr aria-hidden="true" className="word-table-spacer">
              <td
                colSpan={5}
                style={{ height: bottomSpacerHeight, padding: 0, border: 0 }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

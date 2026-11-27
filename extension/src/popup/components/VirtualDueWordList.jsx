import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DueWordCard from './DueWordCard';

const VIRTUAL_VIEWPORT_HEIGHT = 280;
const VIRTUAL_ITEM_GAP = 8;
const VIRTUAL_OVERSCAN = 2;
const VIRTUAL_ESTIMATED_EXPANDED = 92;
const VIRTUAL_ESTIMATED_COLLAPSED = 70;

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

export default function VirtualDueWordList({
  words,
  showMeanings,
  revealedIds,
  speechAvailable,
  speakingId,
  sheetLang,
  t,
  onToggleReveal,
  onSpeak,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [measureVersion, setMeasureVersion] = useState(0);
  const measuredHeightsRef = useRef(new Map());
  const nodeToIdRef = useRef(new Map());
  const idToNodeRef = useRef(new Map());
  const observerRef = useRef(null);
  const rafRef = useRef(null);
  const latestScrollTopRef = useRef(0);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const measureKey =
          entry.target.dataset?.nwMeasureKey ||
          nodeToIdRef.current.get(entry.target);
        if (!measureKey) continue;
        const nextHeight = Math.ceil(
          entry.target.offsetHeight || entry.contentRect.height
        );
        if (nextHeight <= 0) continue;
        const prevHeight = measuredHeightsRef.current.get(measureKey);
        if (prevHeight === undefined || Math.abs(prevHeight - nextHeight) >= 1) {
          measuredHeightsRef.current.set(measureKey, nextHeight);
          changed = true;
        }
      }
      if (changed) {
        setMeasureVersion((v) => v + 1);
      }
    });

    observerRef.current = ro;
    for (const el of nodeToIdRef.current.keys()) {
      ro.observe(el);
    }

    return () => {
      ro.disconnect();
      observerRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const registerRowRef = useCallback((id, measureKey, el) => {
    const prevEl = idToNodeRef.current.get(id);
    if (prevEl && prevEl !== el) {
      observerRef.current?.unobserve(prevEl);
      nodeToIdRef.current.delete(prevEl);
      idToNodeRef.current.delete(id);
    }

    if (el) {
      el.dataset.nwMeasureKey = measureKey;
      idToNodeRef.current.set(id, el);
      nodeToIdRef.current.set(el, measureKey);
      observerRef.current?.observe(el);
      const measured = Math.ceil(el.offsetHeight);
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
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(latestScrollTopRef.current);
    });
  }, []);

  const { offsets, totalHeight } = useMemo(() => {
    const count = words.length;
    const pos = new Float64Array(count + 1);
    let y = 0;
    for (let i = 0; i < count; i += 1) {
      pos[i] = y;
      const item = words[i];
      const isRevealed = showMeanings || revealedIds.has(item.id);
      const measureKey = `${item.id}:${isRevealed ? 1 : 0}`;
      const fallback = isRevealed
        ? VIRTUAL_ESTIMATED_EXPANDED
        : VIRTUAL_ESTIMATED_COLLAPSED;
      const h = measuredHeightsRef.current.get(measureKey) ?? fallback;
      y += h + (i < count - 1 ? VIRTUAL_ITEM_GAP : 0);
    }
    pos[count] = y;
    return { offsets: pos, totalHeight: y };
    // measureVersion intentionally invalidates cached prefix sums after ResizeObserver updates
  }, [words, showMeanings, revealedIds, measureVersion]);

  const count = words.length;
  const clampedScrollTop = Math.min(
    scrollTop,
    Math.max(0, totalHeight - VIRTUAL_VIEWPORT_HEIGHT)
  );
  const rawStart = findFirstIndexAfter(offsets, count, clampedScrollTop);
  const rawEnd = findFirstIndexAfter(
    offsets,
    count,
    clampedScrollTop + VIRTUAL_VIEWPORT_HEIGHT
  );
  const startIdx = Math.max(0, rawStart - VIRTUAL_OVERSCAN);
  const endIdx = Math.min(count, rawEnd + 1 + VIRTUAL_OVERSCAN);

  return (
    <div
      onScroll={handleScroll}
      style={{ maxHeight: VIRTUAL_VIEWPORT_HEIGHT }}
      className="overflow-y-auto pr-0.5"
    >
      <ul
        style={{ height: totalHeight, position: 'relative' }}
        className="m-0 list-none p-0"
      >
        {words.slice(startIdx, endIdx).map((item, idx) => {
          const actualIdx = startIdx + idx;
          const isRevealed = showMeanings || revealedIds.has(item.id);
          const measureKey = `${item.id}:${isRevealed ? 1 : 0}`;
          return (
            <li
              key={item.id}
              data-nw-measure-key={measureKey}
              ref={(el) => registerRowRef(item.id, measureKey, el)}
              style={{
                position: 'absolute',
                top: offsets[actualIdx],
                left: 0,
                right: 0,
              }}
            >
              <DueWordCard
                item={item}
                isRevealed={isRevealed}
                speechAvailable={speechAvailable}
                isSpeaking={speakingId === item.id}
                sheetLang={sheetLang}
                t={t}
                onToggleReveal={onToggleReveal}
                onSpeak={onSpeak}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { useMemo } from 'react';

export default function WordBlankInputs({
  word,
  blankIndices,
  blankSet,
  inputs,
  isFailed,
  wrongIndexSet,
  inputRefs,
  lastFocusedBlankIdxRef,
  inputAria,
  onInputChange,
  onInputKeyDown,
  onPaste,
}) {
  const blankPosMap = useMemo(() => {
    const map = new Map();
    blankIndices.forEach((charIdx, pos) => {
      map.set(charIdx, pos);
    });
    return map;
  }, [blankIndices]);

  const tokenGroups = useMemo(() => {
    const chars = Array.from(String(word || ''));
    const groups = [];
    let currentWordTokens = [];

    chars.forEach((ch, idx) => {
      if (/\s/.test(ch)) {
        if (currentWordTokens.length > 0) {
          groups.push({ type: 'word', items: currentWordTokens });
          currentWordTokens = [];
        }
        groups.push({ type: 'space', index: idx, char: ch });
      } else {
        currentWordTokens.push({ index: idx, char: ch });
      }
    });

    if (currentWordTokens.length > 0) {
      groups.push({ type: 'word', items: currentWordTokens });
    }
    return groups;
  }, [word]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-5">
      {tokenGroups.map((group, groupIdx) => {
        if (group.type === 'space') {
          return (
            <span key={`space-${group.index}-${groupIdx}`} className="w-1" />
          );
        }

        return (
          <div
            key={`word-${groupIdx}`}
            className="inline-flex flex-wrap items-baseline justify-center gap-1"
          >
            {group.items.map(({ index, char }) => {
              if (!blankSet.has(index)) {
                return (
                  <span
                    key={index}
                    className="inline-flex h-10 min-w-[14px] items-center justify-center font-mono text-xl font-bold text-slate-800 sm:text-2xl"
                  >
                    {char}
                  </span>
                );
              }

              const blankPos = blankPosMap.get(index) ?? 0;
              return (
                <input
                  key={index}
                  ref={(el) => {
                    if (el) {
                      inputRefs.current[index] = el;
                    } else {
                      delete inputRefs.current[index];
                    }
                  }}
                  type="text"
                  maxLength={1}
                  value={inputs[index] || ''}
                  disabled={isFailed}
                  onFocus={() => {
                    lastFocusedBlankIdxRef.current = index;
                  }}
                  onChange={(e) =>
                    onInputChange(index, blankPos, e.target.value)
                  }
                  onKeyDown={(e) => onInputKeyDown(e, index, blankPos)}
                  onPaste={(e) => onPaste(e, blankPos)}
                  aria-label={inputAria(blankPos + 1, blankIndices.length)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={`h-10 w-8 border-b-2 bg-transparent text-center font-mono text-xl font-bold transition-colors focus:outline-none sm:w-9 sm:text-2xl ${
                    isFailed
                      ? wrongIndexSet.has(index)
                        ? 'border-rose-500 text-rose-700'
                        : 'border-emerald-500 text-emerald-700'
                      : 'border-blue-500 text-blue-700 focus:border-blue-700'
                  }`}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

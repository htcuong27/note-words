import { escapeRegExp } from '../../utils/text';

export default function MaskedContext({ context, word }) {
  if (!context) return null;
  const trimmedWord = String(word || '').trim();
  if (!trimmedWord) return <span>{context}</span>;

  const regex = new RegExp(`(${escapeRegExp(trimmedWord)})`, 'gi');
  const parts = String(context).split(regex);

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === trimmedWord.toLowerCase() ? (
          <span
            key={idx}
            aria-hidden="true"
            className="mx-0.5 inline-block rounded bg-blue-100/80 px-2 py-0.5 font-mono text-xs font-semibold tracking-widest text-blue-700"
          >
            _____
          </span>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  );
}

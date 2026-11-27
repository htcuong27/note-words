import { memo } from 'react';
import {
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { HighlightedContext } from './Flashcard';
import PhoneticBadge from './PhoneticBadge';
import { isWordDue } from '../utils/sm2';

const WordTableRow = memo(function WordTableRow({
  item,
  isEditing,
  draft,
  isSaving,
  isConfirmingDelete,
  isDeleting,
  isSpeaking,
  speechAvailable,
  lang,
  uiLang,
  t,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDraftChange,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onSpeak,
}) {
  const isDue = isWordDue(item);
  const safeUrl =
    item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl)
      ? item.sourceUrl
      : '';

  return (
    <tr className="align-top transition-colors hover:bg-blue-50/30">
      {/* Sticky Row Header: Word */}
      <th scope="row" className="px-4 py-3.5 font-semibold text-slate-900">
        {isEditing ? (
          <div className="space-y-1.5">
            <input
              type="text"
              value={draft.word}
              onChange={(e) => onDraftChange('word', e.target.value)}
              aria-label={t.editWordAria}
              className="w-full min-w-[120px] rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
            <input
              type="text"
              value={draft.phonetic}
              onChange={(e) => onDraftChange('phonetic', e.target.value)}
              aria-label={t.editPhoneticAria}
              placeholder={t.editPhoneticPlaceholder}
              className="w-full min-w-[120px] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-normal text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-slate-900">
                {item.word}
              </span>
              {speechAvailable && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSpeak(item)}
                  aria-label={t.pronounceBtnAria(item.word)}
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    isSpeaking
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div>
              <PhoneticBadge
                word={item.word}
                phonetic={item.phonetic}
                lang={lang}
                uiLang={uiLang}
                size="sm"
                className="justify-start"
              />
            </div>
            {safeUrl && (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-normal text-blue-600 hover:underline"
              >
                <ExternalLink
                  className="h-3 w-3 shrink-0"
                  aria-hidden="true"
                />
                <span>{t.source}</span>
              </a>
            )}
          </div>
        )}
      </th>

      {/* Meaning */}
      <td className="px-4 py-3.5 text-slate-700">
        {isEditing ? (
          <input
            type="text"
            value={draft.meaning}
            onChange={(e) => onDraftChange('meaning', e.target.value)}
            aria-label={t.editMeaningAria}
            placeholder={t.editMeaningPlaceholder}
            className="w-full min-w-[160px] rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          />
        ) : (
          <span>
            {item.meaning || (
              <span className="italic text-slate-400">{t.noMeaning}</span>
            )}
          </span>
        )}
      </td>

      {/* Context */}
      <td className="max-w-md px-4 py-3.5 text-slate-600">
        {isEditing ? (
          <textarea
            rows={2}
            value={draft.context}
            onChange={(e) => onDraftChange('context', e.target.value)}
            aria-label={t.editContextAria}
            placeholder={t.editContextPlaceholder}
            className="w-full min-w-[200px] rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          />
        ) : (
          <p className="leading-relaxed">
            <HighlightedContext
              context={item.context}
              word={item.word}
              uiLang={uiLang}
            />
          </p>
        )}
      </td>

      {/* Next Review / SM-2 */}
      <td className="whitespace-nowrap px-4 py-3.5">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isDue
              ? 'bg-blue-100 text-blue-800'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {item.nextReviewDate || t.today}
        </span>
        <div className="mt-1 text-xs text-slate-400">
          Rep {item.repetition ?? 0} · {item.interval ?? 0}d · EF{' '}
          {item.easeFactor ?? 2.5}
        </div>
      </td>

      {/* Actions */}
      <td className="whitespace-nowrap px-4 py-3.5 text-right">
        {isEditing ? (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              disabled={isSaving || !draft.word.trim()}
              onClick={() => onSubmitEdit(item.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {t.save}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onCancelEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t.cancel}
            </button>
          </div>
        ) : isConfirmingDelete ? (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onConfirmDelete(item.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {isDeleting && (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              )}
              {t.confirmDelete}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onCancelDelete}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {t.cancel}
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => onStartEdit(item)}
              aria-label={t.editBtnAria(item.word)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(item.id)}
              aria-label={t.deleteBtnAria(item.word)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-rose-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
});

export default WordTableRow;

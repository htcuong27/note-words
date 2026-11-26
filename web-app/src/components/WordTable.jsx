import { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Pencil, Trash2, Volume2, X } from 'lucide-react';
import { HighlightedContext } from './Flashcard';
import { isWordDue } from '../utils/sm2';
import { getTranslations } from '../utils/i18n';
import { isSpeechSupported, speakWord, stopSpeaking } from '../utils/speech';

export default function WordTable({
  words,
  onSaveEdit,
  onDelete,
  lang = 'English',
  uiLang = 'vi',
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ word: '', meaning: '', context: '' });
  const [savingId, setSavingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);

  const t = getTranslations(uiLang).table;
  const speechAvailable = isSpeechSupported();

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const handleSpeak = (item) => {
    speakWord(item.word, lang, {
      onStart: () => setSpeakingId(item.id),
      onEnd: () => setSpeakingId((curr) => (curr === item.id ? null : curr)),
      onError: () => setSpeakingId((curr) => (curr === item.id ? null : curr)),
    });
  };

  const startEdit = (item) => {
    setConfirmDeleteId(null);
    setEditingId(item.id);
    setDraft({
      word: item.word || '',
      meaning: item.meaning || '',
      context: item.context || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ word: '', meaning: '', context: '' });
  };

  const submitEdit = async (id) => {
    setSavingId(id);
    try {
      await onSaveEdit({
        id,
        word: draft.word.trim(),
        meaning: draft.meaning.trim(),
        context: draft.context.trim(),
      });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = async (id) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (words.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        {t.empty}
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby="word-table-caption"
      className="word-table-wrapper rounded-2xl border border-slate-200 bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <table className="word-table text-left text-sm">
        <caption id="word-table-caption" className="sr-only">
          {t.caption}
        </caption>
        <thead className="bg-blue-50/60 text-xs font-semibold uppercase tracking-wide text-blue-900/75">
          <tr>
            <th scope="col" className="border-b border-blue-100 px-4 py-3">
              {t.colWord}
            </th>
            <th scope="col" className="border-b border-blue-100 px-4 py-3">
              {t.colMeaning}
            </th>
            <th scope="col" className="border-b border-blue-100 px-4 py-3">
              {t.colContext}
            </th>
            <th scope="col" className="border-b border-blue-100 px-4 py-3">
              {t.colNext}
            </th>
            <th scope="col" className="border-b border-blue-100 px-4 py-3 text-right">
              {t.colActions}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {words.map((item) => {
            const isEditing = editingId === item.id;
            const isSaving = savingId === item.id;
            const isDeleting = deletingId === item.id;
            const isDue = isWordDue(item);
            const safeUrl =
              item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl)
                ? item.sourceUrl
                : '';

            return (
              <tr
                key={item.id}
                className="align-top transition-colors hover:bg-blue-50/30"
              >
                {/* Sticky Row Header: Word */}
                <th scope="row" className="px-4 py-3.5 font-semibold text-slate-900">
                  {isEditing ? (
                    <input
                      type="text"
                      value={draft.word}
                      onChange={(e) => setDraft((d) => ({ ...d, word: e.target.value }))}
                      aria-label={t.editWordAria}
                      className="w-full min-w-[120px] rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                    />
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
                            onClick={() => handleSpeak(item)}
                            aria-label={t.pronounceBtnAria(item.word)}
                            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                              speakingId === item.id
                                ? 'bg-blue-600 text-white'
                                : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                            }`}
                          >
                            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {safeUrl && (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-normal text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
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
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, meaning: e.target.value }))
                      }
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
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, context: e.target.value }))
                      }
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
                        onClick={() => submitEdit(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {t.save}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.cancel}
                      </button>
                    </div>
                  ) : confirmDeleteId === item.id ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => confirmDelete(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {isDeleting && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        )}
                        {t.confirmDelete}
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label={t.editBtnAria(item.word)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
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
          })}
        </tbody>
      </table>
    </div>
  );
}

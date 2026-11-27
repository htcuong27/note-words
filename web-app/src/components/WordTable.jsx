import { useCallback, useEffect, useRef, useState } from 'react';
import WordTableRow from './WordTableRow';
import { cleanWordText } from '../utils/api';
import { getTranslations } from '../utils/i18n';
import { isSpeechSupported, speakWord, stopSpeaking } from '../utils/speech';

const EMPTY_DRAFT = {
  word: '',
  phonetic: '',
  meaning: '',
  context: '',
};

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

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const t = getTranslations(uiLang).table;
  const speechAvailable = isSpeechSupported();

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

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
            <th
              scope="col"
              className="border-b border-blue-100 px-4 py-3 text-right"
            >
              {t.colActions}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {words.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <WordTableRow
                key={item.id}
                item={item}
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
        </tbody>
      </table>
    </div>
  );
}

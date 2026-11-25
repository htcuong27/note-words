import { useState } from 'react';
import { Check, ExternalLink, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { HighlightedContext } from './Flashcard';
import { isWordDue } from '../utils/sm2';

export default function WordTable({ words, onSaveEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ word: '', meaning: '', context: '' });
  const [savingId, setSavingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
        Không tìm thấy từ vựng nào phù hợp.
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-labelledby="word-table-caption"
      className="word-table-wrapper rounded-2xl border border-slate-200 bg-white shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <table className="word-table text-left text-sm">
        <caption id="word-table-caption" className="sr-only">
          Danh sách từ vựng đã lưu và lịch ôn tập SM-2
        </caption>
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="border-b border-slate-200 px-4 py-3">
              Từ vựng
            </th>
            <th scope="col" className="border-b border-slate-200 px-4 py-3">
              Nghĩa (VI)
            </th>
            <th scope="col" className="border-b border-slate-200 px-4 py-3">
              Ngữ cảnh
            </th>
            <th scope="col" className="border-b border-slate-200 px-4 py-3">
              Ôn kế tiếp
            </th>
            <th scope="col" className="border-b border-slate-200 px-4 py-3 text-right">
              Thao tác
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
                className="align-top transition-colors hover:bg-slate-50/70"
              >
                {/* Sticky Row Header: Word */}
                <th scope="row" className="px-4 py-3.5 font-semibold text-slate-900">
                  {isEditing ? (
                    <input
                      type="text"
                      value={draft.word}
                      onChange={(e) => setDraft((d) => ({ ...d, word: e.target.value }))}
                      aria-label="Sửa từ vựng"
                      className="w-full min-w-[120px] rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="text-base font-bold text-slate-900">
                        {item.word}
                      </div>
                      {safeUrl && (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-normal text-indigo-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>Nguồn</span>
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
                      onChange={(e) => setDraft((d) => ({ ...d, meaning: e.target.value }))}
                      aria-label="Sửa nghĩa tiếng Việt"
                      placeholder="Nhập nghĩa tiếng Việt..."
                      className="w-full min-w-[160px] rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  ) : (
                    <span>
                      {item.meaning || (
                        <span className="italic text-slate-400">Chưa có nghĩa</span>
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
                      onChange={(e) => setDraft((d) => ({ ...d, context: e.target.value }))}
                      aria-label="Sửa câu ngữ cảnh"
                      placeholder="Nhập câu ngữ cảnh..."
                      className="w-full min-w-[200px] rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  ) : (
                    <p className="leading-relaxed">
                      <HighlightedContext context={item.context} word={item.word} />
                    </p>
                  )}
                </td>

                {/* Next Review / SM-2 */}
                <td className="whitespace-nowrap px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isDue
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.nextReviewDate || 'Hôm nay'}
                  </span>
                  <div className="mt-1 text-xs text-slate-400">
                    Rep {item.repetition ?? 0} · {item.interval ?? 0}d · EF {item.easeFactor ?? 2.5}
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
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Lưu
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Hủy
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
                        Xóa hẳn
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label={`Sửa từ ${item.word}`}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label={`Xóa từ ${item.word}`}
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

import { CloudUpload } from 'lucide-react';

export default function ReviewProgress({
  t,
  remainingCount,
  reviewedCount,
  pendingSyncs,
  progressPercent,
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {t.remainingPrefix}{' '}
          <strong className="text-slate-800">{remainingCount}</strong>{' '}
          {t.remainingUnit} · {t.answeredPrefix}{' '}
          <strong className="text-slate-800">{reviewedCount}</strong>{' '}
          {t.answeredUnit}
        </span>
        <span className="inline-flex items-center gap-1">
          {pendingSyncs > 0 ? (
            <>
              <CloudUpload
                className="h-3.5 w-3.5 animate-pulse text-blue-600"
                aria-hidden="true"
              />
              <span className="font-medium text-blue-600">
                {t.syncing(pendingSyncs)}
              </span>
            </>
          ) : (
            <span>{t.completedPct(progressPercent)}</span>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

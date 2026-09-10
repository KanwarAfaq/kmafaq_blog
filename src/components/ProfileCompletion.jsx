import { CheckCircle2 } from 'lucide-react';

export default function ProfileCompletion({ percent }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-violet-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold text-ink">Profile completeness</p>
          <p className="mt-1 text-xs text-gray-600">A complete profile gives you better personalization.</p>
        </div>
        <span className="text-2xl font-black text-primary">{percent}%</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all" style={{ width: `${percent}%` }} />
      </div>
      {percent === 100 && (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Profile complete
        </p>
      )}
    </div>
  );
}

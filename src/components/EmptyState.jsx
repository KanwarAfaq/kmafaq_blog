import { FileText } from 'lucide-react';

export default function EmptyState({ title = 'Nothing here yet', description }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <FileText className="mx-auto h-10 w-10 text-gray-400" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">{description}</p>}
    </div>
  );
}

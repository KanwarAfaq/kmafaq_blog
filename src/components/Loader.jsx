export default function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-40 items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}

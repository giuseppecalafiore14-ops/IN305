import { AlertCircle } from 'lucide-react';

export function ErrorBanner({ message, className = '' }: { message: string; className?: string }) {
  return (
    <div className={`bg-error-50 border border-error-200 text-error-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2 ${className}`}>
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

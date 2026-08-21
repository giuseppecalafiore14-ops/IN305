import type { LucideIcon } from 'lucide-react';
import { Link } from '@/lib/router';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, onAction, className = '' }: EmptyStateProps) {
  return (
    <div className={`card p-10 sm:p-12 text-center ${className}`}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-ink-50 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-6 h-6 text-ink-400" />
        </div>
      )}
      <p className="text-ink-900 font-semibold text-lg mb-1">{title}</p>
      {description && <p className="text-ink-500 mb-6 max-w-sm mx-auto">{description}</p>}
      {actionLabel && actionHref && (
        <Link to={actionHref} className="btn-accent">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button onClick={onAction} className="btn-accent">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

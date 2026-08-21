import { ArrowRight } from 'lucide-react';
import { Link } from '@/lib/router';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  dark?: boolean;
  className?: string;
}

export function SectionHeader({ eyebrow, title, seeAllHref, seeAllLabel = 'View all', dark = false, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-6 ${className}`}>
      <div>
        {eyebrow && <p className={`section-label mb-2 ${dark ? 'text-accent-400' : ''}`}>{eyebrow}</p>}
        <h2 className={`font-display text-3xl sm:text-4xl tracking-tightest ${dark ? 'text-white' : 'text-ink-900'}`}>{title}</h2>
      </div>
      {seeAllHref && (
        <Link
          to={seeAllHref}
          className={`hidden sm:flex items-center gap-1 text-sm font-semibold shrink-0 transition-colors ${dark ? 'text-cream-200 hover:text-accent-400' : 'text-ink-600 hover:text-accent-600'}`}
        >
          {seeAllLabel} <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

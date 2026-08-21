import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Carousel({ children, className = '' }: { children: ReactNode; className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scroll(direction: 'left' | 'right') {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -el.clientWidth * 0.8 : el.clientWidth * 0.8, behavior: 'smooth' });
  }

  return (
    <div className={`relative group/carousel ${className}`}>
      <div ref={trackRef} className="carousel-track">
        {children}
      </div>
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scroll('left')}
        className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-ink-100 shadow-lifted items-center justify-center text-ink-600 hover:text-ink-900 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scroll('right')}
        className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-ink-100 shadow-lifted items-center justify-center text-ink-600 hover:text-ink-900 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

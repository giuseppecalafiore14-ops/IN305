import { useState, useRef, useEffect } from 'react';
import { Share2, Link2, Check } from 'lucide-react';

interface ShareButtonProps {
  title: string;
  text?: string;
  url: string;
  className?: string;
  variant?: 'default' | 'overlay';
}

export function ShareButton({ title, text, url, className = '', variant = 'default' }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user cancelled the native share sheet — no-op
      }
      return;
    }
    setOpen(!open);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {variant === 'overlay' ? (
        <button onClick={handleClick} className="p-2.5 bg-black/20 backdrop-blur-sm rounded-full text-white/90 hover:text-white transition-colors" aria-haspopup="true" aria-expanded={open} aria-label="Share">
          <Share2 className="w-5 h-5" />
        </button>
      ) : (
        <button onClick={handleClick} className="btn-secondary" aria-haspopup="true" aria-expanded={open}>
          <Share2 className="w-4 h-4" /> Share
        </button>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-56 card p-2 z-20 animate-scale-in origin-top-right">
          <button onClick={copyLink} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors">
            {copied ? <Check className="w-4 h-4 text-success-500" /> : <Link2 className="w-4 h-4" />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.876.52 3.63 1.42 5.13L2 22l4.998-1.31A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.524 2 12.001 2zm0 18.09c-1.65 0-3.19-.46-4.5-1.26l-.323-.192-3.05.8.815-2.973-.21-.306A7.93 7.93 0 014 12c0-4.41 3.59-8 8.001-8C16.412 4 20 7.59 20 12s-3.588 8.09-7.999 8.09z"/></svg>
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

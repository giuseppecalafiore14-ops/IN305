const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-2xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-24 h-24 text-3xl',
} as const;

export type AvatarSize = keyof typeof SIZE_CLASSES;

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
  ring?: boolean;
  className?: string;
}

export function Avatar({ src, name, size = 'md', ring = false, className = '' }: AvatarProps) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? 'U';
  return (
    <div
      className={`shrink-0 rounded-full bg-accent-100 flex items-center justify-center text-accent-700 font-bold overflow-hidden ${SIZE_CLASSES[size]} ${ring ? 'ring-2 ring-white' : ''} ${className}`}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initial}
    </div>
  );
}

import { Avatar, type AvatarSize } from '@/components/Avatar';

interface StackItem {
  src?: string | null;
  name?: string | null;
}

export function AvatarStack({ people, max = 4, size = 'sm' }: { people: StackItem[]; max?: number; size?: AvatarSize }) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div className="flex items-center -space-x-2.5">
      {visible.map((p, i) => (
        <Avatar key={i} src={p.src} name={p.name} size={size} ring />
      ))}
      {overflow > 0 && (
        <div className="shrink-0 rounded-full bg-ink-800 text-cream-50 font-semibold flex items-center justify-center ring-2 ring-white w-8 h-8 text-2xs">
          +{overflow}
        </div>
      )}
    </div>
  );
}

import { Users, MapPin, Clock, Lock, Crown, Star, Repeat } from 'lucide-react';
import type { GroupWithRelations } from '@/types';
import { Link } from '@/lib/router';
import { Avatar } from '@/components/Avatar';
import { AvatarStack } from '@/components/AvatarStack';
import { formatDateShort } from '@/lib/format';
import { formatCurrency } from '@/lib/pricing';

interface PreviewMember {
  src?: string | null;
  name?: string | null;
}

interface GroupCardProps {
  group: GroupWithRelations;
  previewMembers?: PreviewMember[];
  linkTo?: string;
}

export function GroupCard({ group, previewMembers, linkTo }: GroupCardProps) {
  const spotsLeft = group.max_participants - group.current_participants;
  const isFull = spotsLeft <= 0;
  const fillPercent = (group.current_participants / group.max_participants) * 100;

  return (
    <Link to={linkTo ?? `/groups/${group.slug}`} className="card card-hover overflow-hidden group block">
      <div className="relative h-48 bg-gradient-to-br from-ink-700 to-ink-900 overflow-hidden">
        {group.cover_image_url ? (
          <img src={group.cover_image_url} alt={group.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-4xl text-white/25 tracking-tightest uppercase">{group.activity?.name ?? 'Activity'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent" />

        <div className="absolute top-3 left-3 flex gap-1.5">
          {group.activity && (
            <span className="badge bg-white/95 backdrop-blur-sm text-ink-900">{group.activity.name}</span>
          )}
          {group.visibility === 'members_only' && (
            <span className="badge bg-ink-900/80 backdrop-blur-sm text-cream-50 flex items-center gap-1">
              <Crown className="w-3 h-3" /> Members
            </span>
          )}
          {group.visibility === 'private' && (
            <span className="badge bg-ink-900/80 backdrop-blur-sm text-cream-50 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Private
            </span>
          )}
        </div>
        {group.is_featured && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-accent-500 text-white flex items-center gap-1">
              <Star className="w-2.5 h-2.5 fill-current" /> Featured
            </span>
          </div>
        )}
        {group.status === 'draft' && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-warning-500 text-ink-900">Draft</span>
          </div>
        )}
        {group.status === 'canceled' && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-error-500 text-white">Cancelled</span>
          </div>
        )}
        {group.status === 'completed' && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-ink-900/80 backdrop-blur-sm text-white">Completed</span>
          </div>
        )}

        {group.host && (
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <Avatar src={group.host.avatar_url} name={group.host.first_name} size="xs" ring />
            <span className="text-xs font-medium text-white/90 drop-shadow">{group.host.first_name ?? 'Host'}</span>
          </div>
        )}
        {group.cost > 0 && (
          <div className="absolute bottom-3 right-3">
            <span className="badge bg-accent-500 text-white">{formatCurrency(group.cost)}</span>
          </div>
        )}
        {group.recurring && group.recurring.length > 0 && group.cost <= 0 && (
          <div className="absolute bottom-3 right-3">
            <span className="badge bg-white/15 backdrop-blur-sm text-white border border-white/20 flex items-center gap-1">
              <Repeat className="w-2.5 h-2.5" /> Recurring
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-ink-900 text-lg leading-tight mb-2 line-clamp-1 group-hover:text-accent-600 transition-colors">
          {group.title}
        </h3>

        <div className="flex items-center gap-3 text-xs text-ink-500 mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDateShort(group.start_time)}
          </span>
          {group.neighborhood && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {group.neighborhood.name}
            </span>
          )}
          {group.vibe && <span className="text-ink-400">{group.vibe}</span>}
        </div>

        <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden mb-2.5">
          <div
            className={`h-full rounded-full transition-all ${isFull ? 'bg-error-500' : fillPercent > 75 ? 'bg-warning-500' : 'bg-success-500'}`}
            style={{ width: `${Math.min(fillPercent, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          {previewMembers && previewMembers.length > 0 ? (
            <div className="flex items-center gap-2">
              <AvatarStack people={previewMembers} max={4} size="xs" />
              <span className="text-xs text-ink-500">
                <span className={`font-bold ${isFull ? 'text-error-500' : 'text-ink-900'}`}>{group.current_participants}</span> going
              </span>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <Users className="w-3.5 h-3.5" />
              <span className={`font-bold ${isFull ? 'text-error-500' : 'text-ink-900'}`}>{group.current_participants}/{group.max_participants}</span>
              {isFull ? 'full' : `· ${spotsLeft} left`}
            </span>
          )}
          <span className={`text-sm font-semibold ${isFull ? 'text-ink-400' : 'text-accent-600'}`}>
            {isFull ? 'Join Waitlist' : group.cost > 0 ? 'Reserve Spot' : 'Join Group'}
          </span>
        </div>
      </div>
    </Link>
  );
}

import { useState, useEffect } from 'react';
import { Menu, X, Compass, Users, Calendar, MessageCircle, Bell, Bookmark, User, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Link, useRouter } from '@/lib/router';
import { canCreateGroup } from '@/lib/permissions';
import { Avatar } from '@/components/Avatar';

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display tracking-tightest ${className}`}>
      IN<span className="text-accent-500">305</span>
    </span>
  );
}

export function Navbar() {
  const { user, profile, membership, signOut } = useAuth();
  const { navigate } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const showCreate = user && canCreateGroup(membership);

  const navLinks = user
    ? [
        { label: 'Discover', to: '/discover' },
        { label: 'Groups', to: '/groups' },
        { label: 'Activities', to: '/activities' },
        { label: 'Saved', to: '/saved' },
      ]
    : [
        { label: 'Discover', to: '/discover' },
        { label: 'Activities', to: '/activities' },
        { label: 'Groups', to: '/groups' },
        { label: 'Events', to: '/events' },
        { label: 'Membership', to: '/membership' },
        { label: 'For Businesses', to: '/business/pricing' },
      ];

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-cream-50/90 backdrop-blur-lg border-b border-ink-100' : 'bg-transparent'}`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1">
            <Wordmark className="text-2xl text-ink-900" />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="px-3.5 py-2 text-sm font-medium text-ink-600 hover:text-ink-900 rounded-lg hover:bg-ink-900/5 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            {showCreate && (
              <button onClick={() => navigate('/create')} className="btn-accent text-sm px-4 py-2.5 mr-1">
                <Plus className="w-4 h-4" />
                Create Group
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-1">
                <Link to="/host" className="btn-ghost text-sm hidden lg:inline-flex">Host</Link>
                <Link to="/business/pricing" className="btn-ghost text-sm hidden lg:inline-flex">For Business</Link>
                <Link to="/notifications" className="relative p-2.5 text-ink-600 hover:text-ink-900 hover:bg-ink-900/5 rounded-full transition-colors">
                  <Bell className="w-5 h-5" />
                </Link>
                <Link to="/messages" className="relative p-2.5 text-ink-600 hover:text-ink-900 hover:bg-ink-900/5 rounded-full transition-colors">
                  <MessageCircle className="w-5 h-5" />
                </Link>
                <Link to="/profile" className="flex items-center gap-2 p-1 pr-3 ml-1 rounded-full hover:bg-ink-900/5 transition-colors">
                  <Avatar src={profile?.avatar_url} name={profile?.first_name} size="sm" />
                  <span className="text-sm font-medium text-ink-700">{profile?.first_name ?? 'Profile'}</span>
                </Link>
                <button onClick={() => signOut()} className="btn-ghost text-sm">Sign Out</button>
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">Sign In</Link>
                <Link to="/signup" className="btn-primary text-sm px-4 py-2.5">Get Started</Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2 text-ink-900" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>

        {mobileOpen && (
          <div className="md:hidden bg-cream-50/98 backdrop-blur-lg border-b border-ink-100 animate-slide-in-right shadow-lifted">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50 rounded-xl">
                  {link.label}
                </Link>
              ))}
              {showCreate && (
                <Link to="/create" onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-base font-medium text-accent-600 hover:bg-accent-50 rounded-xl">
                  Create Group
                </Link>
              )}
              {user ? (
                <>
                  <Link to="/host" onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Host Dashboard</Link>
                  <Link to="/business/pricing" onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50 rounded-xl">For Businesses</Link>
                  <Link to="/messages" onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Messages</Link>
                  <Link to="/notifications" onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Notifications</Link>
                  <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Profile</Link>
                  <Link to="/settings" onClick={() => setMobileOpen(false)} className="block px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Settings</Link>
                  <button onClick={() => { signOut(); setMobileOpen(false); }} className="block w-full text-left px-3 py-3 text-base font-medium text-ink-700 hover:bg-ink-50 rounded-xl">Sign Out</button>
                </>
              ) : (
                <div className="pt-2 space-y-2">
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-secondary w-full">Sign In</Link>
                  <Link to="/signup" onClick={() => setMobileOpen(false)} className="btn-primary w-full">Get Started</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
      <div className="h-16" />
    </>
  );
}

export function MobileNav() {
  const { user, profile, membership } = useAuth();
  const { navigate, path } = useRouter();
  const showCreate = user && canCreateGroup(membership);

  if (!user) return null;

  const items = [
    { label: 'Discover', to: '/discover', icon: Compass },
    { label: 'Groups', to: '/groups', icon: Users },
    { label: 'Create', to: '/create', icon: Plus, prominent: true },
    { label: 'Messages', to: '/messages', icon: MessageCircle },
    { label: 'Profile', to: '/profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-cream-50/95 backdrop-blur-lg border-t border-ink-100">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = path === item.to || (item.to === '/profile' && path.startsWith('/profile'));

          if (item.prominent && !showCreate) {
            return (
              <button key={item.label} onClick={() => navigate('/membership')} className="flex flex-col items-center justify-center gap-1 w-14">
                <div className="w-11 h-11 rounded-full bg-ink-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-ink-400" />
                </div>
                <span className="text-2xs font-medium text-ink-400">Create</span>
              </button>
            );
          }
          if (item.prominent) {
            return (
              <button key={item.label} onClick={() => navigate('/create')} className="flex flex-col items-center justify-center gap-1 w-14 -mt-5">
                <div className="w-12 h-12 rounded-full bg-accent-500 flex items-center justify-center shadow-lifted active:scale-95 transition-transform">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xs font-semibold text-accent-600">Create</span>
              </button>
            );
          }
          return (
            <button key={item.label} onClick={() => navigate(item.to)} className="flex flex-col items-center justify-center gap-1 w-14">
              {item.to === '/profile' ? (
                <Avatar src={profile?.avatar_url} name={profile?.first_name} size="xs" className={isActive ? 'ring-2 ring-ink-900' : ''} />
              ) : (
                <Icon className={`w-5 h-5 ${isActive ? 'text-ink-900' : 'text-ink-400'}`} />
              )}
              <span className={`text-2xs font-medium ${isActive ? 'text-ink-900' : 'text-ink-400'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

import { AuthProvider, useAuth } from '@/lib/auth';
import { RouterProvider, useRouter } from '@/lib/router';
import { Navbar, MobileNav } from '@/components/Navbar';
import { isSupabaseConfigured } from '@/lib/supabase';
import { MissingEnvScreen } from '@/components/MissingEnvScreen';
import { HomePage } from '@/pages/HomePage';
import { DiscoverPage } from '@/pages/DiscoverPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { ActivitiesPage } from '@/pages/ActivitiesPage';
import { EventsPage } from '@/pages/EventsPage';
import { AuthPage } from '@/pages/AuthPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { MembershipPage } from '@/pages/MembershipPage';
import { CreateGroupPage } from '@/pages/CreateGroupPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SavedPage } from '@/pages/SavedPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { AdminPage } from '@/pages/AdminPage';
import { AboutPage } from '@/pages/AboutPage';
import { ForBusinessesPage } from '@/pages/ForBusinessesPage';
import { HostDashboardPage } from '@/pages/HostDashboardPage';
import { ManageGroupPage } from '@/pages/ManageGroupPage';
import { BusinessProfilePage } from '@/pages/BusinessProfilePage';
import { BusinessDashboardPage } from '@/pages/BusinessDashboardPage';
import { BusinessPricingPage } from '@/pages/BusinessPricingPage';
import { CheckoutSuccessPage } from '@/pages/CheckoutSuccessPage';
import { CheckoutCancelPage } from '@/pages/CheckoutCancelPage';

function AppRoutes() {
  const { path } = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <div className="font-display text-4xl tracking-tightest text-ink-900 mb-2">IN305</div>
          <div className="text-ink-400 text-sm animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  // Parse path
  const parts = path.split('/').filter(Boolean);
  const route = parts[0] ?? '';
  const param = parts[1];

  // Auth routes (no nav)
  if (route === 'login') return <AuthPage mode="login" />;
  if (route === 'signup') return <AuthPage mode="signup" />;
  if (route === 'onboarding') return user ? <OnboardingPage /> : <AuthPage mode="signup" />;

  // Protected routes
  const protectedRoutes = ['create', 'profile', 'messages', 'saved', 'notifications', 'settings', 'admin', 'host', 'manage'];
  if (protectedRoutes.includes(route) && !user) {
    return <AuthPage mode="login" />;
  }
  if (route === 'business' && param === 'manage' && !user) {
    return <AuthPage mode="login" />;
  }

  const query = new URLSearchParams(window.location.search);

  let page: React.ReactNode;
  switch (route) {
    case '': page = <HomePage />; break;
    case 'discover': page = <DiscoverPage />; break;
    case 'groups': page = param ? <GroupDetailPage slug={param} /> : <GroupsPage />; break;
    case 'activities':
      page = <ActivitiesPage initialCategory={query.get('category') ?? undefined} />;
      break;
    case 'events': page = <EventsPage />; break;
    case 'membership': page = <MembershipPage />; break;
    case 'create':
      page = <CreateGroupPage editSlug={query.get('edit') ?? undefined} duplicateSlug={query.get('duplicate') ?? undefined} />;
      break;
    case 'profile': page = <ProfilePage username={param} />; break;
    case 'messages': page = <MessagesPage />; break;
    case 'saved': page = <SavedPage />; break;
    case 'notifications': page = <NotificationsPage />; break;
    case 'admin': page = <AdminPage />; break;
    case 'about': page = <AboutPage />; break;
    case 'for-businesses': page = <ForBusinessesPage />; break;
    case 'host': page = <HostDashboardPage />; break;
    case 'manage': page = param ? <ManageGroupPage slug={param} /> : <HostDashboardPage />; break;
    case 'business':
      page = param === 'manage' ? <BusinessDashboardPage />
        : param === 'pricing' ? <BusinessPricingPage />
        : param ? <BusinessProfilePage slug={param} />
        : <BusinessPricingPage />;
      break;
    case 'checkout':
      page = param === 'cancel' ? <CheckoutCancelPage /> : <CheckoutSuccessPage />;
      break;
    default: page = <HomePage />;
  }

  return (
    <>
      <Navbar />
      {page}
      <MobileNav />
      <div className="h-16 md:hidden" />
    </>
  );
}

function App() {
  if (!isSupabaseConfigured) {
    return <MissingEnvScreen />;
  }

  return (
    <AuthProvider>
      <RouterProvider>
        <AppRoutes />
      </RouterProvider>
    </AuthProvider>
  );
}

export default App;

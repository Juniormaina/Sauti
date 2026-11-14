import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  History,
  LayoutDashboard,
  LogOut,
  Mic,
  Settings,
  User,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { firebaseAuth } from '../../lib/firebase';
import { ConnectivityBanner } from '../../components/pwa/PWAStatusControls';

export function AdultLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { learnerProfile, logout } = useAuthStore();
  const isLifelong = learnerProfile?.environment === 'lifelong_english';

  const navItems = [
    { to: '/learn/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/learn/courses', label: 'Curriculum', icon: BookOpen },
    { to: '/learn/speaking', label: 'Voice Studio', icon: Mic },
    { to: '/learn/progress', label: 'Progress', icon: BarChart3 },
    { to: '/learn/history', label: 'History', icon: History },
    { to: '/learn/achievements', label: 'Milestones', icon: Award },
    { to: '/learn/profile', label: 'Profile', icon: User },
    { to: '/learn/settings', label: 'Settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await firebaseAuth.signOut().catch(() => {});
    logout();
    navigate('/');
  };

  return (
    <div className={`min-h-screen bg-[#FFF8ED] text-[#17201C] flex ${isLifelong ? 'text-[17px]' : 'text-[15px]'}`}>
      {/* Refined Editorial Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-[#245C45]/12 bg-[#FDF6EA] px-5 py-6">
        <Link to="/learn/dashboard" className="font-display text-2xl font-bold text-[#245C45] mb-1">
          SAUTI
        </Link>
        <p className="text-xs text-[#4A5851] mb-8">
          {isLifelong ? 'Lifelong English · Calm Pace' : 'Professional English'}
        </p>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-colors ${
                  active
                    ? 'bg-[#245C45] text-[#FFF8ED]'
                    : 'text-[#4A5851] hover:bg-[#245C45]/8 hover:text-[#17201C]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-[#245C45]/12 space-y-3">
          <div className="text-xs text-[#4A5851] tabular-nums">
            Level {learnerProfile?.cefrLevel || 'A1'} · {learnerProfile?.streakDays ?? 0}d streak
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-[#4A5851] hover:bg-[#245C45]/8 hover:text-[#17201C]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-[#FFF8ED]/95 backdrop-blur border-b border-[#245C45]/12 px-4 h-14 flex items-center justify-between">
          <Link to="/learn/dashboard" className="font-display text-xl font-bold text-[#245C45]">
            SAUTI
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/learn/speaking" className="px-3 py-1.5 rounded-lg bg-[#245C45] text-[#FFF8ED] text-xs font-semibold">
              Voice Studio
            </Link>
            <button type="button" onClick={handleSignOut} aria-label="Sign out" className="p-2 text-[#4A5851]">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 pb-24 lg:pb-12">
          <ConnectivityBanner />
          {children}
        </main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#FFF8ED] border-t border-[#245C45]/12 px-2 py-2 flex items-center justify-around z-30">
          {navItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center py-1 px-2 text-xs font-medium ${
                  active ? 'text-[#245C45]' : 'text-[#4A5851]'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

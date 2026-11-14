import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { BarChart3, BookOpen, Compass, Flame, LogOut, Mic, Settings, Trophy } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { firebaseAuth } from '../../lib/firebase';
import { ConnectivityBanner } from '../../components/pwa/PWAStatusControls';
import { SAUTI_SPRING } from '../../components/motion/SautiMotion';

export function TeenLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { learnerProfile, logout } = useAuthStore();
  const reduced = useReducedMotion();

  const navItems = [
    { to: '/learn/dashboard', label: 'Studio', icon: Compass },
    { to: '/learn/courses', label: 'Pathways', icon: BookOpen },
    { to: '/learn/speaking', label: 'Voice Studio', icon: Mic },
    { to: '/learn/challenges', label: 'Challenges', icon: Flame },
    { to: '/learn/progress', label: 'Progress', icon: BarChart3 },
    { to: '/learn/achievements', label: 'Badges', icon: Trophy },
  ];

  const handleSignOut = async () => {
    await firebaseAuth.signOut().catch(() => {});
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#17201C] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#17201C] text-[#FFF8ED] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link
            to="/learn/dashboard"
            className="font-display text-xl font-bold tracking-tight whitespace-nowrap shrink-0 text-[#FFF8ED]"
          >
            SAUTI
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-[#FFF8ED]'
                      : 'text-[#FFF8ED]/70 hover:text-[#FFF8ED] hover:bg-white/10'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="teen-active-nav"
                      transition={reduced ? { duration: 0 } : SAUTI_SPRING}
                      className="absolute inset-0 rounded-lg bg-[#245C45]"
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs font-mono tabular-nums text-[#F6C96B]">
              {learnerProfile?.cefrLevel || 'A1'} · {learnerProfile?.xp ?? 0} XP
            </span>
            <Link
              to="/learn/settings"
              aria-label="Settings"
              className="p-2 rounded-lg text-[#FFF8ED]/80 hover:text-[#FFF8ED] hover:bg-white/10 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="p-2 rounded-lg text-[#FFF8ED]/80 hover:text-[#FFF8ED] hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 pb-20 lg:pb-10">
        <ConnectivityBanner />
        {children}
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#17201C] text-[#FFF8ED] border-t border-white/10 px-2 py-2 flex items-center justify-around z-30">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs font-medium ${
                active ? 'text-[#F6C96B]' : 'text-[#FFF8ED]/70'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

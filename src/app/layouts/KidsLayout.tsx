import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Award, BookOpen, Home, LogOut, Mic, Settings, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { firebaseAuth } from '../../lib/firebase';
import { ConnectivityBanner } from '../../components/pwa/PWAStatusControls';
import { SAUTI_SPRING } from '../../components/motion/SautiMotion';

export function KidsLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { learnerProfile, logout } = useAuthStore();
  const reduced = useReducedMotion();

  const navItems = [
    { to: '/learn/dashboard', label: 'Home', icon: Home },
    { to: '/learn/courses', label: 'Stories', icon: BookOpen },
    { to: '/learn/speaking', label: 'Voice Play', icon: Mic },
    { to: '/learn/achievements', label: 'Stars', icon: Award },
    { to: '/learn/settings', label: 'Settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await firebaseAuth.signOut().catch(() => {});
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#17201C] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#FFF1E6]/95 backdrop-blur-md border-b-2 border-[#F6C96B]/60 px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link to="/learn/dashboard" className="flex items-center gap-3 group">
            <span className="w-11 h-11 rounded-2xl bg-[#F28B75] text-[#FFF8ED] font-display text-xl font-bold flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              S
            </span>
            <span className="font-display text-xl font-bold text-[#245C45] whitespace-nowrap">
              SAUTI Kids
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl text-base font-semibold transition-transform active:scale-95 whitespace-nowrap ${
                    active ? 'text-[#FFF8ED]' : 'bg-white/80 text-[#245C45] hover:bg-[#F6C96B]/30'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="kids-active-nav"
                      transition={reduced ? { duration: 0 } : SAUTI_SPRING}
                      className="absolute inset-0 rounded-2xl bg-[#245C45] shadow-sm"
                    />
                  )}
                  <Icon className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[#245C45] tabular-nums">
              <ShieldCheck className="w-4 h-4" />
              {learnerProfile?.xp ?? 0} Stars
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-white text-[#245C45] border border-[#245C45]/15 hover:bg-[#F28B75]/15 active:scale-95 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-10">
        <ConnectivityBanner />
        {children}
      </main>

      {/* Touch-friendly mobile bottom dock */}
      <nav
        aria-label="Kids mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 bg-[#FFF8ED]/95 backdrop-blur border-t-2 border-[#F6C96B]/60 px-2 py-2 flex items-center justify-around z-30"
      >
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-1.5 rounded-2xl text-xs font-bold active:scale-95 transition-transform ${
                active ? 'bg-[#245C45] text-[#FFF8ED]' : 'text-[#245C45]'
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

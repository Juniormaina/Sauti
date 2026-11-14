import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { LogOut, LucideIcon } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { firebaseAuth } from '../../lib/firebase';
import { ConnectivityBanner } from '../../components/pwa/PWAStatusControls';
import { SAUTI_SPRING } from '../../components/motion/SautiMotion';

export interface PortalNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function PortalLayout({
  title,
  subtitle,
  navItems,
  children,
}: {
  title: string;
  subtitle: string;
  navItems: PortalNavItem[];
  children: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const reduced = useReducedMotion();

  const handleSignOut = async () => {
    await firebaseAuth.signOut().catch(() => {});
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#17201C] flex flex-col lg:flex-row">
      <aside className="lg:w-64 border-b lg:border-b-0 lg:border-r border-[#245C45]/12 bg-[#FDF6EA] px-5 py-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between lg:block mb-6">
            <div>
              <Link to="/" className="font-display text-xl font-bold text-[#245C45]">
                SAUTI
              </Link>
              <p className="text-xs text-[#4A5851] mt-0.5">
                {title} · {subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="lg:hidden p-2 rounded-lg text-[#4A5851] hover:bg-[#245C45]/10"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-[#FFF8ED]'
                      : 'text-[#4A5851] hover:bg-[#245C45]/8 hover:text-[#17201C]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="portal-active-nav"
                      transition={reduced ? { duration: 0 } : SAUTI_SPRING}
                      className="absolute inset-0 rounded-xl bg-[#245C45]"
                    />
                  )}
                  <Icon className="w-4 h-4 shrink-0 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block pt-4 border-t border-[#245C45]/12 space-y-2">
          <p className="text-xs text-[#4A5851] truncate">{user?.email}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[#4A5851] hover:bg-[#245C45]/8 hover:text-[#17201C] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8">
        <ConnectivityBanner />
        {children}
      </main>
    </div>
  );
}

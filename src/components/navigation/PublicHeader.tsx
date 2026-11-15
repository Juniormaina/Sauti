import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, WifiOff, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useOfflineStore } from '../../stores/offlineStore';
import { PWAInstallButton } from '../pwa/PWAStatusControls';
import { ZuriMascot } from '../mascot/ZuriMascot';
import { SAUTI_EASE } from '../motion/SautiMotion';

/** Public navigation. Every link is a real route: nothing scrolls to an anchor. */
export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuthStore();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const reduced = useReducedMotion();

  const dashboardPath =
    user?.role === 'PARENT'
      ? '/parent/dashboard'
      : user?.role === 'TEACHER'
      ? '/teacher/dashboard'
      : user?.role === 'ADMIN'
      ? '/admin/dashboard'
      : '/learn/dashboard';

  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/get-started', label: 'Get started', end: false },
    { to: user ? dashboardPath : '/login', label: user ? 'Workspace' : 'Sign in', end: false },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap shrink-0 transition-colors hover:text-[#245C45] ${
      isActive ? 'text-[#245C45] underline decoration-[#F28B75] decoration-2 underline-offset-8' : ''
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-[#245C45]/12 bg-[#FFF8ED]/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1E6] transition-transform duration-300 group-hover:-rotate-6">
            <ZuriMascot headOnly size={30} />
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-[#245C45]">SAUTI</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 text-sm font-medium text-[#4A5851] md:flex">
          {links.map((l) => (
            <NavLink key={l.label} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B43C25]">
              <WifiOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
          <PWAInstallButton variant="compact" />
          <Link
            to="/get-started"
            className="shrink-0 whitespace-nowrap rounded-xl bg-[#245C45] px-5 py-2.5 text-sm font-semibold text-[#FFF8ED] shadow-sm transition-all hover:bg-[#194231] active:scale-[0.98]"
          >
            Start learning
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="rounded-lg p-2 text-[#245C45] transition-colors hover:bg-[#245C45]/10 md:hidden"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduced ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: SAUTI_EASE }}
            className="overflow-hidden border-t border-[#245C45]/10 bg-[#FFF8ED] md:hidden"
          >
            <div className="space-y-2.5 px-4 py-4">
              {links.map((l) => (
                <NavLink
                  key={l.label}
                  to={l.to}
                  end={l.end}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 text-base font-medium text-[#17201C]"
                >
                  {l.label}
                </NavLink>
              ))}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <PWAInstallButton variant="compact" />
              </div>
              <Link
                to="/get-started"
                onClick={() => setMobileOpen(false)}
                className="block w-full rounded-xl bg-[#245C45] py-3 text-center font-semibold text-[#FFF8ED]"
              >
                Start learning
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

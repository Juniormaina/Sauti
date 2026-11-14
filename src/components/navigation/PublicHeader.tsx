import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Menu, WifiOff, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useOfflineStore } from '../../stores/offlineStore';
import { PWAInstallButton } from '../pwa/PWAStatusControls';
import { SAUTI_IMAGES } from '../../utils/environments';
import { SAUTI_EASE } from '../motion/SautiMotion';

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

  return (
    <header className="sticky top-0 z-40 bg-[#FFF8ED]/92 backdrop-blur-md border-b border-[#245C45]/12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark + Zuri Emblem */}
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 group whitespace-nowrap shrink-0"
        >
          <span className="w-8 h-8 rounded-xl overflow-hidden border border-[#245C45]/15 bg-[#FDF3E3] shrink-0">
            <img
              src={SAUTI_IMAGES.voiceCompanion}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-[#245C45]">
            SAUTI
          </span>
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4A5851]">
          <a
            href="/#how-it-works"
            className="hover:text-[#245C45] transition-colors whitespace-nowrap shrink-0"
          >
            How it works
          </a>
          <a
            href="/#journeys"
            className="hover:text-[#245C45] transition-colors whitespace-nowrap shrink-0"
          >
            Journeys
          </a>
          <a
            href="/#voice-studio"
            className="hover:text-[#245C45] transition-colors whitespace-nowrap shrink-0"
          >
            Voice Studio
          </a>
          <a
            href="/#validation-pilot"
            className="hover:text-[#245C45] transition-colors whitespace-nowrap shrink-0"
          >
            Free Pilot
          </a>
          <Link
            to={user ? dashboardPath : '/login'}
            className="hover:text-[#245C45] transition-colors whitespace-nowrap shrink-0"
          >
            {user ? 'Workspace' : 'Sign in'}
          </Link>
        </nav>

        {/* Zone 3: Install & primary action */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B43C25]">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
          <PWAInstallButton variant="compact" />
          <Link
            to="/get-started"
            className="px-5 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 shadow-sm"
          >
            Start learning
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="md:hidden p-2 rounded-lg text-[#245C45] hover:bg-[#245C45]/10 transition-colors"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduced ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: SAUTI_EASE }}
            className="md:hidden overflow-hidden bg-[#FFF8ED] border-t border-[#245C45]/10"
          >
            <div className="px-4 py-4 space-y-2.5">
              <a
                href="/#how-it-works"
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-base font-medium text-[#17201C]"
              >
                How it works
              </a>
              <a
                href="/#journeys"
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-base font-medium text-[#17201C]"
              >
                Journeys
              </a>
              <a
                href="/#voice-studio"
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-base font-medium text-[#17201C]"
              >
                Voice Studio
              </a>
              <a
                href="/#validation-pilot"
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-base font-medium text-[#17201C]"
              >
                Free Pilot
              </a>
              <Link
                to={user ? dashboardPath : '/login'}
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-base font-medium text-[#17201C]"
              >
                {user ? 'Open Workspace' : 'Sign in'}
              </Link>
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <PWAInstallButton variant="compact" />
              </div>
              <Link
                to="/get-started"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold"
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

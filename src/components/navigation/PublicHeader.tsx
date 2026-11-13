import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuthStore();

  const dashboardPath =
    user?.role === 'PARENT'
      ? '/parent/dashboard'
      : user?.role === 'TEACHER'
      ? '/teacher/dashboard'
      : user?.role === 'ADMIN'
      ? '/admin/dashboard'
      : '/learn/dashboard';

  return (
    <header className="sticky top-0 z-40 bg-[#FFF8ED]/92 backdrop-blur-md border-b border-[#245C45]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-2xl font-bold tracking-tight text-[#245C45] whitespace-nowrap shrink-0"
        >
          SAUTI
        </Link>

        {/* Zone 2: 4 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4A5851]">
          <a
            href="/#how-it-works"
            className="hover:text-[#245C45] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            How it works
          </a>
          <a
            href="/#journeys"
            className="hover:text-[#245C45] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Journeys
          </a>
          <a
            href="/#voice-studio"
            className="hover:text-[#245C45] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Voice Studio
          </a>
          <Link
            to={user ? dashboardPath : '/login'}
            className="hover:text-[#245C45] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {user ? 'Workspace' : 'Sign in'}
          </Link>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="hidden md:flex items-center shrink-0">
          <Link
            to="/get-started"
            className="px-5 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231] transition-colors whitespace-nowrap shrink-0"
          >
            Start learning
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="md:hidden p-2 rounded-lg text-[#245C45] hover:bg-[#245C45]/10"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-[#FFF8ED] border-t border-[#245C45]/10 px-4 py-4 space-y-3">
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
          <Link
            to={user ? dashboardPath : '/login'}
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-base font-medium text-[#17201C]"
          >
            {user ? 'Open Workspace' : 'Sign in'}
          </Link>
          <Link
            to="/get-started"
            onClick={() => setMobileOpen(false)}
            className="block w-full text-center py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold"
          >
            Start learning
          </Link>
        </div>
      )}
    </header>
  );
}

import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import RadioIcon from './RadioIcon';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const isRadioPage = location.pathname.startsWith('/radio/');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`min-h-screen bg-bg-primary flex flex-col transition-colors duration-300 ${isRadioPage ? 'radio-screen' : ''}`}>
      {!isRadioPage && (
        <header
          className={`w-full sticky top-0 z-50 bg-bg-primary/88 backdrop-blur-2xl border-b border-[var(--color-border)] transition-shadow duration-200 ${
            scrolled ? 'shadow-[0_2px_16px_rgba(0,0,0,0.05)]' : ''
          }`}
        >
          <div className="w-full px-4 h-12 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00A651] to-[#00C45E] flex items-center justify-center shadow-sm">
                <RadioIcon className="w-5 h-5 text-white" active={true} />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-[#1A1D23] dark:text-[#F1F5F9] leading-tight">Radiolezo</span>
                <span className="text-[10px] text-[#6B7280] dark:text-[#94A3B8] tracking-wider leading-none">AI RADIO</span>
              </div>
            </Link>
            <nav className="hidden sm:flex items-center gap-2">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/'
                    ? 'bg-[#00A651] text-white shadow-sm'
                    : 'text-[#6B7280] dark:text-[#94A3B8] hover:text-[#00A651] hover:bg-[#00A651]/10'
                }`}
              >
                Stations
              </Link>
              <Link
                to="/reader"
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/reader'
                    ? 'bg-[#00A651] text-white shadow-sm'
                    : 'text-[#6B7280] dark:text-[#94A3B8] hover:text-[#00A651] hover:bg-[#00A651]/10'
                }`}
              >
                Reader
              </Link>
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/admin'
                    ? 'bg-[#00A651] text-white shadow-sm'
                    : 'text-[#6B7280] dark:text-[#94A3B8] hover:text-[#00A651] hover:bg-[#00A651]/10'
                }`}
              >
                Admin
              </Link>
              <div className="ml-1">
                <ThemeToggle />
              </div>
            </nav>
            <div className="sm:hidden">
              <ThemeToggle />
            </div>
          </div>
        </header>
      )}
      {isRadioPage && (
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
      )}
      <main className={`flex-1 ${isRadioPage ? 'min-h-0 overflow-hidden' : ''}`}>{children}</main>
      {!isRadioPage && (
        <footer className="w-full py-3 px-4 text-center text-xs text-[#6B7280] dark:text-[#94A3B8] bg-white dark:bg-white/4 border-t border-[var(--color-border)]">
          Radiolezo — AI traffic & news radio for DRC
        </footer>
      )}
    </div>
  );
}

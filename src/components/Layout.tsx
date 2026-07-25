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
    <div className={`min-h-screen bg-bg-primary flex flex-col ${isRadioPage ? 'radio-screen' : ''}`}>
      <header
        className={`w-full sticky top-0 z-50 glass transition-shadow duration-200 ${
          scrolled ? 'shadow-lg shadow-black/10' : ''
        }`}
      >
        <div className="w-full px-3 h-11 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shadow-sm border border-primary/20">
              <RadioIcon className="w-4 h-4 text-primary" active={true} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text-primary leading-tight">Radiolezo</span>
              <span className="text-[9px] text-text-secondary tracking-wider leading-none">AI RADIO</span>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              to="/"
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                location.pathname === '/'
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              Stations
            </Link>
            <Link
              to="/reader"
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                location.pathname === '/reader'
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              Reader
            </Link>
            <Link
              to="/admin"
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                location.pathname === '/admin'
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              Admin
            </Link>
            <div className="ml-0.5">
              <ThemeToggle />
            </div>
          </nav>
          <div className="sm:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className={`flex-1 ${isRadioPage ? 'min-h-0 overflow-hidden' : ''}`}>{children}</main>
      {!isRadioPage && (
        <footer className="w-full border-t border-border py-2 px-3 text-center text-[10px] text-text-secondary">
          Radiolezo — AI traffic & news radio for DRC
        </footer>
      )}
    </div>
  );
}

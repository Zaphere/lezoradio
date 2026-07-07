import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header
        className={`sticky top-0 z-50 glass transition-shadow duration-200 ${
          scrolled ? 'shadow-lg shadow-black/10' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
              <span className="text-white text-sm font-bold">R</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-text-primary leading-tight">Radiolezo</span>
              <span className="text-[10px] text-text-secondary tracking-wider leading-none">AI RADIO</span>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === '/'
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              Stations
            </Link>
            <Link
              to="/reader"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === '/reader'
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              Reader
            </Link>
            <Link
              to="/admin"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === '/admin'
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              Admin
            </Link>
            <div className="ml-1">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

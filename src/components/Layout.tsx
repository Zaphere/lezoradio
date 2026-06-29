import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isRadioPage = location.pathname.startsWith('/radio');

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="glass border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-sm font-bold">R</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-primary leading-tight">Radiolezo</span>
              <span className="text-[10px] text-text-secondary tracking-wider">AI RADIO</span>
            </div>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                location.pathname === '/' 
                  ? 'bg-primary/20 text-primary' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              Stations
            </Link>
            {!isRadioPage && (
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === '/admin' 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
              >
                Admin
              </Link>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

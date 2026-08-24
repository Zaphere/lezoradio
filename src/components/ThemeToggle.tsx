import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setIsDark(true);
      document.body.classList.add('dark-mode');
    } else if (saved === 'light') {
      setIsDark(false);
      document.body.classList.remove('dark-mode');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        setIsDark(true);
        document.body.classList.add('dark-mode');
      }
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    document.body.classList.toggle('dark-mode', newMode);
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-[#F8F8F8] hover:bg-[#F0F0F0] dark:bg-white/5 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer active:scale-95"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative w-5 h-5">
        <svg
          className={`absolute inset-0 w-5 h-5 transition-all duration-300 text-[#555555] dark:text-[#94A3B8] ${
            !isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-75'
          }`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg
          className={`absolute inset-0 w-5 h-5 transition-all duration-300 text-[#555555] dark:text-[#94A3B8] ${
            isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-75'
          }`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </div>
    </button>
  );
}

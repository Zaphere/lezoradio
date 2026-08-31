import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GLOBAL_CHANNELS, slugify } from '../lib/channels';

const CHANNEL_THEMES: Record<string, { gradient: string; glow: string; textColor: string }> = {
  'Africa News': {
    gradient: 'linear-gradient(135deg, #00A651 0%, #00C45E 100%)',
    glow: 'rgba(0, 166, 81, 0.3)',
    textColor: 'text-white',
  },
  'World News': {
    gradient: 'linear-gradient(135deg, #3C3B6E 0%, #5B5A8E 100%)',
    glow: 'rgba(60, 59, 110, 0.3)',
    textColor: 'text-white',
  },
  'Ambient': {
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
    glow: 'rgba(139, 92, 246, 0.3)',
    textColor: 'text-white',
  },
};

const DEFAULT_THEME = {
  gradient: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-hover) 100%)',
  glow: 'rgba(0, 0, 0, 0.06)',
  textColor: '',
};

export default function ChannelGrid() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 gap-3">
      {GLOBAL_CHANNELS.map((ch) => {
        const theme = CHANNEL_THEMES[ch.name] || DEFAULT_THEME;
        const isThemed = !!CHANNEL_THEMES[ch.name];

        return (
          <motion.button
            key={ch.frequency}
            onClick={() => navigate(`/radio/global/${slugify(ch.name)}`)}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className={`relative rounded-2xl flex flex-col items-center gap-1.5 py-4 px-2 cursor-pointer transition-all duration-200 group overflow-hidden ${
              isThemed
                ? `${theme.textColor} border border-white/20`
                : 'bg-white dark:bg-white/6 border border-[var(--color-border)] dark:border-white/8'
            }`}
            style={{
              background: isThemed ? theme.gradient : undefined,
              boxShadow: isThemed
                ? `0 4px 12px ${theme.glow}, 0 2px 4px rgba(0,0,0,0.06)`
                : '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            {isThemed && (
              <div className="absolute inset-0 bg-white/10 group-hover:bg-white/15 transition-colors duration-200" />
            )}
            <span className="relative z-10 text-2xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]">{ch.emoji}</span>
            <span className={`relative z-10 text-sm font-bold font-mono transition-colors ${
              isThemed ? 'text-white/90' : 'text-[#00A651] group-hover:text-[#00C45E]'
            }`}>
              {ch.frequency} FM
            </span>
            <span className={`relative z-10 text-base font-semibold text-center leading-tight ${
              isThemed ? 'text-white' : 'text-[#1A1D23] dark:text-[#F1F5F9]'
            }`}>
              {ch.name}
            </span>
            <span className={`relative z-10 text-xs text-center leading-tight max-w-full truncate ${
              isThemed ? 'text-white/70' : 'text-[#6B7280] dark:text-[#94A3B8]'
            }`}>
              {ch.description}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

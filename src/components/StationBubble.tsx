import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getFlagEmoji } from '../lib/types';
import { getCountryTheme } from '../lib/countryTheme';
import type { StationRecord } from '../lib/types';

function getFeedCount(region: string): number {
  const counts: Record<string, number> = {
    'Southern Africa': 6,
    'Central Africa': 6,
    'East Africa': 6,
    'North Africa': 4,
  };
  return counts[region] || 0;
}

export default function StationBubble({
  station,
  onClick,
}: {
  station: StationRecord;
  onClick: () => void;
}) {
  const feedCount = getFeedCount(station.region);
  const theme = useMemo(
    () => getCountryTheme(station.country_code, station.name),
    [station.country_code, station.name],
  );
  const flag = station.image_url
    ? <img src={station.image_url} alt={station.name} className="w-10 h-10 rounded-full object-cover" />
    : <span className="text-4xl leading-none">{getFlagEmoji(station.country_code)}</span>;

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        className="relative w-24 h-24 rounded-full flex items-center justify-center cursor-pointer group"
        style={{
          background: theme.gradient,
          boxShadow: `0 4px 16px ${theme.glow}, 0 2px 6px rgba(0,0,0,0.08)`,
          border: '2px solid rgba(255,255,255,0.25)',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-white/15 group-hover:bg-white/20 transition-colors duration-200" />
        <span className="relative z-10 transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
          {flag}
        </span>
        {feedCount > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white text-xs font-bold flex items-center justify-center shadow-lg z-20"
            style={{ color: theme.primary }}>
            {feedCount}
          </span>
        )}
      </motion.button>
      <span className="text-sm font-semibold text-[#1A1D23] dark:text-[#F1F5F9] text-center leading-tight max-w-24 truncate">
        {station.name}
      </span>
      <span className="text-xs text-[#6B7280] dark:text-[#94A3B8] text-center leading-none">
        {station.region}
      </span>
    </div>
  );
}

import { motion } from 'framer-motion';
import { getFlagEmoji } from '../lib/types';
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
  const flag = station.image_url
    ? <img src={station.image_url} alt={station.name} className="w-10 h-10 rounded-full object-cover" />
    : <span className="text-3xl leading-none">{getFlagEmoji(station.country_code)}</span>;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        className="relative w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center shadow-lg cursor-pointer hover:border-primary/50 transition-colors group"
      >
        {flag}
        {feedCount > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center shadow-lg">
            {feedCount}
          </span>
        )}
      </motion.button>
      <span className="text-xs font-medium text-text-primary text-center leading-tight max-w-20 truncate">
        {station.name}
      </span>
      <span className="text-[10px] text-text-secondary text-center leading-none">
        {station.region}
      </span>
    </div>
  );
}

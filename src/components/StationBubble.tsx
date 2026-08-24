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
    : <span className="text-4xl leading-none">{getFlagEmoji(station.country_code)}</span>;

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        className="relative w-24 h-24 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.15)] flex items-center justify-center cursor-pointer transition-all duration-200 group"
      >
        {flag}
        {feedCount > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#00A651] text-xs font-bold text-white flex items-center justify-center shadow-lg">
            {feedCount}
          </span>
        )}
      </motion.button>
      <span className="text-sm font-medium text-[#111111] dark:text-[#F1F5F9] text-center leading-tight max-w-24 truncate">
        {station.name}
      </span>
      <span className="text-xs text-[#555555] dark:text-[#94A3B8] text-center leading-none">
        {station.region}
      </span>
    </div>
  );
}

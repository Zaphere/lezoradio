import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DRC_REGIONS, DRC_COUNTRY } from '../lib/drcRegions';
import { getCountryTheme } from '../lib/countryTheme';
import type { DCRegion } from '../lib/drcRegions';

const REGION_COLORS: Record<string, { primary: string; gradient: string; glow: string }> = {
  kinshasa: {
    primary: '#0077C8',
    gradient: 'linear-gradient(135deg, #0077C8 0%, #00A3E0 100%)',
    glow: 'rgba(0, 119, 200, 0.35)',
  },
  goma: {
    primary: '#CE1021',
    gradient: 'linear-gradient(135deg, #CE1021 0%, #E8354A 100%)',
    glow: 'rgba(206, 16, 33, 0.35)',
  },
  lubumbashi: {
    primary: '#D4A017',
    gradient: 'linear-gradient(135deg, #D4A017 0%, #F7D618 100%)',
    glow: 'rgba(212, 160, 23, 0.35)',
  },
};

export default function StationGrid() {
  const [showRegions, setShowRegions] = useState(false);
  const navigate = useNavigate();
  const drcTheme = useMemo(() => getCountryTheme('CD', 'DR Congo'), []);

  const handleRegionClick = (region: DCRegion) => {
    navigate(`/radio/${DRC_COUNTRY.slug}-${region.slug}`);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.button
        onClick={() => setShowRegions(!showRegions)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        className="relative w-24 h-24 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          background: drcTheme.gradient,
          boxShadow: `0 4px 16px ${drcTheme.glow}, 0 2px 6px rgba(0,0,0,0.08)`,
          border: '2px solid rgba(255,255,255,0.25)',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-white/15" />
        <span className="relative z-10 text-5xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">{DRC_COUNTRY.emoji}</span>
      </motion.button>
      <span className="text-lg font-bold text-[#1A1D23] dark:text-[#F1F5F9] text-center mt-1">
        {DRC_COUNTRY.name}
      </span>
      <span className="text-sm text-[#6B7280] dark:text-[#94A3B8] text-center">
        {showRegions ? 'Select a region' : 'Tap to explore regions'}
      </span>

      <div className="h-2" />

      <AnimatePresence>
        {showRegions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex justify-center gap-5 flex-wrap overflow-hidden"
          >
            {DRC_REGIONS.map((region) => {
              const regionStyle = REGION_COLORS[region.slug] || REGION_COLORS.kinshasa;
              return (
                <motion.div
                  key={region.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <motion.button
                    onClick={() => handleRegionClick(region)}
                    whileTap={{ scale: 0.85 }}
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="relative w-20 h-20 rounded-full flex items-center justify-center cursor-pointer group"
                    style={{
                      background: regionStyle.gradient,
                      boxShadow: `0 4px 12px ${regionStyle.glow}, 0 2px 4px rgba(0,0,0,0.06)`,
                      border: '2px solid rgba(255,255,255,0.25)',
                    }}
                  >
                    <div className="absolute inset-0 rounded-full bg-white/15 group-hover:bg-white/25 transition-colors duration-200" />
                    <span className="relative z-10 text-3xl transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                      {region.emoji}
                    </span>
                  </motion.button>
                  <span className="text-sm font-semibold text-[#1A1D23] dark:text-[#F1F5F9] text-center leading-tight max-w-20 truncate">
                    {region.name}
                  </span>
                  <span className="text-xs text-[#6B7280] dark:text-[#94A3B8] text-center leading-tight max-w-20 truncate">
                    {region.description}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

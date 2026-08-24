import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DRC_REGIONS, DRC_COUNTRY } from '../lib/drcRegions';
import type { DCRegion } from '../lib/drcRegions';

export default function StationGrid() {
  const [showRegions, setShowRegions] = useState(false);
  const navigate = useNavigate();

  const handleRegionClick = (region: DCRegion) => {
    navigate(`/radio/${DRC_COUNTRY.slug}-${region.slug}`);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.button
        onClick={() => setShowRegions(!showRegions)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        className="relative w-24 h-24 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.10)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.15)] flex items-center justify-center cursor-pointer transition-all duration-200"
      >
        <span className="text-5xl">{DRC_COUNTRY.emoji}</span>
      </motion.button>
      <span className="text-lg font-bold text-[#111111] dark:text-[#F1F5F9] text-center mt-1">
        {DRC_COUNTRY.name}
      </span>
      <span className="text-sm text-[#555555] dark:text-[#94A3B8] text-center">
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
            {DRC_REGIONS.map((region) => (
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
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.08 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="relative w-20 h-20 rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:bg-[#00A651]/5 flex items-center justify-center cursor-pointer transition-all duration-200 group"
                >
                  <span className="text-3xl transition-transform duration-200 group-hover:scale-110">{DRC_COUNTRY.emoji}</span>
                </motion.button>
                <span className="text-sm font-semibold text-[#111111] dark:text-[#F1F5F9] text-center leading-tight max-w-20 truncate">
                  {region.name}
                </span>
                <span className="text-xs text-[#555555] dark:text-[#94A3B8] text-center leading-tight max-w-20 truncate">
                  {region.description}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

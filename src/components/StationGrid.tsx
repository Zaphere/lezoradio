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
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <motion.button
          onClick={() => setShowRegions(!showRegions)}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          className="relative w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center shadow-sm cursor-pointer hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
        >
          <span className="text-2xl">{DRC_COUNTRY.emoji}</span>
        </motion.button>
        <span className="text-xs font-semibold text-text-primary text-center">
          {DRC_COUNTRY.name}
        </span>
        <span className="text-[10px] text-text-secondary text-center -mt-1">
          {showRegions ? 'Select a region' : 'Tap to explore regions'}
        </span>

        <AnimatePresence>
          {showRegions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-center gap-3 flex-wrap overflow-hidden"
            >
              {DRC_REGIONS.map((region) => (
                <motion.div
                  key={region.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <motion.button
                    onClick={() => handleRegionClick(region)}
                    whileTap={{ scale: 0.88, rotate: -2 }}
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    className="relative w-14 h-14 rounded-full bg-surface border border-primary/30 flex items-center justify-center shadow-md cursor-pointer hover:border-primary hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 group overflow-hidden active:ring-4 active:ring-primary/40"
                  >
                    <span className="text-xl transition-transform duration-200 group-hover:scale-110">{region.emoji}</span>
                    <span className="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-active:opacity-100 transition-opacity duration-150" />
                  </motion.button>
                  <span className="text-[10px] font-medium text-text-primary text-center leading-tight max-w-16 truncate">
                    {region.name}
                  </span>
                  <span className="text-[8px] text-text-secondary text-center leading-tight max-w-16 truncate">
                    {region.description}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

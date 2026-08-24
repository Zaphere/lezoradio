import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GLOBAL_CHANNELS, slugify } from '../lib/channels';

export default function ChannelGrid() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 gap-3">
      {GLOBAL_CHANNELS.map((ch) => (
        <motion.button
          key={ch.frequency}
          onClick={() => navigate(`/radio/global/${slugify(ch.name)}`)}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.03 }}
          className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] flex flex-col items-center gap-1.5 py-4 px-2 cursor-pointer transition-all duration-200 group"
        >
          <span className="text-2xl">{ch.emoji}</span>
          <span className="text-sm font-bold font-mono text-[#00A651] group-hover:text-[#00C45E] transition-colors">
            {ch.frequency} FM
          </span>
          <span className="text-base font-semibold text-[#111111] dark:text-[#F1F5F9] text-center leading-tight">
            {ch.name}
          </span>
          <span className="text-xs text-[#555555] dark:text-[#94A3B8] text-center leading-tight max-w-full truncate">
            {ch.description}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

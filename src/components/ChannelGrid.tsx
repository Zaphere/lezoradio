import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GLOBAL_CHANNELS, slugify } from '../lib/channels';

export default function ChannelGrid() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {GLOBAL_CHANNELS.map((ch) => (
        <motion.button
          key={ch.frequency}
          onClick={() => navigate(`/radio/global/${slugify(ch.name)}`)}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.03 }}
          className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-colors cursor-pointer group"
        >
          <span className="text-3xl">{ch.emoji}</span>
          <span className="text-xs font-bold font-mono text-primary/70 group-hover:text-primary transition-colors">
            {ch.frequency} FM
          </span>
          <span className="text-sm font-semibold text-text-primary text-center leading-tight">
            {ch.name}
          </span>
          <span className="text-[10px] text-text-secondary text-center leading-tight">
            {ch.description}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

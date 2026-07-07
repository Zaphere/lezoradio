import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GLOBAL_CHANNELS, slugify } from '../lib/channels';

export default function ChannelGrid() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 gap-2">
      {GLOBAL_CHANNELS.map((ch) => (
        <motion.button
          key={ch.frequency}
          onClick={() => navigate(`/radio/global/${slugify(ch.name)}`)}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.03 }}
          className="card card-hoverable flex flex-col items-center gap-1 py-2.5 px-2 cursor-pointer group"
        >
          <span className="text-xl">{ch.emoji}</span>
          <span className="text-[9px] font-bold font-mono text-primary/70 group-hover:text-primary transition-colors">
            {ch.frequency} FM
          </span>
          <span className="text-[11px] font-semibold text-text-primary text-center leading-tight">
            {ch.name}
          </span>
          <span className="text-[8px] text-text-secondary text-center leading-tight max-w-full truncate">
            {ch.description}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

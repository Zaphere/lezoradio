interface Props {
  volume: number;
  onChange: (volume: number) => void;
}

export default function VolumeControl({ volume, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 text-[#555555] dark:text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.5H4a1 1 0 00-1 1v5a1 1 0 001 1h2.5l4 4V4.5l-4 4z" />
      </svg>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(volume * 100)}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
         className="w-24 h-1.5 rounded-full appearance-none bg-[#F0F0F0] dark:bg-white/10 cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 
                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full 
                   [&::-webkit-slider-thumb]:bg-[#00A651] [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,166,81,0.4)]"
      />
    </div>
  );
}

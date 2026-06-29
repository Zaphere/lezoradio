interface Props {
  rate: number;
  onChange: (rate: number) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

export default function SpeedControl({ rate, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <div className="flex gap-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
              rate === s
                ? 'bg-primary/30 text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

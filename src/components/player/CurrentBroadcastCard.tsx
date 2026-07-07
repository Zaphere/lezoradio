import type { BroadcastItem } from '../../lib/types';

interface Props {
  item: BroadcastItem;
  progress: number;
}

export default function CurrentBroadcastCard({ item, progress }: Props) {
  const wordCount = item.body.split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 150));

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">
          Now Playing
        </span>
      </div>

      <div>
        <h4 className="text-sm font-bold text-text-primary leading-snug">{item.title}</h4>
        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.body}</p>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-text-secondary">
        <span className="px-2 py-0.5 rounded-full bg-surface-hover">{item.source}</span>
        {item.country && (
          <span className="px-2 py-0.5 rounded-full bg-surface-hover">{item.country}</span>
        )}
        <span className="px-2 py-0.5 rounded-full bg-surface-hover capitalize">{item.type}</span>
        <span className="ml-auto">{readingTime}s est.</span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-surface-hover overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-200"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}

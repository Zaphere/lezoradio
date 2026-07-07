import { useRef, useEffect } from 'react';
import type { NewsItem } from '../../lib/types';

interface Props {
  items: NewsItem[];
  currentIndex: number;
  isFollowingLive: boolean;
  onSelectIndex: (index: number) => void;
  onGoLive: () => void;
}

export default function BroadcastTimeline({
  items,
  currentIndex,
  isFollowingLive,
  onSelectIndex,
  onGoLive,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target =
      isFollowingLive && liveRef.current
        ? liveRef.current
        : el.children[currentIndex] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentIndex, isFollowingLive, items.length]);

  if (items.length === 0) return null;

  const atLive = isFollowingLive && currentIndex >= items.length - 1;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Broadcast Timeline
        </h4>
        {!atLive && (
          <button
            onClick={onGoLive}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-colors cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Go Live
          </button>
        )}
        {atLive && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
      >
        {items.map((item, index) => {
          const isActive = index === currentIndex;
          const isPast = currentIndex > index;
          return (
            <button
              key={item.id}
              onClick={() => onSelectIndex(index)}
              className={`snap-center shrink-0 w-44 p-3 rounded-xl text-left transition-all cursor-pointer border ${
                isActive
                  ? 'bg-primary/20 border-primary/50 ring-1 ring-primary/30'
                  : isPast
                    ? 'bg-surface-subtle border-border/30 opacity-60'
                    : 'bg-surface border-border/50 hover:bg-surface-hover'
              }`}
            >
              <p className="text-[10px] text-text-secondary capitalize mb-1">
                {item.category} · {item.region}
              </p>
              <p className="text-xs text-text-primary font-medium line-clamp-3 leading-snug">
                {item.title}
              </p>
            </button>
          );
        })}

        <button
          ref={liveRef}
          onClick={onGoLive}
          className={`snap-center shrink-0 w-20 flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer ${
            atLive
              ? 'bg-red-500/20 border-red-500/50'
              : 'bg-surface border-border/50 hover:bg-red-500/10 hover:border-red-500/30'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mb-1" />
          <span className="text-[10px] font-bold text-red-400">LIVE</span>
        </button>
      </div>

      <p className="text-[10px] text-text-secondary text-center">
        {currentIndex >= 0
          ? `Story ${currentIndex + 1} of ${items.length}${!isFollowingLive ? ' · behind live' : ''}`
          : `${items.length} stories ready`}
      </p>
    </div>
  );
}

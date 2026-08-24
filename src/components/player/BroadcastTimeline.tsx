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
    <div className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#555555] dark:text-[#94A3B8]">Broadcast Timeline</h4>
        {!atLive && (
          <button
            onClick={onGoLive}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D62828]/15 text-[#D62828] text-xs font-bold hover:bg-[#D62828]/25 transition-colors cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D62828] animate-pulse" />
            Go Live
          </button>
        )}
        {atLive && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D62828]/15 text-[#D62828] text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D62828] animate-pulse" />
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
              className={`snap-center shrink-0 w-44 p-3 rounded-2xl text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#00A651]/15 shadow-[0_2px_8px_rgba(0,166,81,0.15)]'
                  : isPast
                    ? 'bg-[#F8F8F8]/50 dark:bg-white/5 opacity-60'
                    : 'bg-[#F8F8F8] dark:bg-white/10 hover:bg-[#F0F0F0] dark:hover:bg-white/15'
              }`}
            >
              <p className="text-xs text-[#555555] dark:text-[#94A3B8] capitalize mb-1">
                {item.category} \u00B7 {item.region}
              </p>
              <p className="text-sm text-[#111111] dark:text-[#F1F5F9] font-medium line-clamp-3 leading-snug">
                {item.title}
              </p>
            </button>
          );
        })}

        <button
          ref={liveRef}
          onClick={onGoLive}
          className={`snap-center shrink-0 w-20 flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer ${
            atLive
              ? 'bg-[#D62828]/15'
              : 'bg-[#F8F8F8] dark:bg-white/10 hover:bg-[#D62828]/10'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#D62828] animate-pulse mb-1" />
          <span className="text-xs font-bold text-[#D62828]">LIVE</span>
        </button>
      </div>

      <p className="text-xs text-[#555555] dark:text-[#94A3B8] text-center">
        {currentIndex >= 0
          ? `Story ${currentIndex + 1} of ${items.length}${!isFollowingLive ? ' \u00B7 behind live' : ''}`
          : `${items.length} stories ready`}
      </p>
    </div>
  );
}

import type { NewsCategory, NewsItem } from '../lib/types';

interface Props {
  items: NewsItem[];
  loading?: boolean;
  category?: NewsCategory;
  stationName?: string;
  onCategoryChange: (category: NewsCategory | undefined) => void;
}

export default function NewsFeedPreview({ items, loading, category, stationName, onCategoryChange }: Props) {
  const categories: { label: string; value: NewsCategory | '' }[] = [
    { label: 'All', value: '' },
    { label: 'Local', value: 'local' },
    { label: 'Regional', value: 'regional' },
    { label: 'Global', value: 'global' },
    { label: 'Traffic', value: 'traffic' },
    { label: 'Alert', value: 'alert' },
  ];

  return (
    <div className="bg-white dark:bg-white/6 rounded-3xl border border-[var(--color-border)] dark:border-white/8 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-[#1A1D23] dark:text-[#F1F5F9]">News Feed</h3>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => onCategoryChange(c.value ? (c.value as NewsCategory) : undefined)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all cursor-pointer ${
                (c.value === '' && !category) || category === c.value
                  ? 'bg-[#00A651] text-white shadow-[0_2px_8px_rgba(0,166,81,0.3)]'
                  : 'bg-[var(--color-surface-subtle)] dark:bg-white/8 text-[#6B7280] dark:text-[#94A3B8] hover:bg-[#00A651]/10 hover:text-[#00A651]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {stationName && (
        <p className="text-sm text-[#6B7280] dark:text-[#94A3B8] mb-3">
          Filtered for <span className="text-[#00A651] font-medium">{stationName}</span>
          {category ? ` \u00B7 ${category}` : ' \u00B7 all categories'}
        </p>
      )}
      {!stationName && <div className="mb-3" />}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-[var(--color-surface-subtle)] dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--color-surface-subtle)] dark:bg-white/5 flex items-center justify-center">
            <svg className="w-7 h-7 text-[#6B7280]/50 dark:text-[#94A3B8]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <p className="text-[#6B7280]/50 dark:text-[#94A3B8]/50 text-sm">No news items yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-[var(--color-surface-subtle)] dark:bg-white/5 hover:bg-[var(--color-surface-hover)] dark:hover:bg-white/8 transition-colors animate-slide-up"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-base text-[#1A1D23] dark:text-[#F1F5F9] font-medium line-clamp-2">{item.title}</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
                    item.is_processed
                      ? 'bg-[#00A651]/15 text-[#00A651]'
                      : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                  }`}
                >
                  {item.is_processed ? '\u2713' : 'pending'}
                </span>
              </div>
              <p className="text-sm text-[#6B7280] dark:text-[#94A3B8] line-clamp-2 mb-3">
                {item.description?.replace(/<[^>]*>/g, '').substring(0, 200) || ''}
              </p>
              <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#94A3B8]">
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-surface-hover)] dark:bg-white/8">{item.region}</span>
                <span className="capitalize">{item.category}</span>
                <span className="ml-auto">
                  {new Date(item.ingested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

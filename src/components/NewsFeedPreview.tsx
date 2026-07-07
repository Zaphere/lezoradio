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
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-primary">News Feed</h3>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => onCategoryChange(c.value ? (c.value as NewsCategory) : undefined)}
              className={`px-3 py-1.5 text-[10px] rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                (c.value === '' && !category) || category === c.value
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {stationName && (
        <p className="text-[10px] text-text-secondary mb-3">
          Filtered for <span className="text-primary font-medium">{stationName}</span>
          {category ? ` · ${category}` : ' · all categories'}
        </p>
      )}
      {!stationName && <div className="mb-3" />}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface flex items-center justify-center">
            <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <p className="text-text-secondary/50 text-xs">No news items yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors animate-slide-up"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium line-clamp-2">{item.title}</p>
                </div>
                <span
                  className={`shrink-0 text-[10px] px-2 py-1 rounded-full font-medium ${
                    item.is_processed
                      ? 'bg-success/20 text-success'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {item.is_processed ? '✓' : 'pending'}
                </span>
              </div>
              <p className="text-xs text-text-secondary line-clamp-2 mb-3">
                {item.description?.replace(/<[^>]*>/g, '').substring(0, 200) || ''}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                <span className="px-2 py-0.5 rounded-full bg-surface-hover">{item.region}</span>
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

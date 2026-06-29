import type { QueueItem } from '../lib/types';

interface Props {
  items: QueueItem[];
}

export default function QueuePreview({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Up Next</h4>
        <p className="text-text-secondary/50 text-xs text-center py-4">Queue is empty</p>
      </div>
    );
  }

  const priorityLabel: Record<number, string> = {
    1: 'Alert',
    2: 'Traffic',
    3: 'Local',
    4: 'Regional',
    5: 'Global',
  };

  const priorityColors: Record<number, string> = {
    1: 'bg-alert',
    2: 'bg-primary',
    3: 'bg-success',
    4: 'bg-blue-400',
    5: 'bg-purple-400',
  };

  return (
    <div className="glass rounded-2xl p-4">
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Up Next</h4>
      <div className="space-y-2">
        {items.slice(0, 3).map((item, i) => (
          <div
            key={item.script.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 animate-slide-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${priorityColors[item.priority] || 'bg-gray-400'}`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary truncate font-medium">{item.script.script.substring(0, 50)}...</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-text-secondary">{item.script.region}</span>
                <span className="text-[10px] text-text-secondary">·</span>
                <span className="text-[10px] text-text-secondary capitalize">{priorityLabel[item.priority] || 'News'}</span>
              </div>
            </div>
          </div>
        ))}
        {items.length > 3 && (
          <p className="text-[10px] text-text-secondary text-center py-2">+{items.length - 3} more items</p>
        )}
      </div>
    </div>
  );
}

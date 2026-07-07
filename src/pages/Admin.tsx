import { useFeeds } from '../hooks/useSupabase';

export default function Admin() {
  const { feeds, loading } = useFeeds();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">System Monitor</h1>
        <p className="text-sm text-text-secondary mt-1">Feed status and ingestion overview</p>
      </div>

      <div className="glass rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Feeds</h2>
        {loading ? (
          <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-surface animate-pulse" />
              ))}
          </div>
        ) : feeds.length === 0 ? (
          <p className="text-text-secondary/50 text-xs text-center py-6">
            No feeds configured. Add feeds via Supabase dashboard or backend.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-secondary border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Name</th>
                  <th className="text-left py-2 pr-4 font-medium">Region</th>
                  <th className="text-left py-2 pr-4 font-medium">Category</th>
                  <th className="text-left py-2 pr-4 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Last Fetched</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((feed: any) => (
                  <tr key={feed.id} className="border-b border-border/50 text-text-primary">
                    <td className="py-2 pr-4">{feed.name}</td>
                    <td className="py-2 pr-4">{feed.region}</td>
                    <td className="py-2 pr-4 capitalize">{feed.category}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          feed.is_active
                            ? 'bg-success/20 text-success'
                            : 'bg-alert/20 text-alert'
                        }`}
                      >
                        {feed.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="py-2 text-text-secondary">
                      {feed.last_fetched_at
                        ? new Date(feed.last_fetched_at).toLocaleString()
                        : 'never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-2">Ingestion Log</h2>
        <p className="text-text-secondary/50 text-xs">
          Ingestion logs from <code className="text-primary">ingestion_logs</code> table will appear here.
          Connect to Supabase and configure RSS feeds via your backend to populate this view.
        </p>
      </div>
    </div>
  );
}

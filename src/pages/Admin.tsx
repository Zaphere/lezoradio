import { useFeeds } from '../hooks/useSupabase';

export default function Admin() {
  const { feeds, loading } = useFeeds();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-[#111111] dark:text-[#F1F5F9] tracking-tight">System Monitor</h1>
        <p className="text-base text-[#555555] dark:text-[#94A3B8] mt-1">Feed status and ingestion overview</p>
      </div>

      <div className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-6">
        <h2 className="text-lg font-semibold text-[#111111] dark:text-[#F1F5F9] mb-5">Feeds</h2>
        {loading ? (
          <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-2xl bg-[#F8F8F8] dark:bg-white/5 animate-pulse" />
              ))}
          </div>
        ) : feeds.length === 0 ? (
          <p className="text-[#555555]/50 dark:text-[#94A3B8]/50 text-sm text-center py-6">
            No feeds configured. Add feeds via Supabase dashboard or backend.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#555555] dark:text-[#94A3B8] border-b border-[#EEEEEE] dark:border-white/10">
                  <th className="text-left py-3 pr-4 font-semibold">Name</th>
                  <th className="text-left py-3 pr-4 font-semibold">Region</th>
                  <th className="text-left py-3 pr-4 font-semibold">Category</th>
                  <th className="text-left py-3 pr-4 font-semibold">Status</th>
                  <th className="text-left py-3 font-semibold">Last Fetched</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((feed: any) => (
                  <tr key={feed.id} className="border-b border-[#EEEEEE]/50 dark:border-white/5 text-[#111111] dark:text-[#F1F5F9]">
                    <td className="py-3 pr-4 font-medium">{feed.name}</td>
                    <td className="py-3 pr-4 text-[#555555] dark:text-[#94A3B8]">{feed.region}</td>
                    <td className="py-3 pr-4 capitalize text-[#555555] dark:text-[#94A3B8]">{feed.category}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-3 py-0.5 rounded-full text-xs font-medium ${
                          feed.is_active
                            ? 'bg-[#00A651]/15 text-[#00A651]'
                            : 'bg-[#D62828]/15 text-[#D62828]'
                        }`}
                      >
                        {feed.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="py-3 text-[#555555] dark:text-[#94A3B8]">
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

      <div className="bg-white dark:bg-white/5 rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] p-6">
        <h2 className="text-lg font-semibold text-[#111111] dark:text-[#F1F5F9] mb-2">Ingestion Log</h2>
        <p className="text-[#555555]/50 dark:text-[#94A3B8]/50 text-sm">
          Ingestion logs from <code className="text-[#00A651]">ingestion_logs</code> table will appear here.
          Connect to Supabase and configure RSS feeds via your backend to populate this view.
        </p>
      </div>
    </div>
  );
}

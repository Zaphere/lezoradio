// Mirrors backend/feeds.config.js — keep in sync for diagnostics scans
const URL_REPLACEMENTS: Record<string, string> = {
  'https://www.times.co.sz/feed/':
    'https://allafrica.com/tools/headlines/rdf/eswatini/headlines.rdf',
  'https://www.news24.com/feeds/rss': 'https://www.iol.co.za/rss',
  'https://feeds.news24.com/articles/news24/TopStories/rss': 'https://www.iol.co.za/rss',
  'https://allafrica.com/tools/headlines/rss/latest/headlines.xml':
    'https://www.theguardian.com/world/africa/rss',
  'https://openrss.org/feed/www.reddit.com/r/ArtificialInteligence/hot/':
    'https://techcrunch.com/feed/',
};

export function normalizeFeedUrl(url: string): string {
  return URL_REPLACEMENTS[url] || url;
}

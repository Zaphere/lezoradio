// Verified working RSS feeds (tested 2026-06-29)
// Used as env fallbacks and to replace known-dead URLs at runtime.

export const REGIONAL_RSS_FEEDS = [
  {
    name: 'Eswatini Headlines',
    url: 'https://allafrica.com/tools/headlines/rdf/eswatini/headlines.rdf',
    region: 'eswatini',
    category: 'local',
    envKey: 'RSS_FEEDS_ESWATINI',
  },
  {
    name: 'IOL South Africa',
    url: 'https://www.iol.co.za/rss',
    region: 'south-africa',
    category: 'regional',
    envKey: 'RSS_FEEDS_SOUTH_AFRICA',
  },
  {
    name: 'Radio Okapi',
    url: 'https://www.radiookapi.net/rss.xml',
    region: 'congo',
    category: 'regional',
    envKey: 'RSS_FEEDS_CONGO',
  },
  {
    name: 'Africa Traffic News',
    url: 'https://news.google.com/rss/search?q=traffic+Africa&hl=en-US&gl=US&ceid=US:en',
    region: 'traffic',
    category: 'traffic',
    envKey: 'RSS_FEEDS_TRAFFIC',
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    region: 'tech',
    category: 'global',
    envKey: 'RSS_FEEDS_TECH',
  },
];

export const GLOBAL_RSS_FEEDS = [
  {
    name: 'BBC Africa',
    url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
    region: 'global',
    category: 'global',
  },
  {
    name: 'Africanews',
    url: 'https://www.africanews.com/feed/rss',
    region: 'global',
    category: 'global',
  },
  {
    name: 'Guardian Africa',
    url: 'https://www.theguardian.com/world/africa/rss',
    region: 'global',
    category: 'global',
  },
  {
    name: 'Africa.com',
    url: 'https://africa.com/feed',
    region: 'global',
    category: 'global',
  },
  {
    name: 'How We Made It in Africa',
    url: 'https://www.howwemadeitinafrica.com/feed/',
    region: 'global',
    category: 'regional',
  },
];

// Known dead URLs from old configs — auto-replaced before fetch
export const URL_REPLACEMENTS = {
  'https://www.times.co.sz/feed/':
    'https://allafrica.com/tools/headlines/rdf/eswatini/headlines.rdf',
  'https://www.news24.com/feeds/rss': 'https://www.iol.co.za/rss',
  'https://feeds.news24.com/articles/news24/TopStories/rss': 'https://www.iol.co.za/rss',
  'https://allafrica.com/tools/headlines/rss/latest/headlines.xml':
    'https://www.theguardian.com/world/africa/rss',
  'https://openrss.org/feed/www.reddit.com/r/ArtificialInteligence/hot/':
    'https://techcrunch.com/feed/',
  'https://example.com/eswatini-feed.xml':
    'https://allafrica.com/tools/headlines/rdf/eswatini/headlines.rdf',
  'https://example.com/south-africa-feed.xml': 'https://www.iol.co.za/rss',
  'https://example.com/congo-feed.xml': 'https://www.radiookapi.net/rss.xml',
  'https://example.com/traffic-feed.xml':
    'https://news.google.com/rss/search?q=traffic+Africa&hl=en-US&gl=US&ceid=US:en',
  'https://example.com/tech-feed.xml': 'https://techcrunch.com/feed/',
};

export function normalizeFeedUrl(url) {
  return URL_REPLACEMENTS[url] || url;
}

export function isValidFeedUrl(url) {
  return Boolean(url && !url.includes('example.com'));
}

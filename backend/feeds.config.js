// DRC-focused RSS feeds — traffic is highest priority
// Tested 2026-06-30

export const REGIONAL_RSS_FEEDS = [
  // ── Traffic (MOST IMPORTANT) ──
  {
    name: 'Kinshasa Traffic',
    url: 'https://news.google.com/rss/search?q=Kinshasa+embouteillage+trafic+circulation&hl=fr&gl=CD&ceid=CD:fr',
    region: 'congo',
    category: 'traffic',
    envKey: 'RSS_FEEDS_KINSHASA_TRAFFIC',
  },
  {
    name: 'Goma Traffic',
    url: 'https://news.google.com/rss/search?q=Goma+trafic+route+embouteillage&hl=fr&gl=CD&ceid=CD:fr',
    region: 'congo',
    category: 'traffic',
    envKey: 'RSS_FEEDS_GOMA_TRAFFIC',
  },
  {
    name: 'Lubumbashi Traffic',
    url: 'https://news.google.com/rss/search?q=Lubumbashi+trafic+route+embouteillage&hl=fr&gl=CD&ceid=CD:fr',
    region: 'congo',
    category: 'traffic',
    envKey: 'RSS_FEEDS_LUBUMBASHI_TRAFFIC',
  },
  {
    name: 'DRC Road Traffic',
    url: 'https://news.google.com/rss/search?q=RN1+RN2+RN4+RDC+trafic+route&hl=fr&gl=CD&ceid=CD:fr',
    region: 'congo',
    category: 'traffic',
    envKey: 'RSS_FEEDS_DRC_ROADS',
  },

  // ── DRC Regional News ──
  {
    name: 'Radio Okapi',
    url: 'https://www.radiookapi.net/rss.xml',
    region: 'congo',
    category: 'regional',
    envKey: 'RSS_FEEDS_CONGO',
  },
  {
    name: 'Actualite.cd',
    url: 'https://actualite.cd/feed',
    region: 'congo',
    category: 'regional',
    envKey: 'RSS_FEEDS_ACTUALITE',
  },
  {
    name: 'ACP Congo',
    url: 'https://acpcongo.com/feed',
    region: 'congo',
    category: 'local',
    envKey: 'RSS_FEEDS_ACP',
  },
  {
    name: '7sur7.cd',
    url: 'http://7sur7.cd/index.php?format=feed&type=rss',
    region: 'congo',
    category: 'regional',
    envKey: 'RSS_FEEDS_7SUR7',
  },

  // ── Regional DRC News (Goma / Eastern DRC) ──
  {
    name: 'Kivu Morning Post',
    url: 'https://kivumorningpost.com/feed',
    region: 'congo',
    category: 'local',
    envKey: 'RSS_FEEDS_KIVU',
  },

  // ── Emergency Alerts ──
  {
    name: 'ReliefWeb DRC Alerts',
    url: 'https://reliefweb.int/country/cod/rss.xml',
    region: 'congo',
    category: 'alert',
    envKey: 'RSS_FEEDS_RELIEFWEB',
  },
  {
    name: 'GDACS 24h Disasters',
    url: 'https://www.gdacs.org/xml/rss_24h.xml',
    region: 'global',
    category: 'alert',
    envKey: 'RSS_FEEDS_GDACS',
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
];

// Known dead URLs — auto-replaced before fetch
export const URL_REPLACEMENTS = {
  'https://www.times.co.sz/feed/':
    'https://allafrica.com/tools/headlines/rdf/eswatini/headlines.rdf',
  'https://www.news24.com/feeds/rss': 'https://www.iol.co.za/rss',
  'https://feeds.news24.com/articles/news24/TopStories/rss': 'https://www.iol.co.za/rss',
  'https://allafrica.com/tools/headlines/rss/latest/headlines.xml':
    'https://www.theguardian.com/world/africa/rss',
  'https://openrss.org/feed/www.reddit.com/r/ArtificialInteligence/hot/':
    'https://techcrunch.com/feed/',
  'https://example.com/congo-feed.xml': 'https://www.radiookapi.net/rss.xml',
  'https://example.com/traffic-feed.xml':
    'https://news.google.com/rss/search?q=Kinshasa+embouteillage+trafic+circulation&hl=fr&gl=CD&ceid=CD:fr',
};

export function normalizeFeedUrl(url) {
  return URL_REPLACEMENTS[url] || url;
}

export function isValidFeedUrl(url) {
  return Boolean(url && !url.includes('example.com'));
}

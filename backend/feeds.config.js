// DRC-focused RSS feeds — traffic is highest priority
// Region classification: kinshasa | goma | lubumbashi | global
// Each feed is classified by its primary coverage area.

export const REGIONAL_RSS_FEEDS = [
  // ── Traffic (MOST IMPORTANT) ──
  {
    name: 'Kinshasa Traffic',
    url: 'https://news.google.com/rss/search?q=Kinshasa+embouteillage+trafic+circulation&hl=fr&gl=CD&ceid=CD:fr',
    region: 'kinshasa',
    category: 'traffic',
    language: 'fr',
    envKey: 'RSS_FEEDS_KINSHASA_TRAFFIC',
  },
  {
    name: 'Goma Traffic',
    url: 'https://news.google.com/rss/search?q=Goma+trafic+route+embouteillage&hl=fr&gl=CD&ceid=CD:fr',
    region: 'goma',
    category: 'traffic',
    language: 'fr',
    envKey: 'RSS_FEEDS_GOMA_TRAFFIC',
  },
  {
    name: 'Lubumbashi Traffic',
    url: 'https://news.google.com/rss/search?q=Lubumbashi+trafic+route+embouteillage&hl=fr&gl=CD&ceid=CD:fr',
    region: 'lubumbashi',
    category: 'traffic',
    language: 'fr',
    envKey: 'RSS_FEEDS_LUBUMBASHI_TRAFFIC',
  },
  {
    name: 'DRC Road Traffic',
    url: 'https://news.google.com/rss/search?q=RN1+RN2+RN4+RDC+trafic+route&hl=fr&gl=CD&ceid=CD:fr',
    region: 'global',
    category: 'traffic',
    language: 'fr',
    envKey: 'RSS_FEEDS_DRC_ROADS',
  },

  // ── DRC National News (all regions) ──
  {
    name: 'Radio Okapi',
    url: 'https://www.radiookapi.net/rss.xml',
    region: 'global',
    category: 'regional',
    language: 'fr',
    envKey: 'RSS_FEEDS_CONGO',
  },
  {
    name: 'Actualite.cd',
    url: 'https://actualite.cd/feed',
    region: 'global',
    category: 'regional',
    language: 'fr',
    envKey: 'RSS_FEEDS_ACTUALITE',
  },
  {
    name: 'ACP Congo',
    url: 'https://acpcongo.com/feed',
    region: 'global',
    category: 'local',
    language: 'fr',
    envKey: 'RSS_FEEDS_ACP',
  },
  {
    name: '7sur7.cd',
    url: 'http://7sur7.cd/index.php?format=feed&type=rss',
    region: 'global',
    category: 'regional',
    language: 'fr',
    envKey: 'RSS_FEEDS_7SUR7',
  },

  // ── Eastern DRC News (Goma / North Kivu) ──
  {
    name: 'Kivu Morning Post',
    url: 'https://kivumorningpost.com/feed',
    region: 'goma',
    category: 'local',
    language: 'fr',
    envKey: 'RSS_FEEDS_KIVU',
  },

  // ── Emergency Alerts ──
  {
    name: 'ReliefWeb DRC Alerts',
    url: 'https://reliefweb.int/country/cod/rss.xml',
    region: 'global',
    category: 'alert',
    language: 'fr',
    envKey: 'RSS_FEEDS_RELIEFWEB',
  },
  {
    name: 'GDACS 24h Disasters',
    url: 'https://www.gdacs.org/xml/rss_24h.xml',
    region: 'global',
    category: 'alert',
    language: 'en',
    envKey: 'RSS_FEEDS_GDACS',
  },
];

export const GLOBAL_RSS_FEEDS = [
  {
    name: 'BBC Africa',
    url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
    region: 'global',
    category: 'global',
    language: 'en',
  },
  {
    name: 'Africanews',
    url: 'https://www.africanews.com/feed/rss',
    region: 'global',
    category: 'global',
    language: 'en',
  },
  {
    name: 'Guardian Africa',
    url: 'https://www.theguardian.com/world/africa/rss',
    region: 'global',
    category: 'global',
    language: 'en',
  },
  {
    name: 'Africa.com',
    url: 'https://africa.com/feed',
    region: 'global',
    category: 'global',
    language: 'en',
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

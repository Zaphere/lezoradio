// backend/engine/utils/newsText.js
// Text-to-speech conversion utilities for news content.

/**
 * Strip HTML tags from text.
 */
export function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Convert a news item to speech-ready text.
 */
export function newsItemToSpeech(item) {
  const body = stripHtml(item.content || item.description || '');
  return body ? `${item.title}. ${body}` : item.title;
}

/**
 * Check if a news item is from LezoTraffic.
 */
export function isLezoTrafficItem(item) {
  return item.feed_id === 'lezotraffic';
}

/**
 * Get location string from a news item.
 */
function getLocationString(item) {
  const parts = [];
  if (item.city) parts.push(item.city);
  if (item.province && item.province !== item.city) parts.push(item.province);
  return parts.length > 0 ? parts.join(', ') : '';
}

/**
 * Convert a LezoTraffic item to speech text.
 */
export function lezoTrafficItemToSpeech(item) {
  const location = getLocationString(item);
  const body = stripHtml(item.content || item.description || '');
  const prefix = location ? `In ${location}:` : '';
  if (prefix && body) return `${prefix} ${item.title}. ${body}`;
  if (!body) return `${prefix} ${item.title}`;
  return `${item.title}. ${body}`;
}

/**
 * Get the intro for a LezoTraffic segment.
 */
export function lezoTrafficSegmentIntro(item, stationName, lang) {
  const location = getLocationString(item);
  const region = location || stationName || 'your area';
  if (lang === 'french') return `Information circulation pour ${region} depuis LezoTraffic.`;
  return `Traffic update for ${region} from the LezoTraffic app.`;
}

/**
 * Get a category-specific intro.
 */
const CATEGORY_INTROS = {
  fr: {
    traffic: 'Informations sur la circulation depuis {region}.',
    alert: 'Alerte info pour {region}.',
    local: 'Actualités locales depuis {region}.',
    regional: "Actualités régionales aujourd'hui depuis {region}.",
  },
  en: {
    traffic: 'Now for traffic updates from {region}.',
    alert: 'Breaking news alert for {region}.',
    local: 'Now for local news from {region}.',
    regional: 'In regional news today from {region}.',
  },
};

export function getCategoryIntro(item, stationName, lang = 'en') {
  const region = stationName || 'your area';
  const intros = CATEGORY_INTROS[lang] || CATEGORY_INTROS.en;
  const template = intros[item.category];
  return template ? template.replace('{region}', region) : '';
}

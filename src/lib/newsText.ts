import type { NewsItem } from './types';

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const FRENCH_INTROS: Record<string, string> = {
  traffic: 'Informations sur la circulation depuis {region}.',
  alert: 'Alerte info pour {region}.',
  local: 'Actualités locales depuis {region}.',
  regional: 'Actualités régionales aujourd\'hui depuis {region}.',
};

const ENGLISH_INTROS: Record<string, string> = {
  traffic: 'Now for traffic updates from {region}.',
  alert: 'Breaking news alert for {region}.',
  local: 'Now for local news from {region}.',
  regional: 'In regional news today from {region}.',
};

const LEZOTRAFFIC_ENGLISH_INTRO = 'We now bring you the latest traffic information from the LezoTraffic application.';
const LEZOTRAFFIC_FRENCH_INTRO = 'Nous vous présentons maintenant les dernières informations sur la circulation depuis l\'application LezoTraffic.';

const LEZOTRAFFIC_ENGLISH_CLOSE = 'That concludes our traffic update from LezoTraffic. We now return to your regular programming.';
const LEZOTRAFFIC_FRENCH_CLOSE = 'Ceci conclut notre bulletin de circulation LezoTraffic. Nous retournons à vos programmes habituels.';

function formatIntro(template: string, region: string): string {
  return template.replace('{region}', region);
}

export function getCategoryIntro(item: NewsItem, stationName?: string, lang?: string): string {
  const region = stationName || 'your area';
  const intros = lang === 'french' ? FRENCH_INTROS : ENGLISH_INTROS;
  const template = intros[item.category];
  return template ? formatIntro(template, region) : '';
}

export function newsItemToSpeech(item: NewsItem): string {
  const body = stripHtml(item.content || item.description || '');
  return body ? `${item.title}. ${body}` : item.title;
}

export function newsItemsToSpeechText(items: NewsItem[]): string {
  return items.map((item) => newsItemToSpeech(item)).join(' ');
}

function getLocationString(item: NewsItem): string {
  const parts: string[] = [];
  if (item.city) parts.push(item.city);
  if (item.province && item.province !== item.city) parts.push(item.province);
  return parts.length > 0 ? parts.join(', ') : '';
}

export function isLezoTrafficItem(item: NewsItem): boolean {
  return item.feed_id === 'lezotraffic';
}

export function getLezoTrafficIntro(stationName?: string, lang?: string): string {
  if (lang === 'french') return LEZOTRAFFIC_FRENCH_INTRO;
  const intro = stationName ? `From ${stationName}, ${LEZOTRAFFIC_ENGLISH_INTRO.toLowerCase()}` : LEZOTRAFFIC_ENGLISH_INTRO;
  return intro;
}

export function getLezoTrafficOutro(lang?: string): string {
  return lang === 'french' ? LEZOTRAFFIC_FRENCH_CLOSE : LEZOTRAFFIC_ENGLISH_CLOSE;
}

export function lezoTrafficItemToSpeech(item: NewsItem): string {
  const location = getLocationString(item);
  const body = stripHtml(item.content || item.description || '');
  const prefix = location ? `In ${location}:` : '';
  if (prefix && body) {
    return `${prefix} ${item.title}. ${body}`;
  }
  if (!body) return `${prefix} ${item.title}`;
  return `${item.title}. ${body}`;
}

export function lezoTrafficSegmentIntro(item: NewsItem, stationName?: string, lang?: string): string {
  const location = getLocationString(item);
  const region = location || stationName || 'your area';
  if (lang === 'french') {
    return `Information circulation pour ${region} depuis LezoTraffic.`;
  }
  return `Traffic update for ${region} from the LezoTraffic app.`;
}

export function newsItemsToTranscript(items: NewsItem[]): string {
  if (items.length === 0) return '';

  return items
    .map((item, i) => {
      const body = stripHtml(item.description || item.content || '').substring(0, 400);
      const tag = item.category ? ` [${item.category}]` : '';
      return `${i + 1}. ${item.title}${tag}${body ? `\n${body}` : ''}`;
    })
    .join('\n\n');
}

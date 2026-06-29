import type { BroadcastItem, BroadcastType } from '../../lib/types';

export interface ParsedArticle {
  title: string;
  description: string;
  content: string;
  link: string;
  pubDate: string;
  categories: string[];
}

/**
 * Strip XML namespace prefixes (e.g., <content:encoded> → <content_encoded>)
 * so DOMParser doesn't choke on undeclared namespaces.
 */
function stripNamespaces(xml: string): string {
  return xml.replace(/<\/?([a-zA-Z]+):([a-zA-Z]+)/g, (_, prefix, local) => {
    const tag = prefix === '_' ? `_${local}` : `${prefix}_${local}`;
    return _.startsWith('</') ? `</${tag}` : `<${tag}`;
  });
}

export function parseRSS(xml: string): ParsedArticle[] {
  const cleaned = stripNamespaces(xml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML: ' + parseError.textContent);
  }

  const items = doc.querySelectorAll('item');
  const articles: ParsedArticle[] = [];

  for (const item of items) {
    const title = getElementText(item, 'title');
    if (!title) continue;

    articles.push({
      title,
      description: getElementText(item, 'description') || '',
      content: getElementText(item, 'content_encoded') || getElementText(item, 'content') || '',
      link: getElementText(item, 'link') || getElementText(item, 'guid') || '',
      pubDate: getElementText(item, 'pubDate') || getElementText(item, 'dc_date') || new Date().toISOString(),
      categories: Array.from(item.querySelectorAll('category')).map((c) => c.textContent || ''),
    });
  }

  return articles;
}

function getElementText(parent: Element, tagName: string): string | null {
  const el = parent.querySelector(tagName);
  return el?.textContent?.trim() || null;
}

export function articlesToBroadcastItems(
  articles: ParsedArticle[],
  sourceName: string,
  stationName: string,
  country?: string,
  region?: string,
  language?: string,
): BroadcastItem[] {
  return articles.map((a, i) => ({
    id: `${sourceName}-${i}-${Date.now()}`,
    title: a.title,
    body: a.description || a.content || a.title,
    type: inferType(a.categories, a.title),
    priority: 5,
    station: stationName,
    country,
    region: region || '',
    language: language || 'en',
    source: sourceName,
    publishedAt: a.pubDate,
    url: a.link,
  }));
}

function inferType(categories: string[], title: string): BroadcastType {
  const lower = [...categories, title].join(' ').toLowerCase();
  if (lower.includes('weather') || lower.includes('forecast')) return 'weather';
  if (lower.includes('traffic') || lower.includes('transport')) return 'traffic';
  if (lower.includes('agricultur') || lower.includes('farm') || lower.includes('crop')) return 'agriculture';
  if (lower.includes('tourism') || lower.includes('travel')) return 'tourism';
  if (lower.includes('alert') || lower.includes('emergency') || lower.includes('breaking')) return 'alert';
  if (lower.includes('government') || lower.includes('parliament') || lower.includes('minister')) return 'government';
  return 'news';
}

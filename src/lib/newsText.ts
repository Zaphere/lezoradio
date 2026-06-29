import type { NewsItem } from './types';

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function newsItemToSpeech(item: NewsItem): string {
  const body = stripHtml(item.content || item.description || '');
  return body ? `${item.title}. ${body}` : item.title;
}

export function newsItemsToSpeechText(items: NewsItem[]): string {
  return items.map(newsItemToSpeech).join(' ');
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

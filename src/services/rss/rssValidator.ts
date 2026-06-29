export interface ValidationResult {
  valid: boolean;
  rssVersion: string | null;
  title: string | null;
  description: string | null;
  link: string | null;
  itemCount: number;
  errors: string[];
  warnings: string[];
}

export function validate(xml: string, status: number, responseTime: number): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    rssVersion: null,
    title: null,
    description: null,
    link: null,
    itemCount: 0,
    errors: [],
    warnings: [],
  };

  if (status !== 200) {
    result.valid = false;
    result.errors.push(`HTTP ${status}`);
    return result;
  }

  if (responseTime > 5000) {
    result.warnings.push(`Slow response: ${responseTime}ms`);
  }

  const parser = new DOMParser();
  let doc: Document;
  try {
    doc = parser.parseFromString(xml, 'text/xml');
  } catch {
    result.valid = false;
    result.errors.push('Failed to parse XML document');
    return result;
  }

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    result.valid = false;
    result.errors.push('Invalid XML: ' + (parseError.textContent || 'unknown error'));
    return result;
  }

  const rss = doc.querySelector('rss');
  const feed = doc.querySelector('feed');

  if (rss) {
    result.rssVersion = rss.getAttribute('version') || 'unknown';
    const channel = rss.querySelector('channel');
    if (!channel) {
      result.valid = false;
      result.errors.push('Missing <channel> element');
      return result;
    }
    result.title = getText(channel, 'title');
    result.description = getText(channel, 'description');
    result.link = getText(channel, 'link');
    result.itemCount = channel.querySelectorAll('item').length;

    if (!result.title) result.errors.push('Missing <channel><title>');
    if (result.itemCount === 0) result.warnings.push('No <item> elements found');
  } else if (feed) {
    result.rssVersion = 'atom';
    result.title = getText(feed, 'title');
    result.description = getText(feed, 'subtitle');
    result.link = feed.querySelector('link')?.getAttribute('href') || null;
    result.itemCount = feed.querySelectorAll('entry').length;

    if (!result.title) result.errors.push('Missing <feed><title>');
    if (result.itemCount === 0) result.warnings.push('No <entry> elements found');
  } else {
    result.valid = false;
    result.errors.push('Not a valid RSS or Atom feed — missing <rss> or <feed> root element');
    return result;
  }

  if (result.errors.length > 0) result.valid = false;
  return result;
}

function getText(parent: Element, tag: string): string | null {
  return parent.querySelector(tag)?.textContent?.trim() || null;
}

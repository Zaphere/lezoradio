import { ALLOWED_LANGUAGES, FEED_VALIDATION_RULES } from './feeds.language.config.js';

export function validateFeedUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: 'Missing or invalid URL' };
  }
  try {
    new URL(url);
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }
  return { valid: true };
}

export function validateFeedLanguage(language) {
  if (!language) {
    return { valid: false, reason: 'No language specified' };
  }
  const lang = language.toLowerCase().trim();
  if (!ALLOWED_LANGUAGES.includes(lang)) {
    return { valid: false, reason: `Language '${lang}' not in allowed list: ${ALLOWED_LANGUAGES.join(', ')}` };
  }
  return { valid: true, language: lang };
}

export function validateFeedConfig(feed) {
  const errors = [];

  if (!feed.name || feed.name.trim().length === 0) {
    errors.push('Missing feed name');
  }

  const urlResult = validateFeedUrl(feed.url);
  if (!urlResult.valid) {
    errors.push(urlResult.reason);
  }

  const langResult = validateFeedLanguage(feed.language);
  if (!langResult.valid) {
    errors.push(langResult.reason);
  }

  if (feed.reliability !== undefined && (feed.reliability < 1 || feed.reliability > 10)) {
    errors.push('Reliability score must be between 1 and 10');
  }

  return {
    valid: errors.length === 0,
    errors,
    feed: errors.length === 0 ? feed : null,
  };
}

export function validateFeedItem(item, _language) {
  const issues = [];

  if (!item.title || item.title.trim().length < FEED_VALIDATION_RULES.minimumTitleLength) {
    issues.push('Missing or empty title');
  }

  if (item.published_at && isNaN(new Date(item.published_at).getTime())) {
    issues.push('Invalid published date');
  }

  if (item.url) {
    try {
      new URL(item.url);
    } catch {
      issues.push('Invalid item URL');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function isEnglishContent(text) {
  if (!text) return false;
  const englishMarkers = [
    /\b(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|may|might|must|can|could)\b/i,
    /\b(i|you|he|she|it|we|they|me|him|her|us|them)\b/i,
    /\b(this|that|these|those)\b/i,
  ];
  let englishScore = 0;
  for (const marker of englishMarkers) {
    const matches = text.match(marker);
    if (matches) englishScore += matches.length;
  }
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 5) return false;
  return englishScore / wordCount > 0.15;
}

export function detectLanguage(text) {
  if (!text) return null;
  const frenchMarkers = [
    /\b(le|la|les|un|une|des|du|de|d'|est|sont|dans|avec|pour|sur|pas|nous|vous|ils|elles|ce|cet|cette|ces|qui|que|dont|où|au|aux)\b/i,
    /\b(à|ça|ça|donc|mais|ou|et|car|en|y|très|plus|fait|faire|dit|entre|aussi|être|avoir)\b/i,
  ];
  const swahiliMarkers = [
    /\b(na|ya|wa|kwa|katika|kutoka|wakati|baada|kabla|hii|hiyo|kila|watu|sasa|hivyo|lakini|kufanya|kuhusu|zaidi|huu|hizi)\b/i,
    /\b(mtu|mimi|wewe|yeye|sisi|nyinyi|wao|kitu|vitu|hapa|pale|mbele|nyuma)\b/i,
  ];
  const lingalaMarkers = [
    /\b(na|ya|wa|mwa|ba|ma|li|mi|bi|to|bo|lo|ko|yo|po|ela|aki|aka|oki|oko|eki|eki)\b/i,
    /\b(moto|bato|moko|kobanda|kosala|koloba|koyeba|lipasa|sango|mboka|mokili|mikolo)\b/i,
  ];

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 5) return null;

  function score(markers) {
    let s = 0;
    for (const m of markers) {
      const matches = text.match(m);
      if (matches) s += matches.length;
    }
    return s / words.length;
  }

  const scores = [
    { lang: 'fr', score: score(frenchMarkers) },
    { lang: 'sw', score: score(swahiliMarkers) },
    { lang: 'ln', score: score(lingalaMarkers) },
  ];

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  if (top.score > 0.08) return top.lang;
  return null;
}

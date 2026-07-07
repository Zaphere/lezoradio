// Language-restricted RSS feeds: French, Swahili, Lingala only
// No English feeds — these are the multilingual news sources

export const LANGUAGE_FEEDS = {
  fr: [
    {
      name: 'France 24 Afrique',
      url: 'https://www.france24.com/fr/afrique/rss',
      region: 'global',
      category: 'global',
      language: 'fr',
      country: null,
      reliability: 8,
      priority: 1,
    },
    {
      name: 'RFI Afrique',
      url: 'https://www.rfi.fr/fr/afrique/rss',
      region: 'global',
      category: 'global',
      language: 'fr',
      country: null,
      reliability: 8,
      priority: 1,
    },
    {
      name: 'Africanews Français',
      url: 'https://fr.africanews.com/rss/latest.xml',
      region: 'global',
      category: 'global',
      language: 'fr',
      country: null,
      reliability: 7,
      priority: 2,
    },
    {
      name: 'BBC Afrique',
      url: 'https://www.bbc.com/afrique/index.xml',
      region: 'global',
      category: 'global',
      language: 'fr',
      country: null,
      reliability: 9,
      priority: 1,
    },
    {
      name: 'UN News French',
      url: 'https://news.un.org/feed/subscribe/fr/news/all/rss.xml',
      region: 'global',
      category: 'global',
      language: 'fr',
      country: null,
      reliability: 9,
      priority: 2,
    },
    {
      name: 'Radio Okapi (Français)',
      url: 'https://www.radiookapi.net/rss.xml',
      region: 'congo',
      category: 'regional',
      language: 'fr',
      country: 'CD',
      reliability: 8,
      priority: 1,
    },
    {
      name: 'Actualite.cd',
      url: 'https://actualite.cd/feed',
      region: 'congo',
      category: 'regional',
      language: 'fr',
      country: 'CD',
      reliability: 7,
      priority: 1,
    },
    {
      name: '7sur7.cd',
      url: 'http://7sur7.cd/index.php?format=feed&type=rss',
      region: 'congo',
      category: 'regional',
      language: 'fr',
      country: 'CD',
      reliability: 6,
      priority: 2,
    },
    {
      name: 'Le Monde Afrique',
      url: 'https://www.lemonde.fr/afrique/rss_full.xml',
      region: 'global',
      category: 'global',
      language: 'fr',
      country: null,
      reliability: 9,
      priority: 2,
    },
    {
      name: 'Jeune Afrique',
      url: 'https://www.jeuneafrique.com/feed',
      region: 'global',
      category: 'global',
      language: 'fr',
      country: null,
      reliability: 7,
      priority: 2,
    },
  ],

  sw: [
    {
      name: 'BBC News Swahili',
      url: 'https://www.bbc.com/swahili/index.xml',
      region: 'east-africa',
      category: 'global',
      language: 'sw',
      country: null,
      reliability: 9,
      priority: 1,
    },
    {
      name: 'VOA Swahili',
      url: 'https://www.voaswahili.com/api/zmrqee',
      region: 'east-africa',
      category: 'global',
      language: 'sw',
      country: null,
      reliability: 7,
      priority: 2,
    },
    {
      name: 'DW Kiswahili',
      url: 'https://rss.dw.com/rdf/rss-sw-kiswahili',
      region: 'east-africa',
      category: 'global',
      language: 'sw',
      country: null,
      reliability: 8,
      priority: 1,
    },
    {
      name: 'RFI Kiswahili',
      url: 'https://www.rfi.fr/sw/africa/rss',
      region: 'east-africa',
      category: 'global',
      language: 'sw',
      country: null,
      reliability: 7,
      priority: 2,
    },
  ],

  ln: [
    {
      name: 'VOA Lingala (Regional)',
      url: 'https://www.voalingala.com/api/',
      region: 'congo',
      category: 'regional',
      language: 'ln',
      country: 'CD',
      reliability: 6,
      priority: 3,
      translation_required: false,
    },
  ],
};

// Allowed languages for the multilingual ingestion pipeline
export const ALLOWED_LANGUAGES = ['fr', 'sw', 'ln'];

// Feed-level metadata validation rules
export const FEED_VALIDATION_RULES = {
  minimumTitleLength: 1,
  requireDescription: false,
  requirePublishedDate: true,
  allowEnglishFallback: false,
  maxAgeHours: 72,
};

// Translation pipeline config
export const TRANSLATION_CONFIG = {
  allowedSourceLanguages: ['fr', 'sw'],
  neverFromEnglish: true,
  maxTranslationItems: 50,
};

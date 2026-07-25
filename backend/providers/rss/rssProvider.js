import { BaseProvider } from '../baseProvider.js';
import { fetchRSSFeed } from '../../rssFetcher.js';
import { getAllFeedConfigs } from '../../ingestionService.js';
import { normalizeRSSItems } from './rssNormalizer.js';
import { validateFeedItem } from '../../feedValidator.js';
import { ALLOWED_LANGUAGES } from '../../feeds.language.config.js';

class RSSProvider extends BaseProvider {
  constructor(config = {}) {
    super('rss', config);
    this.feedConfigs = [];
    this.language = config.language || 'fr';
  }

  async initialize() {
    this.log('Initializing RSS provider...');

    try {
      this.feedConfigs = await getAllFeedConfigs();
      this.log(`Loaded ${this.feedConfigs.length} feed configurations`);
      this.initialized = true;
      this.authenticated = true;
    } catch (error) {
      this.log(`Initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async authenticate() {
    this.log('RSS does not require authentication');
    this.authenticated = true;
  }

  async sync() {
    if (!this.initialized) {
      throw new Error('RSS provider not initialized');
    }

    this.log('Starting RSS sync...');

    const allEvents = [];
    const errors = [];

    for (const feedConfig of this.feedConfigs) {
      try {
        this.log(`Processing feed: ${feedConfig.name}`);

        const items = await fetchRSSFeed(feedConfig.url);
        const normalizedEvents = normalizeRSSItems(items, feedConfig);

        for (const event of normalizedEvents) {
          const validation = this.validateEvent(event, feedConfig.language);
          if (!validation.valid) {
            continue;
          }
          allEvents.push(event);
        }

        this.log(`Feed ${feedConfig.name}: ${items.length} fetched, ${normalizedEvents.length} normalized`);

      } catch (error) {
        const errorMsg = `Failed to process ${feedConfig.name}: ${error.message}`;
        this.log(errorMsg, 'error');
        errors.push(errorMsg);
      }
    }

    // Cap events per sync to prevent unbounded events table growth.
    // Engine reads news from news_items anyway; events table is secondary.
    const MAX_EVENTS_PER_SYNC = 30;
    const cappedEvents = allEvents.slice(0, MAX_EVENTS_PER_SYNC);

    this.log(`RSS sync complete: ${cappedEvents.length}/${allEvents.length} events (capped at ${MAX_EVENTS_PER_SYNC})`);

    return {
      events: cappedEvents,
      errors: errors.length > 0 ? errors : null,
      syncContext: {
        sync_start: new Date().toISOString(),
        authentication: { success: true, latency_ms: 0 },
        requests: null,
      },
    };
  }

  validateEvent(event, language) {
    if (!event.title || event.title.trim().length < 5) {
      return { valid: false, reason: 'Missing or empty title' };
    }

    if (language && language !== 'en' && event.language && !ALLOWED_LANGUAGES.includes(event.language)) {
      return { valid: false, reason: `Language ${event.language} not allowed` };
    }

    if (language && language !== 'en') {
      const text = `${event.title} ${event.summary || ''}`.toLowerCase();
      const englishMarkers = ['the ', 'a ', 'an ', 'is ', 'are ', 'was ', 'were '];
      const englishScore = englishMarkers.filter(marker => text.includes(marker)).length;
      const wordCount = text.split(/\s+/).length;

      if (wordCount > 5 && englishScore / wordCount > 0.15) {
        return { valid: false, reason: 'English content not allowed' };
      }
    }

    return { valid: true };
  }

  normalize(rawData) {
    return normalizeRSSItems(Array.isArray(rawData) ? rawData : [rawData], {});
  }

  async reloadConfigs() {
    this.log('Reloading feed configurations...');
    this.feedConfigs = await getAllFeedConfigs();
    this.log(`Reloaded ${this.feedConfigs.length} feed configurations`);
  }

  getFeedStats() {
    return {
      totalFeeds: this.feedConfigs.length,
      feedsByRegion: this.groupFeedsByRegion(),
      feedsByCategory: this.groupFeedsByCategory(),
    };
  }

  groupFeedsByRegion() {
    const groups = {};
    for (const feed of this.feedConfigs) {
      const region = feed.region || 'unknown';
      groups[region] = (groups[region] || 0) + 1;
    }
    return groups;
  }

  groupFeedsByCategory() {
    const groups = {};
    for (const feed of this.feedConfigs) {
      const category = feed.category || 'unknown';
      groups[category] = (groups[category] || 0) + 1;
    }
    return groups;
  }
}

export default RSSProvider;

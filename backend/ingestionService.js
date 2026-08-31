import { fetchRSSFeed } from './rssFetcher.js';
import {
  supabase,
  getOrCreateFeed,
  insertNewsItem,
  updateFeedLastFetched,
  insertRadioScript,
  fetchActiveContentSources,
  backfillMissingRadioScripts,
} from './supabaseClient.js';
import {
  REGIONAL_RSS_FEEDS,
  GLOBAL_RSS_FEEDS,
  normalizeFeedUrl,
  isValidFeedUrl,
} from './feeds.config.js';
import { LANGUAGE_FEEDS, ALLOWED_LANGUAGES } from './feeds.language.config.js';
import { validateFeedConfig, validateFeedItem, detectLanguage, isEnglishContent } from './feedValidator.js';
import { logIngestionEvent } from './ingestionLogger.js';

function mapSourceCategory(category) {
  const map = {
    news: 'global',
    agriculture: 'regional',
    traffic: 'traffic',
    alert: 'alert',
    local: 'local',
    regional: 'regional',
    global: 'global',
    tech: 'global',
  };
  return map[category] || 'global';
}

function mapSourceRegion(category, name) {
  const lower = `${category} ${name}`.toLowerCase();
  if (lower.includes('kinshasa')) return 'kinshasa';
  if (lower.includes('goma') || lower.includes('kivu')) return 'goma';
  if (lower.includes('lubumbashi') || lower.includes('haut-katanga')) return 'lubumbashi';
  return 'global';
}

function mapContentSourceToFeedConfig(source) {
  const url = normalizeFeedUrl(source.url);
  return {
    name: source.name,
    url,
    region: mapSourceRegion(source.category, source.name),
    category: mapSourceCategory(source.category),
  };
}

function getLanguageFeedConfigs() {
  const configs = [];
  for (const lang of ALLOWED_LANGUAGES) {
    const feeds = LANGUAGE_FEEDS[lang] || [];
    for (const feed of feeds) {
      const validation = validateFeedConfig(feed);
      if (!validation.valid) {
        console.warn(`Skipping invalid language feed ${feed.name}: ${validation.errors.join(', ')}`);
        continue;
      }
      if (feed.language === 'en') {
        console.warn(`Skipping English language feed: ${feed.name}`);
        continue;
      }
      configs.push({
        name: feed.name,
        url: feed.url,
        region: feed.region || 'global',
        category: feed.category || 'global',
        language: feed.language,
        country: feed.country,
        reliability: feed.reliability,
        translation_required: feed.translation_required || false,
      });
    }
  }
  return configs;
}

export async function getAllFeedConfigs() {
  const configs = new Map();

  for (const regional of REGIONAL_RSS_FEEDS) {
    const rawUrl = process.env[regional.envKey] || regional.url;
    const url = normalizeFeedUrl(rawUrl);
    if (!isValidFeedUrl(url)) continue;

    if (rawUrl !== url) {
      console.log(`Replacing dead feed URL: ${rawUrl} → ${url}`);
    }

    configs.set(url, {
      name: regional.name,
      url,
      region: regional.region,
      category: regional.category,
      language: regional.language || 'fr',
    });
  }

  const dbSources = await fetchActiveContentSources();
  for (const source of dbSources) {
    if (!isValidFeedUrl(source.url)) continue;

    const url = normalizeFeedUrl(source.url);
    if (source.url !== url) {
      console.log(`Replacing dead feed URL: ${source.url} → ${url}`);
    }

    configs.set(url, mapContentSourceToFeedConfig({ ...source, url }));
  }

  for (const feed of GLOBAL_RSS_FEEDS) {
    if (!configs.has(feed.url)) {
      configs.set(feed.url, { ...feed, language: 'en' });
    }
  }

  for (const langFeed of getLanguageFeedConfigs()) {
    if (!configs.has(langFeed.url)) {
      configs.set(langFeed.url, langFeed);
    }
  }

  return Array.from(configs.values());
}

function convertToRadioScript(item, region) {
  let script = '';

  const isDrc = (region || item?.region) !== 'global';
  const leadIn = isDrc ? 'Aux informations : ' : 'In the news: ';

  if (item.title) {
    script += `${leadIn}${item.title}. `;
  }

  const content = item.content || item.description;
  if (content) {
    const cleanContent = content
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .substring(0, 500);
    script += cleanContent;
  }

  script += isDrc ? ' Plus de détails disponibles sur notre site web.' : ' More details available on our website.';

  const trimmed = script.trim();

  if (!trimmed || trimmed === 'More details available on our website.' || trimmed === 'Plus de détails disponibles sur notre site web.') {
    if (isDrc) {
      return `Flash info. ${item.title || 'Derniers développements signalés.'} Restez à l\'écoute pour plus d\'informations.`;
    }
    return `Breaking news update. ${item.title || 'Latest developments reported.'} Stay tuned for more information.`;
  }

  return trimmed;
}

export async function ingestFeed(feedConfig) {
  if (!feedConfig.url) {
    return { success: false, feed: feedConfig.name, items: 0, error: 'No URL configured' };
  }

  const lang = feedConfig.language || null;
  const startTime = Date.now();
  console.log(`\n=== Processing ${feedConfig.name} [${lang || 'no-lang'}] ===`);

  try {
    const feedId = await getOrCreateFeed(
      feedConfig.name,
      feedConfig.url,
      feedConfig.region,
      feedConfig.category,
      lang,
    );

    if (!feedId) {
      throw new Error('Failed to get/create feed');
    }

    const items = await fetchRSSFeed(feedConfig.url);
    let insertedCount = 0;
    let scriptCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const itemValidation = validateFeedItem(item, lang);
      if (!itemValidation.valid) {
        skippedCount++;
        continue;
      }

      let itemLang = lang;
      if (!itemLang) {
        const detected = detectLanguage((item.title || '') + ' ' + (item.description || ''));
        if (detected && ALLOWED_LANGUAGES.includes(detected)) {
          itemLang = detected;
        }
      }

      if (itemLang !== 'ln' && itemLang !== 'sw') {
        const content = (item.title || '') + ' ' + (item.description || '');
        if (isEnglishContent(content)) {
          if (!lang || lang !== 'en') {
            skippedCount++;
            continue;
          }
        }
      }

      const newsItem = await insertNewsItem(item, feedId, feedConfig.region, feedConfig.category, itemLang);

      if (newsItem) {
        insertedCount++;

        if (itemLang && itemLang !== 'en') {
          const prefix = itemLang === 'fr' ? 'Aux informations : ' :
            itemLang === 'sw' ? 'Habari: ' :
            itemLang === 'ln' ? 'Na sango: ' : 'In the news: ';
          const scriptText = convertToRadioScript(item, feedConfig.region).replace(/^In the news: |^Aux informations : /, prefix);
          await insertRadioScript(newsItem.id, scriptText, feedConfig.region, feedConfig.category);
          scriptCount++;
        } else {
          const scriptText = convertToRadioScript(item, feedConfig.region);
          await insertRadioScript(newsItem.id, scriptText, feedConfig.region, feedConfig.category);
          scriptCount++;
        }

        if (feedConfig.translation_required) {
          await supabase
            .from('news_items')
            .update({ translation_required: true, is_translated: false })
            .eq('id', newsItem.id);
        }
      } else {
        skippedCount++;
      }
    }

    await updateFeedLastFetched(feedId);

    const durationMs = Date.now() - startTime;

    await logIngestionEvent({
      feedSource: feedConfig.name,
      feedUrl: feedConfig.url,
      language: lang,
      status: 'success',
      itemsFetched: items.length,
      itemsInserted: insertedCount,
      itemsSkipped: skippedCount,
      durationMs,
    });

    console.log(`✓ ${feedConfig.name}: ${insertedCount} new, ${skippedCount} skipped, ${scriptCount} scripts`);

    return {
      success: true,
      feed: feedConfig.name,
      items: insertedCount,
      scripts: scriptCount,
      skipped: skippedCount,
      language: lang,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    await logIngestionEvent({
      feedSource: feedConfig.name,
      feedUrl: feedConfig.url,
      language: lang,
      status: 'fail',
      itemsFetched: 0,
      itemsInserted: 0,
      errors: error.message,
      durationMs,
    });

    console.error(`✗ Failed to process ${feedConfig.name}:`, error.message);
    return { success: false, feed: feedConfig.name, items: 0, error: error.message, language: lang };
  }
}

export async function ingestAllFeeds() {
  console.log('\n========================================');
  console.log('Starting RSS Feed Ingestion');
  console.log('========================================');

  const feedConfigs = await getAllFeedConfigs();
  console.log(`Feeds to process: ${feedConfigs.length}`);

  const results = [];

  for (const feedConfig of feedConfigs) {
    const result = await ingestFeed(feedConfig);
    results.push(result);
  }

  console.log('\n========================================');
  console.log('Ingestion Summary');
  console.log('========================================');

  const totalItems = results.reduce((sum, r) => sum + (r.items || 0), 0);
  const totalScripts = results.reduce((sum, r) => sum + (r.scripts || 0), 0);
  const successful = results.filter((r) => r.success).length;

  console.log(`Feeds processed: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Total new items: ${totalItems}`);
  console.log(`Total scripts created: ${totalScripts}`);
  console.log('========================================\n');

  const backfilled = await backfillMissingRadioScripts(convertToRadioScript);
  if (backfilled > 0) {
    console.log(`Backfilled ${backfilled} radio scripts for existing news items\n`);
  }

  return results;
}

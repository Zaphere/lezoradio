import { fetchRSSFeed } from './rssFetcher.js';
import {
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
  if (lower.includes('eswatini')) return 'eswatini';
  if (lower.includes('south africa') || lower.includes('iol')) return 'south-africa';
  if (lower.includes('congo') || lower.includes('okapi')) return 'congo';
  if (lower.includes('traffic')) return 'traffic';
  if (lower.includes('tech')) return 'tech';
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
      configs.set(feed.url, feed);
    }
  }

  return Array.from(configs.values());
}

function convertToRadioScript(item) {
  let script = '';

  if (item.title) {
    script += `In the news: ${item.title}. `;
  }

  const content = item.content || item.description;
  if (content) {
    const cleanContent = content
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .substring(0, 500);
    script += cleanContent;
  }

  script += ' More details available on our website.';

  const trimmed = script.trim();

  if (!trimmed || trimmed === 'More details available on our website.') {
    return `Breaking news update. ${item.title || 'Latest developments reported.'} Stay tuned for more information.`;
  }

  return trimmed;
}

export async function ingestFeed(feedConfig) {
  if (!feedConfig.url) {
    console.log(`Skipping ${feedConfig.name} - no URL configured`);
    return { success: false, feed: feedConfig.name, items: 0 };
  }

  console.log(`\n=== Processing ${feedConfig.name} ===`);

  try {
    const feedId = await getOrCreateFeed(
      feedConfig.name,
      feedConfig.url,
      feedConfig.region,
      feedConfig.category
    );

    if (!feedId) {
      throw new Error('Failed to get/create feed');
    }

    const items = await fetchRSSFeed(feedConfig.url);

    let insertedCount = 0;
    let scriptCount = 0;

    for (const item of items) {
      const newsItem = await insertNewsItem(item, feedId, feedConfig.region, feedConfig.category);

      if (newsItem) {
        insertedCount++;

        const scriptText = convertToRadioScript(item);
        await insertRadioScript(newsItem.id, scriptText, feedConfig.region, feedConfig.category);
        scriptCount++;
      }
    }

    await updateFeedLastFetched(feedId);

    console.log(`✓ ${feedConfig.name}: ${insertedCount} new items, ${scriptCount} scripts created`);

    return {
      success: true,
      feed: feedConfig.name,
      items: insertedCount,
      scripts: scriptCount,
    };
  } catch (error) {
    console.error(`✗ Failed to process ${feedConfig.name}:`, error.message);
    return { success: false, feed: feedConfig.name, items: 0, error: error.message };
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

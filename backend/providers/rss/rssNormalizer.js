/**
 * RSS Normalizer
 * Normalizes RSS feed items to unified event schema
 */

import { detectLanguage } from '../../feedValidator.js';

/**
 * Map RSS category to event category
 * @param {string} rssCategory - RSS feed category
 * @returns {string} Unified event category
 */
function mapCategory(rssCategory) {
  const categoryMap = {
    'news': 'news',
    'politics': 'news',
    'global': 'news',
    'regional': 'news',
    'local': 'news',
    'traffic': 'traffic',
    'alert': 'emergency',
    'emergency': 'emergency',
    'agriculture': 'agriculture',
    'tech': 'news',
    'business': 'news',
    'sports': 'sports',
    'tourism': 'tourism',
  };
  
  const lower = rssCategory?.toLowerCase() || 'news';
  return categoryMap[lower] || 'news';
}

/**
 * Map RSS category to event subcategory
 * @param {string} rssCategory - RSS feed category
 * @returns {string|null} Event subcategory
 */
function mapSubcategory(rssCategory) {
  const subcategoryMap = {
    'traffic': 'congestion',
    'alert': 'general',
    'emergency': 'general',
    'agriculture': 'farming',
    'tech': 'technology',
    'business': 'economy',
    'sports': 'general',
    'tourism': 'travel',
  };
  
  const lower = rssCategory?.toLowerCase() || '';
  return subcategoryMap[lower] || null;
}

/**
 * Determine priority based on RSS category and content
 * @param {string} category - Event category
 * @param {string} title - Item title
 * @returns {number} Priority (1-10, lower = higher)
 */
function determinePriority(category, title) {
  const titleLower = title?.toLowerCase() || '';
  
  // Critical emergencies
  if (category === 'emergency') {
    if (titleLower.includes('fatal') || titleLower.includes('death') || titleLower.includes('kill')) {
      return 2; // Fatal accidents
    }
    return 3; // Major incidents
  }
  
  // Breaking news
  if (category === 'news') {
    if (titleLower.includes('breaking') || titleLower.includes('urgent') || titleLower.includes('alert')) {
      return 3; // Breaking news
    }
    return 6; // Regular news
  }
  
  // Traffic
  if (category === 'traffic') {
    if (titleLower.includes('accident') || titleLower.includes('crash')) {
      return 3; // Accidents
    }
    return 5; // Traffic updates
  }
  
  // Default priority
  return 6;
}

/**
 * Extract geographic information from RSS item
 * @param {Object} item - RSS item
 * @param {string} region - Feed region
 * @returns {Object} Geographic data
 */
function extractGeoData(item, region) {
  const geoData = {
    country: 'CD',
    province: null,
    city: null,
    latitude: null,
    longitude: null,
  };
  
  // Map region to country
  const regionCountryMap = {
    'kinshasa': 'CD',
    'goma': 'CD',
    'lubumbashi': 'CD',
    'global': null,
    'congo': 'CD',
    'eswatini': 'SZ',
    'south-africa': 'ZA',
  };
  
  geoData.country = regionCountryMap[region] || 'CD';
  
  // Try to extract city from title or description
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  
  const cityKeywords = {
    'kinshasa': 'Kinshasa',
    'goma': 'Goma',
    'lubumbashi': 'Lubumbashi',
    'kisangani': 'Kisangani',
    'mbuji-mayi': 'Mbuji-Mayi',
    'matadi': 'Matadi',
    'bukavu': 'Bukavu',
  };
  
  for (const [keyword, city] of Object.entries(cityKeywords)) {
    if (text.includes(keyword)) {
      geoData.city = city;
      break;
    }
  }
  
  // Extract coordinates from geoRSS if available
  if (item.geo && item.geo.lat && item.geo.long) {
    geoData.latitude = parseFloat(item.geo.lat);
    geoData.longitude = parseFloat(item.geo.long);
  }
  
  return geoData;
}

/**
 * Normalize a single RSS item to unified event schema
 * @param {Object} rssItem - RSS feed item
 * @param {Object} feedConfig - Feed configuration
 * @returns {Object} Normalized event
 */
function normalizeRSSItem(rssItem, feedConfig) {
  const category = mapCategory(feedConfig.category);
  const subcategory = mapSubcategory(feedConfig.category);
  const priority = determinePriority(category, rssItem.title);
  const geoData = extractGeoData(rssItem, feedConfig.region);
  
  // Detect language
  const text = `${rssItem.title || ''} ${rssItem.description || ''}`;
  const language = feedConfig.language || detectLanguage(text) || 'fr';
  
  // Generate provider event ID from URL or title + date
  const providerEventId = rssItem.link || 
                          `${rssItem.title?.substring(0, 50)}-${rssItem.pubDate || Date.now()}`;
  
  // Clean summary
  const summary = (rssItem.description || rssItem.contentSnippet || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .substring(0, 500);
  
  // Clean description
  const description = (rssItem.content || rssItem['content:encoded'] || rssItem.description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .substring(0, 2000);
  
  // Convert pubDate to ISO 8601 format for Postgres timestamptz compatibility
  // rss-parser provides isoDate (already ISO 8601), prefer that over raw pubDate (RFC 2822)
  let occurredAt = null;
  if (rssItem.isoDate) {
    occurredAt = rssItem.isoDate;
  } else if (rssItem.pubDate) {
    try {
      const parsed = new Date(rssItem.pubDate);
      if (!isNaN(parsed.getTime())) {
        occurredAt = parsed.toISOString();
      }
    } catch (e) {
      // Skip unparseable dates
    }
  }
  
  return {
    provider: 'rss',
    provider_record_id: providerEventId,
    provider_type: feedConfig.category || 'news',
    category,
    subcategory,
    priority,
    title: rssItem.title || 'Untitled',
    summary: summary || null,
    description: description || null,
    region: feedConfig.region || 'global',
    country: geoData.country,
    province: geoData.province,
    city: geoData.city,
    latitude: geoData.latitude,
    longitude: geoData.longitude,
    status: 'active',
    verified: false,
    language,
    occurred_at: occurredAt,
    expires_at: null,
    metadata: {
      feed_name: feedConfig.name,
      feed_url: feedConfig.url,
      feed_region: feedConfig.region,
      author: rssItem.author || rssItem.creator || null,
      categories: rssItem.categories || [],
      pubDate: rssItem.pubDate || null,
      guid: rssItem.guid || null,
    },
    raw_payload: rssItem,
    raw_payload_version: 1,
    api_version: null,
  };
}

/**
 * Normalize multiple RSS items
 * @param {<Array>} rssItems - Array of RSS items
 * @param {Object} feedConfig - Feed configuration
 * @returns {Array<Array>} Array of normalized events
 */
function normalizeRSSItems(rssItems, feedConfig) {
  return rssItems.map(item => normalizeRSSItem(item, feedConfig));
}

export {
  normalizeRSSItem,
  normalizeRSSItems,
  mapCategory,
  mapSubcategory,
  determinePriority,
};

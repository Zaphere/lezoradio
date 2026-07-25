import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'content'],
      ['description', 'description']
    ]
  }
});

function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function fetchRSSFeed(feedUrl) {
  try {
     console.log(`Fetching RSS feed: ${feedUrl}`);
     const feed = await parser.parseURL(feedUrl);
     console.log(`Found ${feed.items.length} items in feed`);
     return feed.items.slice(0, 10).map(item => ({
      title: item.title || '',
      description: item.description || item.contentSnippet || '',
      content: item.content || item['content:encoded'] || item.contentSnippet || '',
      url: item.link || item.guid || '',
      published_at: toIsoDate(item.pubDate),
      author: item.creator || item.author || null,
      categories: item.categories || []
    }));
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error.message);
    return [];
  }
}

export async function fetchMultipleRSSFeeds(feedUrls) {
  const allItems = [];
  
  for (const url of feedUrls) {
    if (!url) continue;
    try {
      const items = await fetchRSSFeed(url);
      allItems.push(...items);
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error.message);
    }
  }
  
  return allItems;
}

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function insertNewsItem(item, feedId, region, category) {
  try {
    // Check if item already exists (by URL)
    const { data: existing } = await supabase
      .from('news_items')
      .select('id')
      .eq('url', item.url)
      .single();

    if (existing) {
      console.log(`Item already exists: ${item.title.substring(0, 50)}...`);
      return null;
    }

    const { data, error } = await supabase
      .from('news_items')
      .insert({
        feed_id: feedId,
        title: item.title,
        description: item.description,
        content: item.content,
        url: item.url,
        region: region,
        category: category,
        published_at: item.published_at,
        ingested_at: new Date().toISOString(),
        is_processed: false
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`Inserted: ${item.title.substring(0, 50)}...`);
    return data;
  } catch (error) {
    console.error('Error inserting news item:', error.message);
    return null;
  }
}

export async function getOrCreateFeed(name, url, region, category) {
  try {
    // Check if feed exists
    const { data: existing } = await supabase
      .from('feeds')
      .select('id')
      .eq('url', url)
      .single();

    if (existing) {
      console.log(`Feed already exists: ${name}`);
      return existing.id;
    }

    // Create new feed
    const { data, error } = await supabase
      .from('feeds')
      .insert({
        name: name,
        url: url,
        region: region,
        category: category,
        type: 'rss',
        is_active: true,
        last_fetched_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`Created new feed: ${name}`);
    return data.id;
  } catch (error) {
    console.error('Error getting/creating feed:', error.message);
    return null;
  }
}

export async function updateFeedLastFetched(feedId) {
  try {
    const { error } = await supabase
      .from('feeds')
      .update({ last_fetched_at: new Date().toISOString() })
      .eq('id', feedId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating feed last fetched:', error.message);
  }
}

export async function fetchActiveContentSources() {
  try {
    const { data, error } = await supabase
      .from('content_sources')
      .select('*')
      .eq('enabled', true)
      .order('priority');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching content sources:', error.message);
    return [];
  }
}

export async function insertRadioScript(newsItemId, scriptText, region, category) {
  try {
    const { data, error } = await supabase
      .from('radio_scripts')
      .insert({
        news_item_id: newsItemId,
        script: scriptText,
        script_text: scriptText,
        type: 'news',
        region: region,
        category: category,
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`Created radio script for news item: ${newsItemId}`);
    return data;
  } catch (error) {
    console.error('Error inserting radio script:', error.message);
    return null;
  }
}

export async function backfillMissingRadioScripts(buildScript) {
  try {
    const { data: newsItems, error } = await supabase
      .from('news_items')
      .select('id, title, description, content, region, category')
      .order('ingested_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    let count = 0;
    for (const item of newsItems || []) {
      const { data: existing } = await supabase
        .from('radio_scripts')
        .select('id')
        .eq('news_item_id', item.id)
        .maybeSingle();

      if (existing) continue;

      const scriptText = buildScript(item);
      const created = await insertRadioScript(
        item.id,
        scriptText,
        item.region || 'global',
        item.category || 'global'
      );
      if (created) count++;
    }

    if (count > 0) {
      console.log(`Backfilled ${count} missing radio scripts`);
    }
    return count;
  } catch (error) {
    console.error('Error backfilling radio scripts:', error.message);
    return 0;
  }
}

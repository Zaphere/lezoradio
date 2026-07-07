import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

// Latest convertToRadioScript with French support
function convertToRadioScript(item, region) {
  let script = '';
  const isDrc = (region || item?.region) === 'congo';
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

// Get all news items with region 'congo' that DON'T have a radio script
const { data: newsItems, error: newsError } = await supabase
  .from('news_items')
  .select('id, title, description, content, region, category')
  .eq('region', 'congo')
  .order('ingested_at', { ascending: false });

if (newsError) {
  console.error('Error fetching news items:', newsError.message);
  process.exit(1);
}

console.log(`Found ${newsItems.length} DRC news items`);

let created = 0;
let skipped = 0;

for (const item of newsItems) {
  // Check if script already exists
  const { data: existing } = await supabase
    .from('radio_scripts')
    .select('id')
    .eq('news_item_id', item.id)
    .maybeSingle();

  if (existing) {
    skipped++;
    continue;
  }

  const scriptText = convertToRadioScript(item, 'congo');
  const { error } = await supabase
    .from('radio_scripts')
    .insert({
      news_item_id: item.id,
      script: scriptText,
      script_text: scriptText,
      type: 'news',
      region: item.region || 'congo',
      category: item.category || 'general',
      is_read: false,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error(`Failed to create script for ${item.id}:`, error.message);
  } else {
    created++;
  }
}

console.log(`Created: ${created}, Skipped (already exist): ${skipped}`);

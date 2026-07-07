import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

// Check news_items for DRC region
const { data: drcNews } = await supabase.from('news_items').select('region, category').eq('region', 'congo').limit(10);
console.log('DRC news items:', drcNews?.length || 0);
if (drcNews?.length) console.log(JSON.stringify(drcNews.slice(0, 3), null, 2));

// Check feeds table
const { data: feeds } = await supabase.from('feeds').select('name, region, category, last_fetched_at').limit(30);
console.log('\nFeeds in DB:', JSON.stringify(feeds, null, 2));

// Check all unique regions in news_items
const { data: allNews } = await supabase.from('news_items').select('region');
const newsRegionCounts = {};
for (const n of allNews || []) {
  newsRegionCounts[n.region] = (newsRegionCounts[n.region] || 0) + 1;
}
console.log('\nNews item region counts:', newsRegionCounts);

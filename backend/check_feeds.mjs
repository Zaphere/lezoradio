import { pool } from './supabaseClient.js';

const { rows: drcNews } = await pool.query('SELECT region, category FROM news_items WHERE region = $1 LIMIT 10', ['congo']);
console.log('DRC news items:', drcNews?.length || 0);
if (drcNews?.length) console.log(JSON.stringify(drcNews.slice(0, 3), null, 2));

const { rows: feeds } = await pool.query('SELECT name, region, category, last_fetched_at FROM feeds LIMIT 30');
console.log('\nFeeds in DB:', JSON.stringify(feeds, null, 2));

const { rows: allNews } = await pool.query('SELECT region FROM news_items');
const newsRegionCounts = {};
for (const n of allNews || []) {
  newsRegionCounts[n.region] = (newsRegionCounts[n.region] || 0) + 1;
}
console.log('\nNews item region counts:', newsRegionCounts);

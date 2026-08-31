import { pool } from './supabaseClient.js';

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

const { rows: newsItems, rowCount } = await pool.query(
  `SELECT id, title, description, content, region, category
   FROM news_items
   WHERE region = $1
   ORDER BY ingested_at DESC`,
  ['congo']
);

if (!newsItems) {
  console.error('Error fetching news items');
  process.exit(1);
}

console.log(`Found ${rowCount} DRC news items`);

let created = 0;
let skipped = 0;

for (const item of newsItems) {
  const { rows: existing } = await pool.query(
    'SELECT id FROM radio_scripts WHERE news_item_id = $1 LIMIT 1',
    [item.id]
  );

  if (existing.length > 0) {
    skipped++;
    continue;
  }

  const scriptText = convertToRadioScript(item, 'congo');
  const { error } = await pool.query(
    `INSERT INTO radio_scripts (news_item_id, script, script_text, type, region, category, is_read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [item.id, scriptText, scriptText, 'news', item.region || 'congo', item.category || 'general', false, new Date().toISOString()]
  );

  if (error) {
    console.error(`Failed to create script for ${item.id}:`, error.message);
  } else {
    created++;
  }
}

console.log(`Created: ${created}, Skipped (already exist): ${skipped}`);

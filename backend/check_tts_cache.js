import { query, testConnection, close } from './db.js';

async function checkTTSCache() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot connect to database');
    await close();
    process.exit(1);
  }

  console.log('Checking tts_audio_cache table for data issues...\n');

  // Check column types
  const types = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tts_audio_cache'
    ORDER BY ordinal_position
  `);

  console.log('tts_audio_cache column types:');
  console.table(types.rows);

  // Check for any rows with hit_count not being integer
  const result = await query(`
    SELECT id, hit_count, pg_typeof(hit_count) as hit_count_type 
    FROM tts_audio_cache 
    LIMIT 10
  `);

  console.log('\nSample tts_audio_cache data:');
  console.table(result.rows);

  await close();
}

checkTTSCache().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

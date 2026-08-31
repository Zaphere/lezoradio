import { query, testConnection, close } from './db.js';

async function checkMusicTracks() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot connect to database');
    await close();
    process.exit(1);
  }

  console.log('Checking music_tracks and entertainment_tracks tables...\n');

  // Check music_tracks
  const musicResult = await query('SELECT COUNT(*) as count FROM music_tracks');
  console.log(`music_tracks count: ${musicResult.rows[0].count}`);

  if (musicResult.rows[0].count > 0) {
    const musicSample = await query('SELECT id, title, artist, audio_url FROM music_tracks LIMIT 5');
    console.log('\nSample music_tracks:');
    console.table(musicSample.rows);
  }

  // Check entertainment_tracks
  const entertainmentResult = await query('SELECT COUNT(*) as count FROM entertainment_tracks');
  console.log(`\nentertainment_tracks count: ${entertainmentResult.rows[0].count}`);

  if (entertainmentResult.rows[0].count > 0) {
    const entertainmentSample = await query('SELECT id, title, artist, audio_url FROM entertainment_tracks LIMIT 5');
    console.log('\nSample entertainment_tracks:');
    console.table(entertainmentSample.rows);
  }

  // Check column types for music_tracks
  const musicTypes = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'music_tracks'
    ORDER BY ordinal_position
  `);

  console.log('\nmusic_tracks column types:');
  console.table(musicTypes.rows);

  await close();
}

checkMusicTracks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

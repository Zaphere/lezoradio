import { query, testConnection, close } from './db.js';

async function checkRadioScripts() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot connect to database');
    await close();
    process.exit(1);
  }

  console.log('Checking radio_scripts table for data issues...\n');

  // Check for any rows with is_read not being boolean
  const result = await query(`
    SELECT id, is_read, pg_typeof(is_read) as is_read_type 
    FROM radio_scripts 
    WHERE is_read IS NOT NULL 
    LIMIT 10
  `);

  console.log('Sample radio_scripts data:');
  console.table(result.rows);

  // Check column types
  const types = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'radio_scripts'
    ORDER BY ordinal_position
  `);

  console.log('\nradio_scripts column types:');
  console.table(types.rows);

  // Check if there are any rows where id might be wrong type
  const idCheck = await query(`
    SELECT id, pg_typeof(id) as id_type 
    FROM radio_scripts 
    LIMIT 5
  `);

  console.log('\nradio_scripts id types:');
  console.table(idCheck.rows);

  await close();
}

checkRadioScripts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

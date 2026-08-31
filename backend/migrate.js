import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection, close } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Ensure the migrations tracking table exists.
 */
async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT now(),
      duration_ms INT
    );
  `);
}

/**
 * Get list of already-applied migrations.
 */
async function getAppliedMigrations() {
  const result = await query('SELECT filename FROM _migrations ORDER BY id');
  return new Set(result.rows.map(r => r.filename));
}

/**
 * Get all migration files sorted by filename.
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    return [];
  }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

/**
 * Run a single migration file.
 */
async function runMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf-8');

  console.log(`\n  Applying: ${filename}`);
  const start = Date.now();

  try {
    // Split by semicolons but handle $$ delimiters for functions/triggers
    // Simple approach: execute the entire SQL as one block
    await query(sql);
    const duration = Date.now() - start;

    await query(
      'INSERT INTO _migrations (filename, duration_ms) VALUES ($1, $2)',
      [filename, duration]
    );

    console.log(`  ✓ Applied in ${duration}ms`);
    return true;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    console.error(`  SQL file: ${filepath}`);
    return false;
  }
}

/**
 * Run all pending migrations.
 */
async function migrate() {
  console.log('=== Radio Lezo Database Migrator ===\n');

  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot connect to database. Aborting.');
    await close();
    process.exit(1);
  }

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();

  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('Database is up to date. No pending migrations.');
    await close();
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):`);
  pending.forEach(f => console.log(`  - ${f}`));

  let successCount = 0;
  let failCount = 0;

  for (const filename of pending) {
    const ok = await runMigration(filename);
    if (ok) {
      successCount++;
    } else {
      failCount++;
      console.log('\nMigration stopped due to error.');
      console.log(`Applied: ${successCount}, Failed: ${failCount}`);
      await close();
      process.exit(1);
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Applied: ${successCount}`);
  console.log(`Total migrations: ${applied.size + successCount}`);

  await close();
}

/**
 * Show migration status.
 */
async function status() {
  console.log('=== Migration Status ===\n');

  const connected = await testConnection();
  if (!connected) {
    await close();
    process.exit(1);
  }

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();

  console.log('Applied migrations:');
  if (applied.size === 0) {
    console.log('  (none)');
  } else {
    for (const f of files) {
      if (applied.has(f)) {
        console.log(`  ✓ ${f}`);
      }
    }
  }

  const pending = files.filter(f => !applied.has(f));
  console.log(`\nPending migrations: ${pending.length}`);
  pending.forEach(f => console.log(`  - ${f}`));

  await close();
}

// CLI
const command = process.argv[2];

if (command === 'status') {
  status().catch(err => { console.error(err); process.exit(1); });
} else {
  migrate().catch(err => { console.error(err); process.exit(1); });
}

#!/usr/bin/env node
// migrate.js — Run database migrations for Radio Lezo
// Usage: node backend/migrate.js
// Safe to run multiple times — only applies pending migrations.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Support both direct PostgreSQL and Supabase
const DATABASE_URL = process.env.DATABASE_URL;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'lezoradio';
const DB_USER = process.env.DB_USER || 'lezoradio_app';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const pool = new pg.Pool(
  DATABASE_URL
    ? { connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USER, password: DB_PASSWORD, ssl: false }
);

async function ensureVersionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function getAppliedMigrations() {
  const { rows } = await pool.query('SELECT version FROM schema_version ORDER BY version');
  return rows.map(r => r.version);
}

async function applyMigration(filePath) {
  const filename = path.basename(filePath);
  const version = parseInt(filename.split('_')[0], 10);
  const name = filename.replace(/^\d+_/, '').replace('.sql', '');

  console.log(`  Applying: ${filename}`);

  const sql = fs.readFileSync(filePath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Execute the full SQL file as one transaction
    await client.query(sql);

    // Record the migration
    await client.query(
      'INSERT INTO schema_version (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
      [version, name]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`    Error: ${err.message}`);
    return false;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('=========================================');
  console.log('  Radio Lezo — Database Migrations');
  console.log('=========================================');
  console.log(`Database: ${DATABASE_URL ? '(from URL)' : `${DB_HOST}:${DB_PORT}/${DB_NAME}`}`);
  console.log('');

  try {
    // 1. Ensure schema_version table exists
    console.log('[1/3] Ensuring schema_version table...');
    await ensureVersionTable();
    console.log('  ✓ schema_version table ready');

    // 2. Get applied migrations
    console.log('[2/3] Checking applied migrations...');
    const applied = await getAppliedMigrations();
    console.log(`  Applied: ${applied.length > 0 ? applied.join(', ') : 'none'}`);

    // 3. Find and apply pending migrations
    console.log('[3/3] Scanning for pending migrations...');
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('  No migration files found.');
      return;
    }

    let appliedCount = 0;
    for (const file of migrationFiles) {
      const version = parseInt(file.split('_')[0], 10);
      if (applied.includes(version)) {
        console.log(`  Skipping: ${file} (already applied)`);
        continue;
      }

      const success = await applyMigration(path.join(MIGRATIONS_DIR, file));
      if (success) {
        console.log(`  ✓ Applied: ${file}`);
        appliedCount++;
      } else {
        console.error(`  ✗ Failed: ${file}`);
        process.exit(1);
      }
    }

    console.log('');
    console.log('=========================================');
    console.log(`  Done! Applied ${appliedCount} migration(s).`);
    console.log('=========================================');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

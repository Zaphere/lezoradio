import { pool } from './supabaseClient.js';

async function inspectSchema() {
  console.log('Testing inserts to various tables to locate the UUID error...\n');
  
  try {
    const dummyEvent = {
      provider: 'rss',
      provider_record_id: 'test-dummy-event-' + Date.now(),
      category: 'news',
      title: 'Test Event',
      status: 'active'
    };
    const { rows, error } = await pool.query(
      `INSERT INTO events (provider, provider_record_id, category, title, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dummyEvent.provider, dummyEvent.provider_record_id, dummyEvent.category, dummyEvent.title, dummyEvent.status]
    );
    if (error) {
      console.error('❌ Insert to events FAILED:', error.message, error);
    } else {
      console.log('✅ Insert to events SUCCEEDED:', rows[0].id);
      await pool.query('DELETE FROM events WHERE id = $1', [rows[0].id]);
    }
  } catch (err) {
    console.error('❌ Insert to events caught error:', err);
  }

  try {
    const dummyLog = {
      provider: 'rss',
      status: 'success',
      items_fetched: 0,
      items_inserted: 0,
      duration_ms: 100
    };
    const { rows, error } = await pool.query(
      `INSERT INTO provider_sync_logs (provider, status, items_fetched, items_inserted, duration_ms)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dummyLog.provider, dummyLog.status, dummyLog.items_fetched, dummyLog.items_inserted, dummyLog.duration_ms]
    );
    if (error) {
      console.error('❌ Insert to provider_sync_logs FAILED:', error.message, error);
    } else {
      console.log('✅ Insert to provider_sync_logs SUCCEEDED:', rows[0].id);
      await pool.query('DELETE FROM provider_sync_logs WHERE id = $1', [rows[0].id]);
    }
  } catch (err) {
    console.error('❌ Insert to provider_sync_logs caught error:', err);
  }

  try {
    const dummyConfig = {
      provider: 'rss-test-dummy-' + Date.now(),
      config: { test: true },
      enabled: true
    };
    const { rows, error } = await pool.query(
      `INSERT INTO provider_configs (provider, config, enabled)
       VALUES ($1, $2, $3) RETURNING *`,
      [dummyConfig.provider, JSON.stringify(dummyConfig.config), dummyConfig.enabled]
    );
    if (error) {
      console.error('❌ Insert to provider_configs FAILED:', error.message, error);
    } else {
      console.log('✅ Insert to provider_configs SUCCEEDED:', rows[0].id);
      await pool.query('DELETE FROM provider_configs WHERE id = $1', [rows[0].id]);
    }
  } catch (err) {
    console.error('❌ Insert to provider_configs caught error:', err);
  }
}

inspectSchema();

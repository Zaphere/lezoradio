import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
});

async function inspectSchema() {
  console.log('Testing inserts to various tables to locate the UUID error...\n');
  
  // 1. Test insert to events
  try {
    const dummyEvent = {
      provider: 'rss',
      provider_record_id: 'test-dummy-event-' + Date.now(),
      category: 'news',
      title: 'Test Event',
      status: 'active'
    };
    const { data, error } = await supabase.from('events').insert(dummyEvent).select();
    if (error) {
      console.error('❌ Insert to events FAILED:', error.message, error);
    } else {
      console.log('✅ Insert to events SUCCEEDED:', data[0].id);
      await supabase.from('events').delete().eq('id', data[0].id);
    }
  } catch (err) {
    console.error('❌ Insert to events caught error:', err);
  }

  // 2. Test insert to provider_sync_logs
  try {
    const dummyLog = {
      provider: 'rss',
      status: 'success',
      items_fetched: 0,
      items_inserted: 0,
      duration_ms: 100
    };
    const { data, error } = await supabase.from('provider_sync_logs').insert(dummyLog).select();
    if (error) {
      console.error('❌ Insert to provider_sync_logs FAILED:', error.message, error);
    } else {
      console.log('✅ Insert to provider_sync_logs SUCCEEDED:', data[0].id);
      await supabase.from('provider_sync_logs').delete().eq('id', data[0].id);
    }
  } catch (err) {
    console.error('❌ Insert to provider_sync_logs caught error:', err);
  }

  // 3. Test insert to provider_configs
  try {
    const dummyConfig = {
      provider: 'rss-test-dummy-' + Date.now(),
      config: { test: true },
      enabled: true
    };
    const { data, error } = await supabase.from('provider_configs').insert(dummyConfig).select();
    if (error) {
      console.error('❌ Insert to provider_configs FAILED:', error.message, error);
    } else {
      console.log('✅ Insert to provider_configs SUCCEEDED:', data[0].id);
      await supabase.from('provider_configs').delete().eq('id', data[0].id);
    }
  } catch (err) {
    console.error('❌ Insert to provider_configs caught error:', err);
  }
}

inspectSchema();

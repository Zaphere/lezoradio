import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';
import RSSProvider from './providers/rss/rssProvider.js';
import { validateEvent } from './providers/validator.js';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
});

async function debugRssSync() {
  console.log('Debugging RSS Provider sync...');
  const provider = new RSSProvider({ enabled: true });
  await provider.initialize();
  
  const result = await provider.sync();
  console.log(`Sync returned ${result.events.length} events.`);
  
  if (result.errors) {
    console.log('Errors from provider.sync():', result.errors);
  }
  
  if (result.events.length > 0) {
    const firstEvent = result.events[0];
    console.log('First event:', JSON.stringify(firstEvent, null, 2));
    
    // Now let's try to insert it using supabase client directly to see the exact error
    const { data, error } = await supabase.from('events').insert(firstEvent).select();
    if (error) {
      console.error('Error inserting first event:', error);
    } else {
      console.log('Successfully inserted first event. ID:', data[0].id);
      await supabase.from('events').delete().eq('id', data[0].id);
    }
  }
}

debugRssSync().catch(err => console.error('Unhandled error:', err));

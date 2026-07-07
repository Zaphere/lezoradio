import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

const { data } = await supabase
  .from('radio_scripts')
  .select('script, region, category')
  .eq('region', 'congo')
  .limit(5);

for (const s of data || []) {
  console.log('---');
  console.log('Category:', s.category);
  console.log('Script:', s.script.substring(0, 300));
}

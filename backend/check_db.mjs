import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });

const { data: scripts } = await supabase.from('radio_scripts').select('region, category').limit(20);
console.log('Sample scripts:', JSON.stringify(scripts, null, 2));

const { count: total } = await supabase.from('radio_scripts').select('id', { count: 'exact', head: true });
console.log('Total scripts:', total);

const { data: regions } = await supabase.from('radio_scripts').select('region');
const regionCounts = {};
for (const r of regions || []) {
  regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
}
console.log('Region counts:', regionCounts);

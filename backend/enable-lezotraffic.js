/**
 * Enable LezoTraffic provider
 */

import { supabase } from './supabaseClient.js';

async function enableLezoTraffic() {
  console.log('Enabling LezoTraffic provider...\n');

  const { data, error } = await supabase
    .from('provider_configs')
    .update({ enabled: true })
    .eq('provider', 'lezotraffic')
    .select();

  if (error) {
    console.error('Error enabling LezoTraffic provider:', error.message);
  } else {
    console.log('LezoTraffic provider enabled successfully');
    console.log('Config:', data);
  }
}

enableLezoTraffic();

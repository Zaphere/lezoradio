/**
 * Debug LezoTraffic sync to see what data is being fetched
 */

import dotenv from 'dotenv';
dotenv.config();

import LezoTrafficProvider from './providers/lezotraffic/lezoTrafficProvider.js';
import { getConfig } from './providers/lezotraffic/config.js';

async function debugLezoTraffic() {
  console.log('Debugging LezoTraffic sync...\n');

  const config = getConfig();
  console.log('Config:', JSON.stringify(config, null, 2));

  const provider = new LezoTrafficProvider({
    enabled: true,
    config: config,
    apiKey: process.env.LEZOTRAFFIC_CLIENT_ID,
    apiSecret: process.env.LEZOTRAFFIC_CLIENT_SECRET,
  });

  try {
    await provider.initialize();
    console.log('Initialized successfully');

    await provider.authenticate();
    console.log('Authenticated successfully');

    const syncResult = await provider.sync();
    console.log('Sync result:', JSON.stringify(syncResult, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await provider.shutdown();
  }
}

debugLezoTraffic();

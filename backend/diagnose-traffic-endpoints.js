/**
 * Diagnostic script to test LezoTraffic API endpoints
 * Run: node diagnose-traffic-endpoints.js
 */

import dotenv from 'dotenv';
dotenv.config();

import LezoTrafficApiClient from './providers/lezotraffic/apiClient.js';
import { LEZOTRAFFIC_ENDPOINTS } from './providers/lezotraffic/endpoints.js';
import { normalizeLezoTrafficItems } from './providers/lezotraffic/normalizer.js';

const TRAFFIC_ENDPOINTS = [
  { name: 'incidents', path: LEZOTRAFFIC_ENDPOINTS.INCIDENTS },
  { name: 'accidents', path: LEZOTRAFFIC_ENDPOINTS.ACCIDENTS },
  { name: 'traffic_jams', path: LEZOTRAFFIC_ENDPOINTS.TRAFFIC_JAMS },
  { name: 'roadworks', path: LEZOTRAFFIC_ENDPOINTS.ROADWORKS },
  { name: 'routes', path: LEZOTRAFFIC_ENDPOINTS.ROUTES },
  { name: 'transports', path: LEZOTRAFFIC_ENDPOINTS.TRANSPORTS },
  { name: 'alerts', path: LEZOTRAFFIC_ENDPOINTS.ALERTS },
];

const GEO_ENDPOINTS = [
  { name: 'cities', path: LEZOTRAFFIC_ENDPOINTS.CITIES },
  { name: 'provinces', path: LEZOTRAFFIC_ENDPOINTS.PROVINCES },
  { name: 'destinations', path: LEZOTRAFFIC_ENDPOINTS.DESTINATIONS },
];

async function diagnoseEndpoints() {
  console.log('=== LezoTraffic API Diagnostic ===\n');

  const client = new LezoTrafficApiClient({
    baseUrl: process.env.LEZOTRAFFIC_BASE_URL || 'https://app.lezotraffic.com/api/v1',
    apiKey: process.env.LEZOTRAFFIC_CLIENT_ID,
    apiSecret: process.env.LEZOTRAFFIC_CLIENT_SECRET,
    timeout: 15000,
    maxRetries: 1,
  });

  // Authenticate first
  console.log('Authenticating...');
  try {
    await client.getAuthManager().authenticate();
    console.log('Authentication: OK\n');
  } catch (error) {
    console.error('Authentication FAILED:', error.message);
    console.error('Check LEZOTRAFFIC_CLIENT_ID and LEZOTRAFFIC_CLIENT_SECRET in .env');
    return;
  }

  // Test GEO endpoints first (known working)
  console.log('--- GEO Endpoints (baseline) ---');
  for (const endpoint of GEO_ENDPOINTS) {
    await testEndpoint(client, endpoint);
  }

  console.log('\n--- Traffic Endpoints ---');
  for (const endpoint of TRAFFIC_ENDPOINTS) {
    await testEndpoint(client, endpoint);
  }

  console.log('\n=== Diagnostic Complete ===');
}

async function testEndpoint(client, endpoint) {
  console.log(`\n${endpoint.name} (${endpoint.path}):`);
  
  try {
    const startTime = Date.now();
    const data = await client.get(endpoint.path, { limit: 5 });
    const duration = Date.now() - startTime;
    
    const items = Array.isArray(data) ? data : [];
    console.log(`  Status: OK (${duration}ms)`);
    console.log(`  Items returned: ${items.length}`);
    
    if (items.length > 0) {
      const firstItem = items[0];
      console.log(`  First item keys: ${Object.keys(firstItem).join(', ')}`);
      console.log(`  First item sample:`, JSON.stringify(firstItem, null, 2).substring(0, 500));
      
      // Test normalization
      const events = normalizeLezoTrafficItems(items, endpoint.path);
      console.log(`  Normalized events: ${events.length}`);
      if (events.length > 0) {
        console.log(`  Event category: ${events[0].category}`);
        console.log(`  Event subcategory: ${events[0].subcategory}`);
      }
    }
  } catch (error) {
    console.log(`  Status: FAILED`);
    console.log(`  Error: ${error.message}`);
    if (error.httpStatus) {
      console.log(`  HTTP Status: ${error.httpStatus}`);
    }
  }
}

diagnoseEndpoints().catch(console.error);

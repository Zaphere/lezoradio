/**
 * Test LezoTraffic API endpoints directly to check for fresh data
 */

import './env.js';
import LezoTrafficApiClient from './providers/lezotraffic/apiClient.js';
import { getConfig, getEnabledEndpoints } from './providers/lezotraffic/config.js';
import { LEZOTRAFFIC_ENDPOINTS } from './providers/lezotraffic/endpoints.js';

// Endpoint mapping from config names to API paths
const ENDPOINT_MAP = {
  alerts: { path: LEZOTRAFFIC_ENDPOINTS.ALERTS, params: (opts) => ({ page: 1, limit: opts.limit || 20 }) },
  incidents: { path: LEZOTRAFFIC_ENDPOINTS.INCIDENTS, params: (opts) => ({ page: 1, limit: opts.limit || 20, country: opts.country }) },
  traffic_jams: { path: LEZOTRAFFIC_ENDPOINTS.TRAFFIC_JAMS, params: (opts) => ({ page: 1, limit: opts.limit || 20 }) },
  accidents: { path: LEZOTRAFFIC_ENDPOINTS.ACCIDENTS, params: (opts) => ({ page: 1, limit: opts.limit || 20 }) },
  roadworks: { path: LEZOTRAFFIC_ENDPOINTS.ROADWORKS, params: (opts) => ({ page: 1, limit: opts.limit || 20 }) },
  routes: { path: LEZOTRAFFIC_ENDPOINTS.ROUTES, params: (opts) => ({ page: 1, limit: opts.limit || 20 }) },
  transports: { path: LEZOTRAFFIC_ENDPOINTS.TRANSPORTS, params: (opts) => ({ page: 1, limit: opts.limit || 20 }) },
  cities: { path: LEZOTRAFFIC_ENDPOINTS.CITIES, params: (opts) => ({ limit: opts.limit || 20 }) },
  provinces: { path: LEZOTRAFFIC_ENDPOINTS.PROVINCES, params: (opts) => ({ limit: opts.limit || 20 }) },
  destinations: { path: LEZOTRAFFIC_ENDPOINTS.DESTINATIONS, params: (opts) => ({ limit: opts.limit || 20 }) },
};

async function testLezoTrafficAPI() {
  console.log('Testing LezoTraffic API endpoints...\n');

  const config = getConfig();
  console.log('Configuration:');
  console.log(`  Base URL: ${config.baseUrl}`);
  console.log(`  API Key: ${config.apiKey ? 'Present' : 'Missing'}`);
  console.log(`  API Secret: ${config.apiSecret ? 'Present' : 'Missing'}`);
  console.log(`  Country filter: ${config.filters.country}`);
  console.log(`  Enabled endpoints: ${getEnabledEndpoints(config).join(', ')}\n`);

  const apiClient = new LezoTrafficApiClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    timeout: 15000,
    maxRetries: 2,
    retryDelay: 1000,
  });

  try {
    console.log('Authenticating...');
    await apiClient.getAuthManager().ensureAuthenticated();
    console.log('✓ Authentication successful\n');

    const enabledEndpoints = getEnabledEndpoints(config);
    const results = [];

    for (const endpoint of enabledEndpoints) {
      const endpointConfig = ENDPOINT_MAP[endpoint];
      if (!endpointConfig) {
        console.log(`⚠ Unknown endpoint: ${endpoint}`);
        continue;
      }

      console.log(`Testing endpoint: ${endpoint} -> ${endpointConfig.path}`);
      
      try {
        const queryParams = endpointConfig.params({
          ...config.filters,
          limit: 5,
        });

        const startTime = Date.now();
        const data = await apiClient.get(endpointConfig.path, queryParams);
        const duration = Date.now() - startTime;

        const items = Array.isArray(data) ? data : [];
        
        console.log(`  ✓ Success: ${items.length} items returned in ${duration}ms`);
        
        if (items.length > 0) {
          const sample = items[0];
          console.log(`  Sample item keys: ${Object.keys(sample).join(', ')}`);
          if (sample.id) console.log(`  Sample ID: ${sample.id}`);
          if (sample.created_at || sample.timestamp) {
            const timestamp = sample.created_at || sample.timestamp;
            console.log(`  Sample timestamp: ${timestamp}`);
          }
        }

        results.push({
          endpoint,
          path: endpointConfig.path,
          success: true,
          itemCount: items.length,
          duration,
        });
      } catch (error) {
        console.log(`  ✗ Failed: ${error.message}`);
        console.log(`  HTTP Status: ${error.httpStatus || 'N/A'}`);
        results.push({
          endpoint,
          path: endpointConfig.path,
          success: false,
          error: error.message,
          httpStatus: error.httpStatus,
        });
      }
      console.log('');
    }

    console.log('=== SUMMARY ===');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    console.log(`Total endpoints tested: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    if (successful.length > 0) {
      const totalItems = successful.reduce((sum, r) => sum + r.itemCount, 0);
      console.log(`Total items received: ${totalItems}`);
    }

    if (failed.length > 0) {
      console.log('\nFailed endpoints:');
      failed.forEach(f => {
        console.log(`  - ${f.endpoint}: ${f.error} (HTTP ${f.httpStatus})`);
      });
    }

    const stats = apiClient.getStats();
    console.log('\nAPI Client Stats:');
    console.log(`  Total requests: ${stats.requestCount}`);
    console.log(`  Successful: ${stats.requestCount - stats.errorCount}`);
    console.log(`  Failed: ${stats.errorCount}`);
    console.log(`  Error rate: ${stats.errorRate.toFixed(2)}%`);

  } catch (error) {
    console.error('Fatal error during API test:', error.message);
  }
}

testLezoTrafficAPI();

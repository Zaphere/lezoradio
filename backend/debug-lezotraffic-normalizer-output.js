/**
 * Debug LezoTraffic normalizer output to see what's being generated
 */

import dotenv from 'dotenv';
dotenv.config();

import LezoTrafficProvider from './providers/lezotraffic/lezoTrafficProvider.js';
import { getConfig } from './providers/lezotraffic/config.js';
import { normalizeLezoTrafficItems } from './providers/lezotraffic/normalizer.js';

async function debugNormalizer() {
  console.log('Debugging LezoTraffic normalizer output...\n');

  // Test import first
  console.log('Testing import...');
  console.log('normalizeLezoTrafficItems function:', typeof normalizeLezoTrafficItems);

  const config = getConfig();
  const provider = new LezoTrafficProvider({
    enabled: true,
    config: config,
    apiKey: process.env.LEZOTRAFFIC_CLIENT_ID,
    apiSecret: process.env.LEZOTRAFFIC_CLIENT_SECRET,
  });

  try {
    await provider.initialize();
    await provider.authenticate();
    
    // Test alerts endpoint specifically
    console.log('Testing alerts endpoint...\n');
    const apiClient = provider.apiClient;
    const alertsResponse = await apiClient.get('/alertes');
    
    console.log('Alerts response:', JSON.stringify(alertsResponse, null, 2));
    
    if (alertsResponse.data && alertsResponse.data.length > 0) {
      const alertItem = alertsResponse.data[0];
      console.log('\nFirst alert item:', JSON.stringify(alertItem, null, 2));
      
      // Test normalizer directly
      console.log('\nCalling normalizeLezoTrafficItems...');
      const normalizedAlerts = normalizeLezoTrafficItems(alertsResponse.data, '/alertes');
      console.log('normalizeLezoTrafficItems returned:', normalizedAlerts);
      
      console.log('\nNormalized alerts count:', normalizedAlerts.length);
      if (normalizedAlerts.length > 0) {
        console.log('\nNormalized alerts:', JSON.stringify(normalizedAlerts, null, 2));
        normalizedAlerts.forEach((alert, i) => {
          console.log(`Alert ${i} provider_record_id: "${alert.provider_record_id}" (length: ${alert.provider_record_id?.length})`);
          console.log(`Alert ${i} category: "${alert.category}"`);
          console.log(`Alert ${i} title: "${alert.title}"`);
        });
      } else {
        console.log('No normalized alerts returned!');
      }
    }
    
    // Test cities endpoint specifically
    console.log('\n\nTesting cities endpoint...\n');
    const citiesResponse = await apiClient.get('/villes');
    
    console.log('Cities response:', JSON.stringify(citiesResponse, null, 2));
    
    if (citiesResponse.data && citiesResponse.data.length > 0) {
      const cityItem = citiesResponse.data[0];
      console.log('\nFirst city item:', JSON.stringify(cityItem, null, 2));
      
      // Test normalizer directly
      const { normalizeLezoTrafficItems } = await import('./providers/lezotraffic/normalizer.js');
      const normalizedCities = normalizeLezoTrafficItems(citiesResponse.data, '/villes');
      
      console.log('\nNormalized cities:', JSON.stringify(normalizedCities, null, 2));
      normalizedCities.forEach((city, i) => {
        console.log(`City ${i} provider_record_id: "${city.provider_record_id}"`);
        console.log(`City ${i} category: "${city.category}"`);
      });
    }
    
    // Test provinces endpoint
    console.log('\n\nTesting provinces endpoint...\n');
    const provincesResponse = await apiClient.get('/provinces');
    
    console.log('Provinces response:', JSON.stringify(provincesResponse, null, 2));
    
    if (provincesResponse.data && provincesResponse.data.length > 0) {
      const provinceItem = provincesResponse.data[0];
      console.log('\nFirst province item:', JSON.stringify(provinceItem, null, 2));
      
      // Test normalizer directly
      const { normalizeLezoTrafficItems } = await import('./providers/lezotraffic/normalizer.js');
      const normalizedProvinces = normalizeLezoTrafficItems(provincesResponse.data, '/provinces');
      
      console.log('\nNormalized provinces:', JSON.stringify(normalizedProvinces, null, 2));
      normalizedProvinces.forEach((province, i) => {
        console.log(`Province ${i} provider_record_id: "${province.provider_record_id}"`);
        console.log(`Province ${i} category: "${province.category}"`);
      });
    }
    
    await provider.shutdown();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugNormalizer();

/**
 * Test script for LezoTraffic API connection with actual data fetching
 */

const BASE_URL = 'https://app.lezotraffic.com/api/v1';
const CLIENT_ID = 'lzpk_live_5dfb3c403780f2486a29e4ef9b62dce9';
const CLIENT_SECRET = 'lzps_kqq0W8jzZTB0oq0q2yPX58YhoCyXfQwNbtisl5RjQ5Q';

async function getAccessToken() {
  console.log('Getting access token...');
  try {
    const response = await fetch(`${BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: CLIENT_ID,
        apiSecret: CLIENT_SECRET,
      }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      console.log('✓ Access token obtained');
      return data.data.accessToken;
    }
    throw new Error('Failed to get access token');
  } catch (error) {
    console.error('Failed to get access token:', error.message);
    return null;
  }
}

async function testEndpoint(endpoint, token) {
  console.log(`\nTesting endpoint: ${endpoint}`);
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept': '*/*',
      },
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    if (response.ok && data.success) {
      const items = Array.isArray(data.data) ? data.data : (data.data?.items || []);
      console.log(`✓ Success: ${items.length} items`);
      if (items.length > 0) {
        console.log('Sample item:', JSON.stringify(items[0], null, 2));
      }
      return items;
    } else {
      console.log('✗ Failed:', data.error?.message || 'Unknown error');
      return [];
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    return [];
  }
}

async function runTests() {
  console.log('=== LezoTraffic API Data Fetch Tests ===\n');
  
  const token = await getAccessToken();
  if (!token) {
    console.log('Cannot proceed without access token');
    return;
  }

  const endpoints = [
    '/alertes',
    '/incidents?city=Goma',
    '/embouteillages?city=Goma',
    '/accidents?city=Goma',
    '/travaux?city=Goma',
    '/transports',
    '/routes',
    '/villes',
    '/provinces',
    '/destinations?city=Goma',
  ];

  let totalItems = 0;
  for (const endpoint of endpoints) {
    const items = await testEndpoint(endpoint, token);
    totalItems += items.length;
  }

  console.log(`\n=== Total items fetched: ${totalItems} ===`);
}

runTests();

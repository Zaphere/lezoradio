/**
 * Test LezoTraffic normalizer directly
 */

import { normalizeLezoTrafficItems } from './providers/lezotraffic/normalizer.js';

// Test data from LezoTraffic API
const testData = [
  {
    id: 'test-123',
    type: 'alert',
    message: 'Test alert message',
    incident: {
      type: 'Police',
      severity: 'high',
      location: 'Goma',
      coordinates: {
        latitude: -1.6785,
        longitude: 29.2295
      }
    }
  }
];

console.log('Testing LezoTraffic normalizer...\n');

const normalized = normalizeLezoTrafficItems(testData, '/alertes');

console.log('Normalized events:');
normalized.forEach(event => {
  console.log(JSON.stringify(event, null, 2));
});

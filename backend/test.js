import { ingestAllFeeds } from './ingestionService.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Running one-time RSS ingestion test...\n');

ingestAllFeeds()
  .then(() => {
    console.log('\n✓ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  });

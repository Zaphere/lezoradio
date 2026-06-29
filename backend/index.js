import cron from 'node-cron';
import { ingestAllFeeds } from './ingestionService.js';
import { startApiServer } from './server.js';
import dotenv from 'dotenv';

dotenv.config();

const SCHEDULE = process.env.INGESTION_SCHEDULE || '*/15 * * * *';
const PORT = process.env.PORT || 3001;

console.log('========================================');
console.log('Radiolezo RSS Ingestion Service');
console.log('========================================');
console.log(`Schedule: ${SCHEDULE}`);
console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'configured' : 'NOT CONFIGURED'}`);
console.log('========================================\n');

// Start Express API (health check + RSS proxy for frontend diagnostics)
startApiServer(PORT);

async function runIngestion() {
  try {
    await ingestAllFeeds();
  } catch (error) {
    console.error('Ingestion failed:', error);
  }
}

console.log('Running initial ingestion...');
runIngestion();

console.log(`Scheduling recurring ingestion (cron: ${SCHEDULE})...`);

const task = cron.schedule(SCHEDULE, async () => {
  console.log('\n⏰ Scheduled ingestion triggered');
  await runIngestion();
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  task.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  task.stop();
  process.exit(0);
});

console.log('✓ Service started. Press Ctrl+C to stop.\n');

import cron from 'node-cron';
import { ingestAllFeeds } from './ingestionService.js';
import { deleteExpiredContent } from './expiryCleanup.js';
import { startApiServer } from './server.js';
import dotenv from 'dotenv';
import registry from './providers/providerRegistry.js';
import scheduler from './providers/providerScheduler.js';
import healthMonitor from './providers/providerHealthMonitor.js';
import providerFramework from './providers/providerFramework.js';
import { registerProvider } from './providers/validator.js';
import RSSProvider from './providers/rss/rssProvider.js';
import LezoTrafficProvider from './providers/lezotraffic/lezoTrafficProvider.js';

dotenv.config();

const SCHEDULE = process.env.INGESTION_SCHEDULE || '*/15 * * * *';
const EXPIRY_SCHEDULE = process.env.EXPIRY_SCHEDULE || '0 * * * *';
const PORT = process.env.PORT || 3001;
const USE_PROVIDER_FRAMEWORK = process.env.USE_PROVIDER_FRAMEWORK === 'true';

console.log('========================================');
console.log('Radiolezo RSS Ingestion Service');
console.log('========================================');
console.log(`Ingestion schedule: ${SCHEDULE}`);
console.log(`Expiry schedule: ${EXPIRY_SCHEDULE}`);
console.log(`Retention: ${process.env.NEWS_RETENTION_HOURS || 24}h`);
console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'configured' : 'NOT CONFIGURED'}`);
console.log(`Provider Framework: ${USE_PROVIDER_FRAMEWORK ? 'ENABLED' : 'DISABLED (using legacy)'}`);
console.log('========================================\n');

// Start Express API (health check + RSS proxy + expiry trigger)
startApiServer(PORT);

async function runIngestion() {
  try {
    await ingestAllFeeds();
  } catch (error) {
    console.error('Ingestion failed:', error);
  }
}

async function runExpiry() {
  try {
    await deleteExpiredContent();
  } catch (error) {
    console.error('Expiry cleanup failed:', error);
  }
}

// Provider Framework Initialization
async function initializeProviderFramework() {
  console.log('========================================');
  console.log('Initializing Provider Framework');
  console.log('========================================');
  
  try {
    // Register RSS provider
    const rssProvider = new RSSProvider({
      enabled: process.env.RSS_ENABLED !== 'false',
      language: process.env.RSS_LANGUAGE || 'fr',
    });
    registry.register(rssProvider);
    registerProvider('rss');
    
    // Register LezoTraffic provider if enabled
    if (process.env.LEZOTRAFFIC_ENABLED === 'true') {
      const lezoTrafficProvider = new LezoTrafficProvider({
        enabled: true,
      });
      registry.register(lezoTrafficProvider);
      registerProvider('lezotraffic');
    }
    
    // Initialize provider framework
    await providerFramework.initialize();
    
    // Load configurations from database
    await registry.loadConfigurations();
    
    // Initialize all providers
    await registry.initializeAll();
    
    // Authenticate all providers
    await registry.authenticateAll();
    
    // Start health monitoring
    healthMonitor.start();
    
    // Start provider scheduler
    const schedules = {
      rss: process.env.RSS_SCHEDULE || SCHEDULE,
      lezotraffic: process.env.LEZOTRAFFIC_SCHEDULE || '*/1 * * * *',
    };
    scheduler.start(schedules);
    
    console.log('========================================');
    console.log('Provider Framework Initialized');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('Failed to initialize provider framework:', error);
    console.log('Falling back to legacy RSS ingestion\n');
  }
}

// Shutdown handler for provider framework
async function shutdownProviderFramework() {
  console.log('Shutting down provider framework...');
  
  try {
    scheduler.stop();
    healthMonitor.stop();
    await registry.shutdownAll();
    console.log('Provider framework shut down successfully');
  } catch (error) {
    console.error('Error shutting down provider framework:', error);
  }
}

if (USE_PROVIDER_FRAMEWORK) {
  initializeProviderFramework().then(() => {
    console.log('Running initial provider sync...');
    scheduler.syncAll();
  }).catch(error => {
    console.error('Provider framework initialization failed:', error);
  });
}

// Always run legacy ingestion (provides radio_scripts + news_items)
console.log('Running initial legacy ingestion...');
runIngestion();

console.log(`Scheduling recurring legacy ingestion (cron: ${SCHEDULE})...`);
const ingestionTask = cron.schedule(SCHEDULE, async () => {
  console.log('\n⏰ Scheduled ingestion triggered');
  await runIngestion();
});

console.log(`Scheduling content expiry cleanup (cron: ${EXPIRY_SCHEDULE})...`);
const expiryTask = cron.schedule(EXPIRY_SCHEDULE, async () => {
  console.log('\n⏰ Scheduled expiry cleanup triggered');
  await runExpiry();
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (USE_PROVIDER_FRAMEWORK) {
    await shutdownProviderFramework();
  }
  
  expiryTask.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (USE_PROVIDER_FRAMEWORK) {
    await shutdownProviderFramework();
  }
  
  expiryTask.stop();
  process.exit(0);
});

console.log('✓ Service started. Press Ctrl+C to stop.\n');

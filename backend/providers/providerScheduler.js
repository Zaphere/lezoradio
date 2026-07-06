import cron from 'node-cron';
import registry from './providerRegistry.js';
import providerFramework from './providerFramework.js';

class ProviderScheduler {
  constructor() {
    this.scheduledTasks = new Map();
    this.running = false;
    this.defaultSchedule = '*/15 * * * *';
  }

  start(schedules = {}) {
    if (this.running) {
      console.warn('[ProviderScheduler] Already running');
      return;
    }

    console.log('[ProviderScheduler] Starting provider scheduler...');
    this.running = true;

    const enabledProviders = registry.getEnabled();
    console.log(`[ProviderScheduler] Scheduling ${enabledProviders.length} enabled providers`);

    for (const provider of enabledProviders) {
      const schedule = schedules[provider.providerId] ||
                       provider.config?.sync_schedule ||
                       this.defaultSchedule;

      this.scheduleProvider(provider, schedule);
    }

    console.log('[ProviderScheduler] Scheduler started');
  }

  scheduleProvider(provider, cronExpression) {
    if (this.scheduledTasks.has(provider.providerId)) {
      console.warn(`[ProviderScheduler] Provider ${provider.providerId} already scheduled`);
      return;
    }

    console.log(`[ProviderScheduler] Scheduling ${provider.providerId} with cron: ${cronExpression}`);

    const task = cron.schedule(cronExpression, async () => {
      await this.syncProvider(provider);
    }, {
      scheduled: false,
    });

    this.scheduledTasks.set(provider.providerId, task);
    task.start();
  }

  async syncProvider(provider) {
    if (!provider.enabled) {
      console.log(`[ProviderScheduler] Skipping disabled provider: ${provider.providerId}`);
      return;
    }

    console.log(`[ProviderScheduler] Syncing provider: ${provider.providerId}`);
    const startTime = Date.now();

    try {
      const syncResult = await provider.withTiming(async () => {
        return await provider.sync();
      });

      const events = syncResult.events || [];
      const syncContext = syncResult.syncContext || {};

      const result = await providerFramework.ingestEvents(
        provider.providerId,
        events,
        syncContext
      );

      const totalInserted = result.inserted.length;
      const totalSkipped = result.skipped.length;
      const totalErrors = result.errors.length;

      provider.updateSyncStatus(
        totalErrors > 0 && totalInserted === 0 ? 'fail' :
        totalErrors > 0 ? 'partial' : 'success',
        totalInserted
      );

      console.log(
        `[ProviderScheduler] Sync complete: ${provider.providerId} - ` +
        `${totalInserted} inserted, ${totalSkipped} skipped, ${totalErrors} errors`
      );

    } catch (error) {
      provider.updateSyncStatus('fail');
      console.error(`[ProviderScheduler] Sync failed: ${provider.providerId} - ${error.message}`);
    }
  }

  async manualSync(providerId) {
    const provider = registry.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    if (!provider.enabled) {
      throw new Error(`Provider is disabled: ${providerId}`);
    }

    console.log(`[ProviderScheduler] Manual sync triggered: ${providerId}`);
    await this.syncProvider(provider);

    return {
      provider: providerId,
      status: provider.lastSyncStatus,
      last_sync: provider.lastSyncAt,
    };
  }

  async syncAll() {
    console.log('[ProviderScheduler] Manual sync triggered for all providers');

    const enabledProviders = registry.getEnabled();
    const results = [];

    for (const provider of enabledProviders) {
      try {
        await this.syncProvider(provider);
        results.push({
          provider: provider.providerId,
          status: provider.lastSyncStatus,
          last_sync: provider.lastSyncAt,
        });
      } catch (error) {
        results.push({
          provider: provider.providerId,
          status: 'error',
          error: error.message,
        });
      }
    }

    return results;
  }

  stop() {
    if (!this.running) {
      console.warn('[ProviderScheduler] Not running');
      return;
    }

    console.log('[ProviderScheduler] Stopping provider scheduler...');

    for (const [providerId, task] of this.scheduledTasks) {
      task.stop();
      console.log(`[ProviderScheduler] Stopped: ${providerId}`);
    }

    this.scheduledTasks.clear();
    this.running = false;
    console.log('[ProviderScheduler] Scheduler stopped');
  }

  updateSchedule(providerId, cronExpression) {
    const provider = registry.get(providerId);
    if (!provider) {
      console.error(`[ProviderScheduler] Provider not found: ${providerId}`);
      return false;
    }

    const existingTask = this.scheduledTasks.get(providerId);
    if (existingTask) {
      existingTask.stop();
      this.scheduledTasks.delete(providerId);
    }

    this.scheduleProvider(provider, cronExpression);
    console.log(`[ProviderScheduler] Updated schedule for ${providerId}: ${cronExpression}`);
    return true;
  }

  getStatus() {
    return {
      running: this.running,
      scheduledProviders: Array.from(this.scheduledTasks.keys()),
      totalProviders: registry.getAll().length,
      enabledProviders: registry.getEnabled().length,
    };
  }
}

const scheduler = new ProviderScheduler();
export default scheduler;

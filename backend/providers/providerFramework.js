import crypto from 'crypto';
import { validateEvent } from './validator.js';
import { insertEvent, logProviderSync } from '../supabaseClient.js';

class ProviderFramework {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  generateProviderHash(provider, providerEventId) {
    return crypto
      .createHash('sha256')
      .update(`${provider}:${providerEventId}`)
      .digest('hex');
  }

  async ingestEvents(providerId, events, syncContext = {}) {
    if (!this.initialized) {
      throw new Error('ProviderFramework not initialized');
    }

    const metrics = {
      provider: providerId,
      authentication: null,
      requests: null,
      normalization: {
        input: Array.isArray(events) ? events.length : 0,
        output: 0,
        errors: 0,
      },
      database: {
        inserted: 0,
        skipped: 0,
        errors: 0,
      },
      scheduler: {
        sync_start: syncContext.sync_start || new Date().toISOString(),
        sync_end: null,
        duration_ms: 0,
      },
    };

    if (syncContext.authentication) {
      metrics.authentication = syncContext.authentication;
    }

    if (syncContext.requests) {
      metrics.requests = syncContext.requests;
    }

    const startTime = Date.now();
    const inserted = [];
    const skipped = [];
    const errors = [];

    if (!Array.isArray(events)) {
      metrics.database.errors++;
      metrics.scheduler.sync_end = new Date().toISOString();
      metrics.scheduler.duration_ms = Date.now() - startTime;

      return {
        inserted: [],
        skipped: [],
        errors: [{ type: 'invalid_input', message: 'Events must be an array' }],
        metrics,
      };
    }

    for (const event of events) {
      try {
        const validation = validateEvent(event);
        if (!validation.valid) {
          errors.push({
            type: 'validation_error',
            provider_event_id: event.provider_event_id,
            message: validation.errors.join('; '),
          });
          metrics.database.errors++;
          continue;
        }

        const result = await insertEvent(event);

        if (result) {
          inserted.push(result);
          metrics.database.inserted++;
          metrics.normalization.output++;
        } else {
          skipped.push(event.provider_event_id);
          metrics.database.skipped++;
        }
      } catch (error) {
        errors.push({
          type: 'insert_error',
          provider_event_id: event.provider_event_id,
          message: error.message,
        });
        metrics.database.errors++;
      }
    }

    metrics.scheduler.sync_end = new Date().toISOString();
    metrics.scheduler.duration_ms = Date.now() - startTime;

    try {
      await logProviderSync({
        provider: providerId,
        status: errors.length > 0 && inserted.length === 0 ? 'fail' : errors.length > 0 ? 'partial' : 'success',
        items_fetched: events.length,
        items_inserted: inserted.length,
        items_updated: 0,
        items_skipped: skipped.length,
        duration_ms: metrics.scheduler.duration_ms,
        errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
      });
    } catch (logError) {
      console.error(`[ProviderFramework] Failed to log sync for ${providerId}:`, logError.message);
    }

    return {
      inserted,
      skipped,
      errors,
      metrics,
    };
  }
}

const providerFramework = new ProviderFramework();
export default providerFramework;
export { ProviderFramework };

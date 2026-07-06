/**
 * Abstract Base Provider Class
 * All providers (RSS, LezoTraffic, Weather, etc.) must extend this class
 * and implement the required methods.
 */

export class BaseProvider {
  constructor(providerId, config = {}) {
    this.providerId = providerId;
    this.config = config;
    this.enabled = config.enabled !== false;
    this.initialized = false;
    this.authenticated = false;
    this.lastSyncAt = null;
    this.lastSyncStatus = null;
    this.errorCount = 0;
    this.itemsIngested = 0;
    this.averageLatency = 0;
    this.latencySamples = [];
  }

  /**
   * Initialize the provider
   * Load configuration, validate credentials, prepare resources
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Authenticate with the provider
   * Handle token acquisition, refresh, and validation
   */
  async authenticate() {
    throw new Error('authenticate() must be implemented by subclass');
  }

  /**
   * Sync data from the provider
   * Fetch and normalize data from the provider API
   * The framework handles deduplication, insertion, logging, and metrics
   * @returns {Array<Object>} Array of UnifiedEvent objects
   */
  async sync() {
    throw new Error('sync() must be implemented by subclass');
  }

  /**
   * Normalize raw provider data to UnifiedEvent
   * @param {Object} rawData - Raw data from provider API
   * @returns {Object} UnifiedEvent object
   */
  normalize(rawData) {
    throw new Error('normalize() must be implemented by subclass');
  }

  /**
   * Get provider capabilities
   * @returns {Object} Capabilities object
   */
  getCapabilities() {
    return {
      provider: this.providerId,
      supportsRealtime: false,
      supportsPolling: true,
      supportsPagination: false,
      supportsIncrementalSync: false,
      supportsGeoFiltering: false,
      supportsLanguage: ['fr'],
      supportedEndpoints: [],
    };
  }

  /**
   * Get provider health status
   * @returns {Object} Health information
   */
  async health() {
    return {
      provider: this.providerId,
      healthy: this.errorCount < 3,
      enabled: this.enabled,
      authenticated: this.authenticated,
      initialized: this.initialized,
      last_sync: this.lastSyncAt,
      last_sync_status: this.lastSyncStatus,
      items_ingested: this.itemsIngested,
      error_count: this.errorCount,
      latency_ms: this.averageLatency,
    };
  }

  /**
   * Shutdown the provider
   * Clean up resources, close connections
   */
  async shutdown() {
    this.initialized = false;
    this.authenticated = false;
    console.log(`[${this.providerId}] Shutdown complete`);
  }

  /**
   * Record a sync attempt with timing
   * @param {Function} syncFn - The sync function to execute
   * @returns {Object} Sync result
   */
  async withTiming(syncFn) {
    const startTime = Date.now();
    try {
      const result = await syncFn();
      const duration = Date.now() - startTime;
      this.recordLatency(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordLatency(duration);
      this.errorCount++;
      throw error;
    }
  }

  /**
   * Record latency sample and update average
   * @param {number} duration - Duration in milliseconds
   */
  recordLatency(duration) {
    this.latencySamples.push(duration);
    if (this.latencySamples.length > 10) {
      this.latencySamples.shift();
    }
    this.averageLatency = Math.round(
      this.latencySamples.reduce((sum, val) => sum + val, 0) / this.latencySamples.length
    );
  }

  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise} Result of the function
   */
  async withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[${this.providerId}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Log a message with provider prefix
   * @param {string} message - Message to log
   * @param {string} level - Log level (info, warn, error)
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.providerId}]`;
    const logMessage = `${prefix} ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  /**
   * Update sync status after a sync attempt
   * @param {string} status - Sync status (success, fail, partial)
   * @param {number} itemsIngested - Number of items ingested
   */
  updateSyncStatus(status, itemsIngested = 0) {
    this.lastSyncAt = new Date().toISOString();
    this.lastSyncStatus = status;
    if (status === 'success') {
      this.itemsIngested += itemsIngested;
      this.errorCount = 0;
    }
  }
}

/**
 * Provider Health Monitor
 * Aggregates health status from all providers and provides alerts
 */

import registry from './providerRegistry.js';

class ProviderHealthMonitor {
  constructor() {
    this.healthHistory = new Map();
    this.alertThreshold = 3; // Number of consecutive failures before alert
    this.checkInterval = 60000; // Check every 60 seconds
    this.intervalId = null;
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.intervalId) {
      console.warn('[ProviderHealthMonitor] Already running');
      return;
    }

    console.log('[ProviderHealthMonitor] Starting health monitoring...');
    this.intervalId = setInterval(() => this.checkHealth(), this.checkInterval);
    console.log('[ProviderHealthMonitor] Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (!this.intervalId) {
      console.warn('[ProviderHealthMonitor] Not running');
      return;
    }

    console.log('[ProviderHealthMonitor] Stopping health monitoring...');
    clearInterval(this.intervalId);
    this.intervalId = null;
    console.log('[ProviderHealthMonitor] Health monitoring stopped');
  }

  /**
   * Check health of all providers
   */
  async checkHealth() {
    const providers = registry.getAll();
    const healthStatus = await registry.getHealthStatus();

    for (const health of healthStatus) {
      this.updateHealthHistory(health);
      this.checkForAlerts(health);
    }
  }

  /**
   * Update health history for a provider
   * @param {Object} health - Health status object
   */
  updateHealthHistory(health) {
    const history = this.healthHistory.get(health.provider) || {
      consecutiveFailures: 0,
      lastHealthy: null,
      lastUnhealthy: null,
    };

    if (health.healthy) {
      history.consecutiveFailures = 0;
      history.lastHealthy = new Date().toISOString();
    } else {
      history.consecutiveFailures++;
      history.lastUnhealthy = new Date().toISOString();
    }

    this.healthHistory.set(health.provider, history);
  }

  /**
   * Check for alerts based on health status
   * @param {Object} health - Health status object
   */
  checkForAlerts(health) {
    const history = this.healthHistory.get(health.provider);
    
    if (!health.healthy && history.consecutiveFailures >= this.alertThreshold) {
      this.alertProviderFailure(health, history.consecutiveFailures);
    }

    if (history.consecutiveFailures === 1 && !health.healthy) {
      this.alertProviderDegraded(health);
    }

    if (health.healthy && history.consecutiveFailures > 0) {
      this.alertProviderRecovered(health, history.consecutiveFailures);
    }
  }

  /**
   * Alert on provider failure
   * @param {Object} health - Health status
   * @param {number} failures - Number of consecutive failures
   */
  alertProviderFailure(health, failures) {
    console.error(`[ProviderHealthMonitor] ALERT: Provider ${health.provider} has failed ${failures} times consecutively`);
    // TODO: Send notification (email, Slack, etc.)
  }

  /**
   * Alert on provider degradation
   * @param {Object} health - Health status
   */
  alertProviderDegraded(health) {
    console.warn(`[ProviderHealthMonitor] WARNING: Provider ${health.provider} is unhealthy`);
    // TODO: Send notification if configured
  }

  /**
   * Alert on provider recovery
   * @param {Object} health - Health status
   * @param {number} previousFailures - Number of failures before recovery
   */
  alertProviderRecovered(health, previousFailures) {
    console.log(`[ProviderHealthMonitor] RECOVERY: Provider ${health.provider} recovered after ${previousFailures} failures`);
    // TODO: Send recovery notification
  }

  /**
   * Get aggregated health status
   * @returns {Promise<Object>} Aggregated health information
   */
  async getAggregatedHealth() {
    const healthStatus = await registry.getHealthStatus();
    
    const healthy = healthStatus.filter(h => h.healthy).length;
    const unhealthy = healthStatus.filter(h => !h.healthy).length;
    const enabled = healthStatus.filter(h => h.enabled).length;
    const disabled = healthStatus.filter(h => !h.enabled).length;

    const totalItemsIngested = healthStatus.reduce((sum, h) => sum + (h.items_ingested || 0), 0);
    const totalErrorCount = healthStatus.reduce((sum, h) => sum + (h.error_count || 0), 0);
    const averageLatency = healthStatus.length > 0 
      ? Math.round(healthStatus.reduce((sum, h) => sum + (h.latency_ms || 0), 0) / healthStatus.length)
      : 0;

    return {
      overall: {
        total: healthStatus.length,
        healthy,
        unhealthy,
        enabled,
        disabled,
        health_percentage: healthStatus.length > 0 ? Math.round((healthy / healthStatus.length) * 100) : 0,
      },
      performance: {
        total_items_ingested: totalItemsIngested,
        total_error_count: totalErrorCount,
        average_latency_ms: averageLatency,
      },
      providers: healthStatus,
    };
  }

  /**
   * Get health history for a specific provider
   * @param {string} providerId - Provider identifier
   * @returns {Object|null} Health history or null
   */
  getProviderHistory(providerId) {
    return this.healthHistory.get(providerId) || null;
  }

  /**
   * Reset health history for a provider
   * @param {string} providerId - Provider identifier
   */
  resetProviderHistory(providerId) {
    this.healthHistory.delete(providerId);
    console.log(`[ProviderHealthMonitor] Reset health history for: ${providerId}`);
  }

  /**
   * Get providers that need attention
   * @returns {Promise<Array>} Array of unhealthy providers
   */
  async getUnhealthyProviders() {
    const healthStatus = await registry.getHealthStatus();
    return healthStatus.filter(h => !h.healthy && h.enabled);
  }

  /**
   * Get providers with high error rates
   * @param {number} threshold - Error count threshold
   * @returns {Promise<Array>} Array of providers with high error rates
   */
  async getHighErrorProviders(threshold = 5) {
    const healthStatus = await registry.getHealthStatus();
    return healthStatus.filter(h => (h.error_count || 0) >= threshold);
  }

  /**
   * Get providers with high latency
   * @param {number} threshold - Latency threshold in milliseconds
   * @returns {Promise<Array>} Array of providers with high latency
   */
  async getHighLatencyProviders(threshold = 5000) {
    const healthStatus = await registry.getHealthStatus();
    return healthStatus.filter(h => (h.latency_ms || 0) >= threshold);
  }
}

// Singleton instance
const healthMonitor = new ProviderHealthMonitor();

export default healthMonitor;

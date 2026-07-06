/**
 * Provider Registry
 * Manages registration, lifecycle, and access to all providers
 */

import { getProviderConfig, updateProviderConfig } from '../supabaseClient.js';

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.initialized = false;
  }

  /**
   * Register a provider
   * @param {BaseProvider} provider - Provider instance to register
   */
  register(provider) {
    if (!provider.providerId) {
      throw new Error('Provider must have a providerId');
    }
    
    if (this.providers.has(provider.providerId)) {
      throw new Error(`Provider ${provider.providerId} is already registered`);
    }
    
    this.providers.set(provider.providerId, provider);
    console.log(`[ProviderRegistry] Registered provider: ${provider.providerId}`);
  }

  /**
   * Get a specific provider by ID
   * @param {string} providerId - Provider identifier
   * @returns {BaseProvider|null} Provider instance or null
   */
  get(providerId) {
    return this.providers.get(providerId) || null;
  }

  /**
   * Get all registered providers
   * @returns {Array<BaseProvider>} Array of all providers
   */
  getAll() {
    return Array.from(this.providers.values());
  }

  /**
   * Get all enabled providers
   * @returns {Array<BaseProvider>} Array of enabled providers
   */
  getEnabled() {
    return Array.from(this.providers.values()).filter(p => p.enabled);
  }

  /**
   * Initialize all registered providers
   * @returns {Promise<Object>} Initialization results
   */
  async initializeAll() {
    console.log('[ProviderRegistry] Initializing all providers...');
    const results = {
      successful: [],
      failed: [],
    };

    for (const provider of this.providers.values()) {
      try {
        await provider.initialize();
        results.successful.push(provider.providerId);
        console.log(`[ProviderRegistry] Initialized: ${provider.providerId}`);
      } catch (error) {
        results.failed.push({
          provider: provider.providerId,
          error: error.message,
        });
        console.error(`[ProviderRegistry] Failed to initialize ${provider.providerId}:`, error.message);
      }
    }

    this.initialized = true;
    console.log(`[ProviderRegistry] Initialization complete: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Authenticate all enabled providers
   * @returns {Promise<Object>} Authentication results
   */
  async authenticateAll() {
    console.log('[ProviderRegistry] Authenticating all enabled providers...');
    const results = {
      successful: [],
      failed: [],
    };

    for (const provider of this.getEnabled()) {
      try {
        await provider.authenticate();
        results.successful.push(provider.providerId);
        console.log(`[ProviderRegistry] Authenticated: ${provider.providerId}`);
      } catch (error) {
        results.failed.push({
          provider: provider.providerId,
          error: error.message,
        });
        console.error(`[ProviderRegistry] Failed to authenticate ${provider.providerId}:`, error.message);
      }
    }

    console.log(`[ProviderRegistry] Authentication complete: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Shutdown all providers
   * @returns {Promise<void>}
   */
  async shutdownAll() {
    console.log('[ProviderRegistry] Shutting down all providers...');
    
    for (const provider of this.providers.values()) {
      try {
        await provider.shutdown();
        console.log(`[ProviderRegistry] Shutdown: ${provider.providerId}`);
      } catch (error) {
        console.error(`[ProviderRegistry] Error shutting down ${provider.providerId}:`, error.message);
      }
    }

    this.providers.clear();
    this.initialized = false;
    console.log('[ProviderRegistry] All providers shut down');
  }

  /**
   * Load provider configurations from database
   * @returns {Promise<void>}
   */
  async loadConfigurations() {
    console.log('[ProviderRegistry] Loading provider configurations...');
    
    for (const provider of this.providers.values()) {
      try {
        const config = await getProviderConfig(provider.providerId);
        if (config) {
          provider.config = { ...provider.config, ...config.config };
          provider.enabled = config.enabled;
          console.log(`[ProviderRegistry] Loaded config for: ${provider.providerId}`);
        }
      } catch (error) {
        console.error(`[ProviderRegistry] Failed to load config for ${provider.providerId}:`, error.message);
      }
    }
  }

  /**
   * Save provider configurations to database
   * @returns {Promise<void>}
   */
  async saveConfigurations() {
    console.log('[ProviderRegistry] Saving provider configurations...');
    
    for (const provider of this.providers.values()) {
      try {
        await updateProviderConfig(provider.providerId, {
          enabled: provider.enabled,
          config: provider.config,
        });
        console.log(`[ProviderRegistry] Saved config for: ${provider.providerId}`);
      } catch (error) {
        console.error(`[ProviderRegistry] Failed to save config for ${provider.providerId}:`, error.message);
      }
    }
  }

  /**
   * Get health status of all providers
   * @returns {Promise<Array>} Array of health status objects
   */
  async getHealthStatus() {
    const healthStatus = [];
    
    for (const provider of this.providers.values()) {
      try {
        const health = await provider.health();
        healthStatus.push(health);
      } catch (error) {
        healthStatus.push({
          provider: provider.providerId,
          healthy: false,
          enabled: provider.enabled,
          error: error.message,
        });
      }
    }

    return healthStatus;
  }

  /**
   * Enable or disable a provider
   * @param {string} providerId - Provider identifier
   * @param {boolean} enabled - Enable or disable
   * @returns {boolean} Success status
   */
  setProviderEnabled(providerId, enabled) {
    const provider = this.get(providerId);
    if (!provider) {
      console.error(`[ProviderRegistry] Provider not found: ${providerId}`);
      return false;
    }

    provider.enabled = enabled;
    console.log(`[ProviderRegistry] ${enabled ? 'Enabled' : 'Disabled'} provider: ${providerId}`);
    return true;
  }

  /**
   * Get capabilities for a provider
   * @param {string} providerId - Provider identifier
   * @returns {Object|null} Capabilities object or null
   */
  getCapabilities(providerId) {
    const provider = this.get(providerId);
    if (!provider) {
      return null;
    }
    if (typeof provider.getCapabilities === 'function') {
      return provider.getCapabilities();
    }
    return {
      provider: providerId,
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
   * Get capabilities for all providers
   * @returns {Array<Object>} Array of capabilities objects
   */
  getAllCapabilities() {
    return Array.from(this.providers.keys()).map(id => this.getCapabilities(id));
  }
}

// Singleton instance
const registry = new ProviderRegistry();

export default registry;

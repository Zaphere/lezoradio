import { BaseProvider } from '../baseProvider.js';
import LezoTrafficApiClient, { EndpointUnavailableError } from './apiClient.js';
import { getConfig, getEnabledEndpoints, validateConfig, getConfigSummary } from './config.js';
import {
  LEZOTRAFFIC_ENDPOINTS,
  getAlertsParams,
  getIncidentsParams,
  getTrafficJamsParams,
  getAccidentsParams,
  getRoadworksParams,
  getRoutesParams,
  getTransportsParams,
  getGeoParams,
  isEndpointAvailable,
  markEndpointUnavailable,
  markEndpointAvailable,
} from './endpoints.js';
import { normalizeLezoTrafficItems } from './normalizer.js';
import { insertEvent } from '../../supabaseClient.js';

const ENDPOINT_MAP = {
  alerts: { path: LEZOTRAFFIC_ENDPOINTS.ALERTS, params: getAlertsParams },
  incidents: { path: LEZOTRAFFIC_ENDPOINTS.INCIDENTS, params: getIncidentsParams },
  traffic_jams: { path: LEZOTRAFFIC_ENDPOINTS.TRAFFIC_JAMS, params: getTrafficJamsParams },
  accidents: { path: LEZOTRAFFIC_ENDPOINTS.ACCIDENTS, params: getAccidentsParams },
  roadworks: { path: LEZOTRAFFIC_ENDPOINTS.ROADWORKS, params: getRoadworksParams },
  routes: { path: LEZOTRAFFIC_ENDPOINTS.ROUTES, params: getRoutesParams },
  transports: { path: LEZOTRAFFIC_ENDPOINTS.TRANSPORTS, params: getTransportsParams },
  cities: { path: LEZOTRAFFIC_ENDPOINTS.CITIES, params: getGeoParams },
  provinces: { path: LEZOTRAFFIC_ENDPOINTS.PROVINCES, params: getGeoParams },
  destinations: { path: LEZOTRAFFIC_ENDPOINTS.DESTINATIONS, params: getGeoParams },
};

class LezoTrafficProvider extends BaseProvider {
  constructor(config = {}) {
    super('lezotraffic', config);

    this.config = getConfig(config);
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid LezoTraffic configuration: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      this.log(`Configuration warnings: ${validation.warnings.join(', ')}`, 'warn');
    }

    this.apiClient = new LezoTrafficApiClient({
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      apiSecret: this.config.apiSecret,
      timeout: this.config.api.timeout,
      maxRetries: this.config.api.maxRetries,
      retryDelay: this.config.api.retryDelay,
    });

    this.enabledEndpoints = getEnabledEndpoints(this.config);
    this.lastSyncTimes = {};
  }

  async initialize() {
    this.log('Initializing LezoTraffic provider...');

    try {
      const summary = getConfigSummary(this.config);
      this.log(`Configuration: ${JSON.stringify(summary)}`);
      await this.apiClient.getAuthManager().authenticate();
      this.initialized = true;
      this.log('LezoTraffic provider initialized successfully');
    } catch (error) {
      this.log(`Initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async authenticate() {
    this.log('Authenticating with LezoTraffic...');

    try {
      await this.apiClient.getAuthManager().authenticate();
      this.authenticated = true;
      this.log('Authentication successful');
    } catch (error) {
      this.log(`Authentication failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async sync() {
    if (!this.initialized) {
      throw new Error('LezoTraffic provider not initialized');
    }

    if (!this.authenticated) {
      await this.authenticate();
    }

    this.log('Starting LezoTraffic sync...');

    const allEvents = [];
    const endpointErrors = [];
    const requestMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      latency_ms: 0,
    };

    const authStart = Date.now();
    await this.apiClient.getAuthManager().ensureAuthenticated();
    const authDuration = Date.now() - authStart;

    for (const endpoint of this.enabledEndpoints) {
      const endpointConfig = ENDPOINT_MAP[endpoint];
      if (!endpointConfig) {
        this.log(`Unknown endpoint: ${endpoint}, skipping`, 'warn');
        continue;
      }

      if (!isEndpointAvailable(endpointConfig.path)) {
        this.log(`Endpoint ${endpoint} is unavailable, skipping until retry window`, 'warn');
        continue;
      }

      try {
        this.log(`Syncing endpoint: ${endpoint}`);

        const queryParams = endpointConfig.params({
          ...this.config.filters,
          limit: 100,
        });

        const startTime = Date.now();
        const data = await this.apiClient.get(endpointConfig.path, queryParams);
        const duration = Date.now() - startTime;

        const items = Array.isArray(data) ? data : [];
        const events = normalizeLezoTrafficItems(items, endpointConfig.path);

        allEvents.push(...events);
        this.lastSyncTimes[endpoint] = new Date().toISOString();

        requestMetrics.total++;
        requestMetrics.successful++;
        requestMetrics.latency_ms += duration;

        markEndpointAvailable(endpointConfig.path);

        this.log(`Endpoint ${endpoint}: ${items.length} items, ${events.length} events, ${duration}ms`);

      } catch (error) {
        requestMetrics.total++;
        requestMetrics.failed++;

        if (error instanceof EndpointUnavailableError) {
          markEndpointUnavailable(endpointConfig.path);
          this.log(`Endpoint ${endpoint} unavailable (HTTP ${error.httpStatus}), retrying after 24h`, 'warn');
        }

        const errorMsg = `Failed to sync ${endpoint}: ${error.message}`;
        this.log(errorMsg, 'error');
        endpointErrors.push(errorMsg);
      }
    }

    this.log(`LezoTraffic sync complete: ${allEvents.length} events normalized`);

    const syncContext = {
      sync_start: this.lastSyncTimes[this.enabledEndpoints[0]] || new Date().toISOString(),
      authentication: {
        success: this.authenticated,
        latency_ms: authDuration,
      },
      requests: {
        total: requestMetrics.total,
        successful: requestMetrics.successful,
        failed: requestMetrics.failed,
        latency_ms: requestMetrics.latency_ms,
      },
    };

    return {
      events: allEvents,
      errors: endpointErrors.length > 0 ? endpointErrors : null,
      syncContext,
    };
  }

  normalize(rawData) {
    return normalizeLezoTrafficItems(Array.isArray(rawData) ? rawData : [rawData], '/unknown');
  }

  async health() {
    const baseHealth = await super.health();
    const tokenStatus = this.apiClient.getAuthManager().getTokenStatus();
    const apiStats = this.apiClient.getStats();

    return {
      ...baseHealth,
      token_status: tokenStatus,
      api_stats: apiStats,
      enabled_endpoints: this.enabledEndpoints,
      last_sync_times: this.lastSyncTimes,
    };
  }

  async reloadConfig() {
    this.log('Reloading LezoTraffic configuration...');

    this.config = getConfig();
    this.enabledEndpoints = getEnabledEndpoints(this.config);

    this.apiClient = new LezoTrafficApiClient({
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      apiSecret: this.config.apiSecret,
      timeout: this.config.api.timeout,
      maxRetries: this.config.api.maxRetries,
      retryDelay: this.config.api.retryDelay,
    });

    this.log('Configuration reloaded');
  }

  getStats() {
    return {
      enabledEndpoints: this.enabledEndpoints,
      lastSyncTimes: this.lastSyncTimes,
      configSummary: getConfigSummary(this.config),
      apiStats: this.apiClient.getStats(),
    };
  }

  getCapabilities() {
    return { ...capabilities };
  }

  async shutdown() {
    this.log('Shutting down LezoTraffic provider...');
    this.apiClient.getAuthManager().clearTokens();
    await super.shutdown();
  }
}

export default LezoTrafficProvider;

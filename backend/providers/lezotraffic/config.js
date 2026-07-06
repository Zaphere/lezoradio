const DEFAULT_CONFIG = {
  baseUrl: process.env.LEZOTRAFFIC_BASE_URL || 'https://app.lezotraffic.com/api/v1',
  apiKey: process.env.LEZOTRAFFIC_CLIENT_ID,
  apiSecret: process.env.LEZOTRAFFIC_CLIENT_SECRET,

  endpoints: {
    alerts: process.env.LEZOTRAFFIC_ENABLE_ALERTS !== 'false',
    incidents: process.env.LEZOTRAFFIC_ENABLE_INCIDENTS !== 'false',
    traffic_jams: process.env.LEZOTRAFFIC_ENABLE_TRAFFIC !== 'false',
    accidents: process.env.LEZOTRAFFIC_ENABLE_ACCIDENTS !== 'false',
    roadworks: process.env.LEZOTRAFFIC_ENABLE_ROADWORKS !== 'false',
    routes: process.env.LEZOTRAFFIC_ENABLE_ROUTES !== 'false',
    transports: process.env.LEZOTRAFFIC_ENABLE_TRANSPORTS !== 'false',
    cities: process.env.LEZOTRAFFIC_ENABLE_CITIES !== 'false',
    provinces: process.env.LEZOTRAFFIC_ENABLE_PROVINCES !== 'false',
    destinations: process.env.LEZOTRAFFIC_ENABLE_DESTINATIONS !== 'false',
  },

  schedules: {
    alerts: process.env.LEZOTRAFFIC_SCHEDULE_ALERTS || '*/30 * * * *',
    incidents: process.env.LEZOTRAFFIC_SCHEDULE_INCIDENTS || '*/1 * * * *',
    traffic_jams: process.env.LEZOTRAFFIC_SCHEDULE_TRAFFIC || '*/1 * * * *',
    accidents: process.env.LEZOTRAFFIC_SCHEDULE_ACCIDENTS || '*/1 * * * *',
    roadworks: process.env.LEZOTRAFFIC_SCHEDULE_ROADWORKS || '*/5 * * * *',
    routes: process.env.LEZOTRAFFIC_SCHEDULE_ROUTES || '*/30 * * * *',
    transports: process.env.LEZOTRAFFIC_SCHEDULE_TRANSPORTS || '*/10 * * * *',
    cities: process.env.LEZOTRAFFIC_SCHEDULE_CITIES || '0 */24 * * *',
    provinces: process.env.LEZOTRAFFIC_SCHEDULE_PROVINCES || '0 */24 * * *',
    destinations: process.env.LEZOTRAFFIC_SCHEDULE_DESTINATIONS || '0 */24 * * *',
  },

  filters: {
    country: process.env.LEZOTRAFFIC_COUNTRY || 'CD',
    provinces: process.env.LEZOTRAFFIC_PROVINCES ? process.env.LEZOTRAFFIC_PROVINCES.split(',') : null,
    cities: process.env.LEZOTRAFFIC_CITIES ? process.env.LEZOTRAFFIC_CITIES.split(',') : null,
  },

  api: {
    timeout: parseInt(process.env.LEZOTRAFFIC_TIMEOUT) || 10000,
    maxRetries: parseInt(process.env.LEZOTRAFFIC_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.LEZOTRAFFIC_RETRY_DELAY) || 1000,
  },

  retention: {
    incidents: parseInt(process.env.LEZOTRAFFIC_RETENTION_INCIDENTS) || 72,
    accidents: parseInt(process.env.LEZOTRAFFIC_RETENTION_ACCIDENTS) || 72,
    routes: parseInt(process.env.LEZOTRAFFIC_RETENTION_ROUTES) || 168,
    transports: parseInt(process.env.LEZOTRAFFIC_RETENTION_TRANSPORTS) || 168,
  },
};

function getConfig(overrides = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    endpoints: {
      ...DEFAULT_CONFIG.endpoints,
      ...(overrides.endpoints || {}),
    },
    schedules: {
      ...DEFAULT_CONFIG.schedules,
      ...(overrides.schedules || {}),
    },
    filters: {
      ...DEFAULT_CONFIG.filters,
      ...(overrides.filters || {}),
    },
    api: {
      ...DEFAULT_CONFIG.api,
      ...(overrides.api || {}),
    },
  };
}

function getEnabledEndpoints(config = DEFAULT_CONFIG) {
  return Object.entries(config.endpoints)
    .filter(([_, enabled]) => enabled)
    .map(([name, _]) => name);
}

function getEndpointSchedule(endpoint, config = DEFAULT_CONFIG) {
  return config.schedules[endpoint] || '*/15 * * * *';
}

function validateConfig(config = DEFAULT_CONFIG) {
  const errors = [];
  const warnings = [];

  if (!config.apiKey) {
    errors.push('LEZOTRAFFIC_CLIENT_ID is required');
  }

  if (!config.apiSecret) {
    errors.push('LEZOTRAFFIC_CLIENT_SECRET is required');
  }

  if (!config.baseUrl) {
    errors.push('LEZOTRAFFIC_BASE_URL is required');
  }

  const enabledCount = Object.values(config.endpoints).filter(Boolean).length;
  if (enabledCount === 0) {
    warnings.push('No LezoTraffic endpoints are enabled');
  }

  for (const [endpoint, schedule] of Object.entries(config.schedules)) {
    if (!isValidCron(schedule)) {
      warnings.push(`Invalid cron expression for ${endpoint}: ${schedule}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function isValidCron(cronExpression) {
  const parts = cronExpression.trim().split(/\s+/);
  return parts.length === 5 || parts.length === 6;
}

function getConfigSummary(config = DEFAULT_CONFIG) {
  const enabledEndpoints = getEnabledEndpoints(config);

  return {
    baseUrl: config.baseUrl,
    enabledEndpoints,
    totalEndpoints: Object.keys(config.endpoints).length,
    geographicFilter: config.filters.country || 'none',
    timeout: config.api.timeout,
    maxRetries: config.api.maxRetries,
  };
}

export {
  DEFAULT_CONFIG,
  getConfig,
  getEnabledEndpoints,
  getEndpointSchedule,
  validateConfig,
  isValidCron,
  getConfigSummary,
};

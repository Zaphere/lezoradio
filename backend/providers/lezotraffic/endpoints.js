export const LEZOTRAFFIC_ENDPOINTS = {
  // Health
  HEALTH: '/health',

  // Alerts and Incidents
  ALERTS: '/alertes',
  INCIDENTS: '/incidents',

  // Traffic Data (French endpoints)
  TRAFFIC_JAMS: '/embouteillages',
  ACCIDENTS: '/accidents',
  ROADWORKS: '/travaux',

  // Transport
  TRANSPORTS: '/transports',
  TRANSPORT_TYPES: '/transports/types',
  TRANSPORT_SERVICES: '/transports/services',
  ROUTES: '/routes',

  // Geographic Data (French endpoints)
  CITIES: '/villes',
  PROVINCES: '/provinces',
  DESTINATIONS: '/destinations',

  // Statistics (French endpoints)
  STATISTICS_GLOBAL: '/statistiques/global',
  STATISTICS_INCIDENTS: '/statistiques/incidents',
  STATISTICS_TRAFFIC: '/statistiques/traffic',

  // Radio
  RADIOS: '/radios',
  RADIO_PROGRAM: '/radios/{city}/program',
};

export const ENDPOINT_AVAILABILITY = {
  [LEZOTRAFFIC_ENDPOINTS.HEALTH]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.ALERTS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.INCIDENTS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.TRAFFIC_JAMS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.ACCIDENTS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.ROADWORKS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.TRANSPORTS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.TRANSPORT_TYPES]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.TRANSPORT_SERVICES]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.ROUTES]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.CITIES]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.PROVINCES]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.DESTINATIONS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.STATISTICS_GLOBAL]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.STATISTICS_INCIDENTS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.STATISTICS_TRAFFIC]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.RADIOS]: { available: true, retryAfter: null },
  [LEZOTRAFFIC_ENDPOINTS.RADIO_PROGRAM]: { available: true, retryAfter: null },
};

export function markEndpointUnavailable(endpointPath) {
  if (ENDPOINT_AVAILABILITY[endpointPath]) {
    ENDPOINT_AVAILABILITY[endpointPath].available = false;
    ENDPOINT_AVAILABILITY[endpointPath].retryAfter = Date.now() + (24 * 60 * 60 * 1000);
  }
}

export function markEndpointAvailable(endpointPath) {
  if (ENDPOINT_AVAILABILITY[endpointPath]) {
    ENDPOINT_AVAILABILITY[endpointPath].available = true;
    ENDPOINT_AVAILABILITY[endpointPath].retryAfter = null;
  }
}

export function isEndpointAvailable(endpointPath) {
  const status = ENDPOINT_AVAILABILITY[endpointPath];
  if (!status) return true;
  if (!status.available && status.retryAfter && Date.now() >= status.retryAfter) {
    status.available = true;
    status.retryAfter = null;
    return true;
  }
  return status.available;
}

export function buildQueryParams(params = {}) {
  const queryParts = [];

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => queryParts.push(`${key}=${encodeURIComponent(v)}`));
      } else {
        queryParts.push(`${key}=${encodeURIComponent(value)}`);
      }
    }
  }

  return queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
}

export function getIncidentsParams(options = {}) {
  return {
    city: options.city,
    type: options.type,
    severity: options.severity,
    verified: options.verified,
    bbox: options.bbox,
    page: options.page || 1,
    limit: options.limit || 50,
  };
}

export function getAlertsParams(options = {}) {
  return {
    page: options.page || 1,
    limit: options.limit || 50,
  };
}

export function getTrafficJamsParams(options = {}) {
  return {
    city: options.city,
    page: options.page || 1,
    limit: options.limit || 50,
  };
}

export function getAccidentsParams(options = {}) {
  return {
    city: options.city,
    page: options.page || 1,
    limit: options.limit || 50,
  };
}

export function getRoadworksParams(options = {}) {
  return {
    city: options.city,
    page: options.page || 1,
    limit: options.limit || 50,
  };
}

export function getRoutesParams(options = {}) {
  return {
    page: options.page || 1,
    limit: options.limit || 50,
  };
}

export function getTransportsParams(options = {}) {
  return {
    page: options.page || 1,
    limit: options.limit || 50,
  };
}

export function getGeoParams(options = {}) {
  return {
    city: options.city,
    limit: options.limit || 100,
  };
}

export function getStatisticsParams(options = {}) {
  return {
    days: options.days || 14,
    city: options.city,
  };
}

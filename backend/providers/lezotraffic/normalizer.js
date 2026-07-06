import { mapIncidentType, mapSeverity } from './taxonomy.js';

const API_VERSION = 'v1';
const RAW_PAYLOAD_VERSION = 1;

function mapStatus(status) {
  const statusMap = {
    active: 'active',
    ongoing: 'active',
    planned: 'active',
    resolved: 'resolved',
    completed: 'resolved',
    archived: 'archived',
    closed: 'resolved',
    sent: 'active',
  };
  return statusMap[status?.toLowerCase()] || 'active';
}

function extractGeoData(data) {
  // Handle nested coordinates structure
  let lat = null;
  let lon = null;
  
  if (data.coordinates) {
    lat = data.coordinates.latitude || data.coordinates.lat;
    lon = data.coordinates.longitude || data.coordinates.lon;
  } else if (data.latitude && data.longitude) {
    lat = data.latitude;
    lon = data.longitude;
  }

  return {
    country: data.country || 'CD',
    province: data.province || null,
    city: data.city || null,
    latitude: lat ? parseFloat(lat) : null,
    longitude: lon ? parseFloat(lon) : null,
  };
}

function cleanText(text, maxLength = 500) {
  if (!text) return null;
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .substring(0, maxLength) || null;
}

function normalizeAlert(item, endpoint) {
  // Handle alert structure with nested incident
  const incident = item.incident || {};
  const geoData = extractGeoData(incident.coordinates ? { coordinates: incident.coordinates, city: incident.city } : item);
  
  const providerEventId = item.id || `${endpoint}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const summary = cleanText(item.message, 500);
  const description = cleanText(item.message, 2000);
  
  const { category, subcategory } = mapIncidentType(incident.type || 'alert');
  const priority = mapSeverity(incident.severity || 'medium');
  const status = mapStatus(item.status);

  return {
    provider: 'lezotraffic',
    provider_record_id: providerEventId,
    provider_type: 'alert',
    title: `Alerte: ${incident.type || 'Police'}`,
    summary,
    description,
    category,
    subcategory,
    priority,
    language: 'fr',
    country: geoData.country,
    province: geoData.province,
    city: geoData.city || incident.city,
    latitude: geoData.latitude,
    longitude: geoData.longitude,
    status,
    verified: true,
    occurred_at: item.createdAt || null,
    expires_at: null,
    metadata: {
      channel: item.channel,
      incident_type: incident.type,
      incident_severity: incident.severity,
      incident_location: incident.location,
      endpoint,
    },
    raw_payload: item,
    raw_payload_version: RAW_PAYLOAD_VERSION,
    api_version: API_VERSION,
  };
}

function normalizeIncident(item, endpoint) {
  const geoData = extractGeoData(item);
  const providerEventId = item.id || `${endpoint}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const summary = cleanText(item.description || item.summary, 500);
  const description = cleanText(item.description, 2000);
  
  const { category, subcategory } = mapIncidentType(item.type || 'incident');
  const priority = mapSeverity(item.severity || 'medium');
  const status = mapStatus(item.status);

  return {
    provider: 'lezotraffic',
    provider_record_id: providerEventId,
    provider_type: 'incident',
    title: item.title || `Incident: ${item.type || 'Unknown'}`,
    summary,
    description,
    category,
    subcategory,
    priority,
    language: 'fr',
    country: geoData.country,
    province: geoData.province,
    city: geoData.city,
    latitude: geoData.latitude,
    longitude: geoData.longitude,
    status,
    verified: item.verified || false,
    occurred_at: item.occurred_at || item.created_at || null,
    expires_at: item.expires_at || null,
    metadata: {
      type: item.type,
      severity: item.severity,
      casualties: item.casualties || null,
      verified: item.verified || false,
      endpoint,
    },
    raw_payload: item,
    raw_payload_version: RAW_PAYLOAD_VERSION,
    api_version: API_VERSION,
  };
}

function normalizeDestination(item, endpoint) {
  const geoData = extractGeoData(item);
  const providerEventId = `${endpoint}-${item.name}-${Date.now()}`;
  
  return {
    provider: 'lezotraffic',
    provider_record_id: providerEventId,
    provider_type: 'destination',
    title: item.name || 'Destination',
    summary: `Popular destination with popularity score: ${item.popularity}`,
    description: null,
    category: 'traffic',
    subcategory: 'destination',
    priority: 6,
    language: 'fr',
    country: geoData.country,
    province: geoData.province,
    city: geoData.city,
    latitude: geoData.latitude,
    longitude: geoData.longitude,
    status: 'active',
    verified: true,
    occurred_at: null,
    expires_at: null,
    metadata: {
      popularity: item.popularity,
      endpoint,
    },
    raw_payload: item,
    raw_payload_version: RAW_PAYLOAD_VERSION,
    api_version: API_VERSION,
  };
}

function normalizeCity(item, endpoint) {
  const cityName = item.name || 'unknown';
  const providerEventId = `${endpoint}-${cityName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    provider: 'lezotraffic',
    provider_record_id: providerEventId,
    provider_type: 'city',
    title: cityName,
    summary: `City: ${cityName}, Province: ${item.province}, Active incidents: ${item.activeIncidents}`,
    description: null,
    category: 'geo',
    subcategory: 'city',
    priority: 5,
    language: 'fr',
    country: 'CD',
    province: item.province || null,
    city: cityName,
    latitude: null,
    longitude: null,
    status: 'active',
    verified: true,
    occurred_at: null,
    expires_at: null,
    metadata: {
      totalReports: item.totalReports,
      activeIncidents: item.activeIncidents,
      endpoint,
    },
    raw_payload: item,
    raw_payload_version: RAW_PAYLOAD_VERSION,
    api_version: API_VERSION,
  };
}

function normalizeProvince(item, endpoint) {
  const provinceName = item.name || 'unknown';
  const providerEventId = `${endpoint}-${provinceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    provider: 'lezotraffic',
    provider_record_id: providerEventId,
    provider_type: 'province',
    title: provinceName,
    summary: `Province: ${provinceName}, Cities: ${item.cities?.join(', ') || 'None'}, Active incidents: ${item.activeIncidents}`,
    description: null,
    category: 'geo',
    subcategory: 'province',
    priority: 5,
    language: 'fr',
    country: 'CD',
    province: provinceName,
    city: null,
    latitude: null,
    longitude: null,
    status: 'active',
    verified: true,
    occurred_at: null,
    expires_at: null,
    metadata: {
      cities: item.cities,
      activeIncidents: item.activeIncidents,
      totalReports: item.totalReports,
      endpoint,
    },
    raw_payload: item,
    raw_payload_version: RAW_PAYLOAD_VERSION,
    api_version: API_VERSION,
  };
}

function normalizeLezoTrafficItem(item, endpoint) {
  // Route to appropriate normalizer based on endpoint
  if (endpoint.includes('alertes')) {
    return normalizeAlert(item, endpoint);
  }
  
  if (endpoint.includes('destinations')) {
    return normalizeDestination(item, endpoint);
  }
  
  if (endpoint.includes('villes')) {
    return normalizeCity(item, endpoint);
  }
  
  if (endpoint.includes('provinces')) {
    return normalizeProvince(item, endpoint);
  }
  
  // Default to incident normalizer
  return normalizeIncident(item, endpoint);
}

function normalizeLezoTrafficItems(items, endpoint) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map(item => normalizeLezoTrafficItem(item, endpoint));
}

export {
  normalizeLezoTrafficItem,
  normalizeLezoTrafficItems,
  mapStatus,
};

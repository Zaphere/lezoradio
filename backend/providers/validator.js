const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_LANGUAGE_REGEX = /^[a-z]{2}(-[A-Z]{2})?$/;
const ISO_COUNTRY_REGEX = /^[A-Z]{2}$/;

const VALID_CATEGORIES = new Set([
  'traffic', 'emergency', 'news', 'weather', 'security',
  'event', 'agriculture', 'sports', 'tourism', 'transport',
  'government', 'health',
]);

const VALID_STATUSES = new Set(['active', 'resolved', 'archived']);

const KNOWN_PROVIDERS = new Set(['lezotraffic', 'rss']);

export function validateEvent(event) {
  const errors = [];

  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['Event must be a non-null object'] };
  }

  if (typeof event.provider !== 'string' || event.provider.trim().length === 0) {
    errors.push('provider: must be a non-empty string');
  } else if (!KNOWN_PROVIDERS.has(event.provider)) {
    errors.push(`provider: "${event.provider}" is not a registered provider`);
  }

  if (typeof event.provider_record_id !== 'string' || event.provider_record_id.trim().length === 0) {
    errors.push('provider_record_id: must be a non-empty string');
  }

  if (typeof event.title !== 'string' || event.title.trim().length === 0) {
    errors.push('title: must be a non-empty string');
  } else if (event.title.length > 500) {
    errors.push('title: must not exceed 500 characters');
  }

  if (event.category !== undefined) {
    if (typeof event.category !== 'string' || !VALID_CATEGORIES.has(event.category)) {
      errors.push(`category: must be one of [${Array.from(VALID_CATEGORIES).join(', ')}]`);
    }
  }

  if (event.subcategory !== undefined && event.subcategory !== null) {
    if (typeof event.subcategory !== 'string') {
      errors.push('subcategory: must be a string or null');
    }
  }

  if (event.priority !== undefined && event.priority !== null) {
    if (!Number.isInteger(event.priority) || event.priority < 1 || event.priority > 10) {
      errors.push('priority: must be an integer between 1 and 10');
    }
  }

  if (event.language !== undefined && event.language !== null) {
    if (!ISO_LANGUAGE_REGEX.test(event.language)) {
      errors.push('language: must be a valid ISO 639-1 code (e.g. "fr", "en")');
    }
  }

  if (event.country !== undefined && event.country !== null) {
    if (!ISO_COUNTRY_REGEX.test(event.country)) {
      errors.push('country: must be a valid ISO 3166-1 alpha-2 code (e.g. "CD")');
    }
  }

  if (event.latitude !== undefined && event.latitude !== null) {
    if (typeof event.latitude !== 'number' || event.latitude < -90 || event.latitude > 90) {
      errors.push('latitude: must be a number between -90 and 90');
    }
  }

  if (event.longitude !== undefined && event.longitude !== null) {
    if (typeof event.longitude !== 'number' || event.longitude < -180 || event.longitude > 180) {
      errors.push('longitude: must be a number between -180 and 180');
    }
  }

  if (event.status !== undefined) {
    if (typeof event.status !== 'string' || !VALID_STATUSES.has(event.status)) {
      errors.push(`status: must be one of [${Array.from(VALID_STATUSES).join(', ')}]`);
    }
  }

  if (event.occurred_at !== undefined && event.occurred_at !== null) {
    if (typeof event.occurred_at !== 'string' || !ISO_TIMESTAMP_REGEX.test(event.occurred_at)) {
      errors.push('occurred_at: must be a valid ISO 8601 timestamp');
    }
  }

  if (event.expires_at !== undefined && event.expires_at !== null) {
    if (typeof event.expires_at !== 'string' || !ISO_TIMESTAMP_REGEX.test(event.expires_at)) {
      errors.push('expires_at: must be a valid ISO 8601 timestamp');
    }
  }

  if (event.metadata !== undefined && event.metadata !== null) {
    if (typeof event.metadata !== 'object' || Array.isArray(event.metadata)) {
      errors.push('metadata: must be a plain object');
    }
  }

  if (event.provider_hash !== undefined && event.provider_hash !== null) {
    if (typeof event.provider_hash !== 'string' || event.provider_hash.length !== 64) {
      errors.push('provider_hash: must be a 64-character hex string (SHA-256)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function registerProvider(providerId) {
  KNOWN_PROVIDERS.add(providerId);
}

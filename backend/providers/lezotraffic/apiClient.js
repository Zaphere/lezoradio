import LezoTrafficAuthManager from './authManager.js';

class LezoTrafficAPIError extends Error {
  constructor({ httpStatus, apiCode, message, requestId, timestamp, endpoint }) {
    super(message);
    this.name = 'LezoTrafficAPIError';
    this.httpStatus = httpStatus;
    this.apiCode = apiCode;
    this.requestId = requestId;
    this.timestamp = timestamp;
    this.endpoint = endpoint;
  }
}

class EndpointUnavailableError extends Error {
  constructor({ endpoint, retryAfter, httpStatus }) {
    super(`Endpoint ${endpoint} is unavailable (HTTP ${httpStatus}), retry after ${retryAfter}`);
    this.name = 'EndpointUnavailableError';
    this.endpoint = endpoint;
    this.httpStatus = httpStatus;
    this.retryAfter = retryAfter;
  }
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUSES = new Set([400, 403, 404]);

class LezoTrafficApiClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.LEZOTRAFFIC_BASE_URL || 'https://app.lezotraffic.com/api/v1';
    this.timeout = config.timeout || 10000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;

    this.authManager = new LezoTrafficAuthManager(config);
    this.requestCount = 0;
    this.errorCount = 0;
    this.stats = {
      requestsByEndpoint: {},
    };
  }

  validateEnvelope(response, endpoint) {
    if (!response || typeof response !== 'object') {
      throw new LezoTrafficAPIError({
        httpStatus: 0,
        message: 'Empty or non-object response',
        endpoint,
      });
    }

    if (response.success === false) {
      throw new LezoTrafficAPIError({
        httpStatus: 200,
        apiCode: response.error?.code,
        message: response.error?.message || 'API returned success=false',
        requestId: response.meta?.request_id,
        timestamp: response.meta?.timestamp,
        endpoint,
      });
    }

    if (response.success !== true) {
      throw new LezoTrafficAPIError({
        httpStatus: 200,
        message: 'Response missing success field',
        endpoint,
      });
    }

    return response.data;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    this.requestCount++;
    this.stats.requestsByEndpoint[endpoint] = (this.stats.requestsByEndpoint[endpoint] || 0) + 1;

    try {
      await this.authManager.ensureAuthenticated();
      const authHeaders = await this.authManager.getAuthHeaders();

      const headers = {
        ...authHeaders,
        ...(options.headers || {}),
      };

      const response = await this.withTimeout(
        fetch(url, { ...options, headers }),
        this.timeout
      );

      const duration = Date.now() - startTime;

      if (response.status === 401) {
        this.authManager.invalidate();
        await this.authManager.ensureAuthenticated();
        const newHeaders = {
          ...(await this.authManager.getAuthHeaders()),
          ...(options.headers || {}),
        };
        const retryResponse = await this.withTimeout(
          fetch(url, { ...options, headers: newHeaders }),
          this.timeout
        );
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          throw new LezoTrafficAPIError({
            httpStatus: retryResponse.status,
            message: `Request failed after re-auth: ${retryResponse.status} - ${errorText}`,
            endpoint,
          });
        }
        const retryData = await retryResponse.json();
        return this.validateEnvelope(retryData, endpoint);
      }

      if (response.status === 404) {
        throw new EndpointUnavailableError({
          endpoint,
          retryAfter: Date.now() + (24 * 60 * 60 * 1000),
          httpStatus: 404,
        });
      }

      if (response.status === 429) {
        const retryAfterSeconds = parseInt(response.headers.get('Retry-After')) || 60;
        throw new EndpointUnavailableError({
          endpoint,
          retryAfter: Date.now() + (retryAfterSeconds * 1000),
          httpStatus: 429,
        });
      }

      if (response.status === 403) {
        const errorText = await response.text();
        throw new LezoTrafficAPIError({
          httpStatus: 403,
          message: `Forbidden: ${errorText}`,
          endpoint,
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new LezoTrafficAPIError({
          httpStatus: response.status,
          message: `API request failed: ${response.status} - ${errorText}`,
          endpoint,
        });
      }

      const data = await response.json();
      return this.validateEnvelope(data, endpoint);

    } catch (error) {
      this.errorCount++;
      if (error instanceof LezoTrafficAPIError || error instanceof EndpointUnavailableError) {
        throw error;
      }
      const duration = Date.now() - startTime;
      throw new LezoTrafficAPIError({
        httpStatus: 0,
        message: error.message,
        endpoint,
      });
    }
  }

  async requestWithRetry(endpoint, options = {}) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        if (error instanceof EndpointUnavailableError) {
          throw error;
        }
        if (error instanceof LezoTrafficAPIError) {
          if (NON_RETRYABLE_STATUSES.has(error.httpStatus)) {
            throw error;
          }
        }
        if (attempt === this.maxRetries) {
          throw error;
        }
        const delay = this.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return await this.requestWithRetry(url, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return await this.requestWithRetry(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data = {}) {
    return await this.requestWithRetry(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return await this.requestWithRetry(endpoint, { method: 'DELETE' });
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      requestsByEndpoint: { ...this.stats.requestsByEndpoint },
      tokenStatus: this.authManager.getTokenStatus(),
    };
  }

  resetStats() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.stats.requestsByEndpoint = {};
  }

  getAuthManager() {
    return this.authManager;
  }
}

export default LezoTrafficApiClient;
export { LezoTrafficAPIError, EndpointUnavailableError };

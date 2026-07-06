class LezoTrafficAuthError extends Error {
  constructor({ code, message, httpStatus, requestId }) {
    super(message);
    this.name = 'LezoTrafficAuthError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
  }
}

class LezoTrafficAuthManager {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.LEZOTRAFFIC_BASE_URL || 'https://app.lezotraffic.com/api/v1';
    this.apiKey = config.apiKey || process.env.LEZOTRAFFIC_CLIENT_ID;
    this.apiSecret = config.apiSecret || process.env.LEZOTRAFFIC_CLIENT_SECRET;

    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.refreshBuffer = 300000; // 5 minutes before expiry

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('LezoTraffic API key and secret are required (LEZOTRAFFIC_CLIENT_ID, LEZOTRAFFIC_CLIENT_SECRET)');
    }
  }

  async authenticate() {
    const tokenUrl = `${this.baseUrl}/auth/token`;

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
        }),
      });

      const body = await response.json();

      if (!response.ok || !body.success) {
        throw new LezoTrafficAuthError({
          code: body.error?.code || 'AUTH_FAILED',
          message: body.error?.message || `HTTP ${response.status}`,
          httpStatus: body.error?.status || response.status,
          requestId: body.meta?.requestId,
        });
      }

      const data = body.data;
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken || null;
      const expiresIn = this.parseExpiresIn(data.expiresIn);
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      return data;
    } catch (error) {
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      if (error instanceof LezoTrafficAuthError) throw error;
      throw new LezoTrafficAuthError({
        code: 'NETWORK_ERROR',
        message: error.message,
        httpStatus: 0,
      });
    }
  }

  parseExpiresIn(expiresIn) {
    if (typeof expiresIn === 'number') return expiresIn;
    if (typeof expiresIn === 'string') {
      if (expiresIn.endsWith('m')) return parseInt(expiresIn) * 60;
      if (expiresIn.endsWith('h')) return parseInt(expiresIn) * 3600;
      if (expiresIn.endsWith('d')) return parseInt(expiresIn) * 86400;
      return parseInt(expiresIn);
    }
    return 900; // Default 15 minutes
  }

  async refreshAccessToken() {
    const refreshUrl = `${this.baseUrl}/auth/refresh`;

    if (!this.refreshToken) {
      return await this.authenticate();
    }

    try {
      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const body = await response.json();

      if (!response.ok || !body.success) {
        this.refreshToken = null;
        return await this.authenticate();
      }

      const data = body.data;
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || null;
      const expiresIn = data.expires_in || 3600;
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      return data;
    } catch (error) {
      this.refreshToken = null;
      return await this.authenticate();
    }
  }

  async getAccessToken() {
    if (!this.accessToken) {
      await this.authenticate();
      return this.accessToken;
    }

    if (this.isTokenExpiring()) {
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    return Date.now() >= this.tokenExpiry;
  }

  isTokenExpiring() {
    if (!this.tokenExpiry) return true;
    return Date.now() >= (this.tokenExpiry - this.refreshBuffer);
  }

  invalidate() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  async ensureAuthenticated() {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.authenticate();
    }
  }

  async getAuthHeaders() {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  getTokenStatus() {
    const now = Date.now();
    const timeUntilExpiry = this.tokenExpiry ? this.tokenExpiry - now : null;

    return {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      isExpired: this.isTokenExpired(),
      isExpiring: this.isTokenExpiring(),
      timeUntilExpiry: timeUntilExpiry ? Math.round(timeUntilExpiry / 1000) : null,
      tokenExpiry: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : null,
    };
  }
}

export default LezoTrafficAuthManager;
export { LezoTrafficAuthError };

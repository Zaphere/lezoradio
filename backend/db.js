import pg from 'pg';
import './env.js';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'lezoradio',
  user: process.env.DB_USER || 'lezoradio_app',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});

/**
 * Execute a query with parameters.
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[db] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    return result;
  } catch (err) {
    console.error('[db] Query error:', err.message, '\nSQL:', text.substring(0, 200));
    throw err;
  }
}

/**
 * Get a client from the pool for transactions.
 */
export async function getClient() {
  return pool.connect();
}

/**
 * Close all connections.
 */
export async function close() {
  await pool.end();
}

/**
 * Test the connection.
 */
export async function testConnection() {
  try {
    const result = await query('SELECT NOW() as now');
    console.log('[db] Connected to PostgreSQL at:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    return false;
  }
}

export default pool;

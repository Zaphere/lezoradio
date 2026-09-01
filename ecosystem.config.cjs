// ecosystem.config.cjs — PM2 configuration for Radio Lezo
// Usage: pm2 start ecosystem.config.cjs
//        pm2 save
//        pm2 startup

module.exports = {
  apps: [
    {
      name: 'radiolezo',
      script: 'backend/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4100,
      },
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Memory limit — kill if exceeds 512MB
      max_memory_restart: '512M',
      // Logging
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Watch disabled for production
      watch: false,
    },
  ],
};

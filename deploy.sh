#!/bin/bash
# deploy.sh — Build frontend + run migrations + prepare server for production
# Run locally: ./deploy.sh
# Then push to server and run: pm2 start ecosystem.config.cjs

set -e

echo "========================================="
echo "  Radio Lezo — Production Build"
echo "========================================="

# 1. Install frontend dependencies
echo ""
echo "[1/5] Installing frontend dependencies..."
npm ci --production=false

# 2. Build frontend
echo ""
echo "[2/5] Building frontend..."
npm run build

# 3. Install backend dependencies
echo ""
echo "[3/5] Installing backend dependencies..."
cd backend
npm ci --production
cd ..

# 4. Run database migrations
echo ""
echo "[4/5] Running database migrations..."
cd backend
node migrate.js
cd ..

# 5. Create logs directory
echo ""
echo "[5/5] Creating logs directory..."
mkdir -p logs

echo ""
echo "========================================="
echo "  Build complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Copy this entire folder to your server"
echo "  2. Copy backend/.env.example to backend/.env and fill in your secrets"
echo "  3. Run: pm2 start ecosystem.config.cjs"
echo "  4. Run: pm2 save"
echo "  5. Run: pm2 startup (to auto-start on reboot)"
echo ""
echo "The app will be available at: http://YOUR_SERVER_IP:4100"
echo ""

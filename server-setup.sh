#!/bin/bash
# server-setup.sh — Run ONCE on the server to install PM2 + Node.js deps + migrations
# This is a one-time setup. After this, use deploy.sh for updates.

set -e

echo "========================================="
echo "  Radio Lezo — Server Setup (one-time)"
echo "========================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Install Node.js 20+ first."
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "Node.js: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm not found."
    exit 1
fi

echo "npm: $(npm -v)"

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo ""
    echo "Installing PM2..."
    sudo npm install -g pm2
    echo "PM2 installed."
else
    echo "PM2: $(pm2 -v)"
fi

# Install frontend deps + build
echo ""
echo "[1/4] Installing frontend dependencies..."
npm ci --production=false

echo ""
echo "[2/4] Building frontend..."
npm run build

# Install backend deps
echo ""
echo "[3/4] Installing backend dependencies..."
cd backend
npm ci --production
cd ..

# Create .env from production template if it doesn't exist
if [ ! -f backend/.env ]; then
    echo ""
    echo "No backend/.env found — copying from .env.production template."
    echo "EDIT backend/.env with your actual secrets before starting!"
    cp backend/.env.production backend/.env
fi

# Run database migrations
echo ""
echo "[4/4] Running database migrations..."
cd backend
node migrate.js
cd ..

# Create logs directory
mkdir -p logs

echo ""
echo "========================================="
echo "  Setup complete!"
echo "========================================="
echo ""
echo "1. Edit backend/.env with your Supabase + ElevenLabs secrets"
echo "2. Start the app:  pm2 start ecosystem.config.cjs"
echo "3. Save PM2 state:  pm2 save"
echo "4. Auto-start on reboot:  pm2 startup"
echo ""
echo "Useful commands:"
echo "  pm2 logs radiolezo       — view live logs"
echo "  pm2 restart radiolezo    — restart the app"
echo "  pm2 stop radiolezo       — stop the app"
echo "  pm2 status               — check status"
echo ""
echo "App URL: http://YOUR_SERVER_IP:4100"
echo ""

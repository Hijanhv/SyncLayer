#!/bin/bash

echo "🚀 Starting SyncLayer Backend Setup..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cat > .env << 'EOF'
# Database
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=root
DATABASE_NAME=synclayer

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Google Sheets
GOOGLE_SHEETS_SHEET_ID=your_sheet_id_here

# Server
PORT=3000
CORS_ORIGIN=http://localhost:5173

# Sync
SYNC_INTERVAL_MS=30000
EOF
    echo "⚠️ Please update .env with your Google Sheet ID"
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Start the server
echo "🚀 Starting backend server..."
pnpm dev
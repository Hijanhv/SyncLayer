#!/bin/bash

set -e

echo "🚀 SyncLayer Setup Script"
echo "=========================="
echo ""

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed"
    echo "Install with: npm install -g pnpm"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "Install from: https://www.docker.com/get-started"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

echo "🐳 Starting Docker containers..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "📦 Installing backend dependencies..."
cd backend
pnpm install

if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your configuration"
fi

if [ ! -f service-account-key.json ]; then
    echo "⚠️  service-account-key.json not found"
    echo "Please add your Google Service Account key to backend/service-account-key.json"
fi

cd ..

echo "📦 Installing frontend dependencies..."
cd frontend
pnpm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your service-account-key.json to backend/"
echo "2. Update backend/.env with your Google Sheet ID"
echo "3. Start backend: cd backend && pnpm dev"
echo "4. Start frontend: cd frontend && pnpm dev"
echo ""
echo "Access the app at http://localhost:5173"

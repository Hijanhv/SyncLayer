#!/bin/bash

echo "🧪 Complete Sync Test"
echo "===================="

echo "1. Clearing data..."
mysql -h 127.0.0.1 -P 3306 -u root -proot synclayer -e "TRUNCATE TABLE sync_data;" 2>/dev/null

echo "2. Adding via API..."
curl -X POST http://localhost:3000/api/data/db \
  -H "Content-Type: application/json" \
  -d '{"name":"Sync Test","email":"sync@test.com","status":"active"}' \
  -s | jq .

echo "3. Waiting for sync..."
sleep 12

echo "4. Checking database..."
curl -s http://localhost:3000/api/data/db | jq '.rows[0]'

echo "5. Checking sheet..."
curl -s http://localhost:3000/api/data/sheet | jq '.rows[0]'

echo "6. Checking sync logs..."
curl -s http://localhost:3000/api/sync/logs | jq '.logs[-1]'

echo "✅ Test complete!"

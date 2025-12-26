#!/bin/sh
API_URL="${VITE_API_URL:-http://localhost:8080}"
echo "Using API URL: $API_URL"
sed -i "s|http://localhost:8080|$API_URL|g" /app/dist/index.html
for file in /app/dist/assets/*.js; do
  if [ -f "$file" ]; then
    sed -i "s|http://localhost:8080|$API_URL|g" "$file"
  fi
done
exec serve -s dist -l 3000

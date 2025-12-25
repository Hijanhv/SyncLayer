# Development Workflow Guide

## Quick Start

### 1. Initial Setup (One-time)

```bash
chmod +x setup.sh
./setup.sh

cd backend
cp .env.example .env
```

Edit `backend/.env`:
- Set `GOOGLE_SHEET_ID` to your sheet ID
- Ensure `service-account-key.json` is in backend directory

### 2. Start Development

**Terminal 1 - Infrastructure:**
```bash
docker-compose up
```

**Terminal 2 - Backend:**
```bash
cd backend
pnpm dev
```

**Terminal 3 - Frontend:**
```bash
cd frontend
pnpm dev
```

### 3. Add Sample Data

Open your Google Sheet and add:

```
Row 2: 1 | John Doe | john@example.com | active | 1 | 2025-12-25T10:00:00.000Z | sheet
Row 3: 2 | Jane Smith | jane@example.com | pending | 1 | 2025-12-25T10:00:00.000Z | sheet
```

Watch the sync happen in the UI at http://localhost:5173

## Development Tasks

### View Logs

**Backend logs:**
```bash
cd backend
pnpm dev
```

**Database logs:**
```bash
docker logs -f synclayer-mysql
```

**Redis logs:**
```bash
docker logs -f synclayer-redis
```

### Query Database

```bash
docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer
```

```sql
SELECT * FROM sync_data;
SELECT COUNT(*) FROM sync_data;
```

### Clear All Data

```bash
docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e "TRUNCATE TABLE sync_data;"
```

### Monitor Queue

```bash
curl http://localhost:3000/api/sync/stats | jq
```

### Trigger Manual Sync

```bash
curl -X POST http://localhost:3000/api/sync/trigger | jq
```

### View Sync Logs

```bash
curl http://localhost:3000/api/sync/logs | jq
```

## Testing Scenarios

### Test 1: Sheet → DB Sync

1. Add row to Google Sheet
2. Wait 3 seconds
3. Check UI - row should appear in MySQL panel
4. Verify in DB:
   ```bash
   docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e "SELECT * FROM sync_data;"
   ```

### Test 2: DB → Sheet Sync

1. Insert row directly to MySQL:
   ```bash
   docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e \
   "INSERT INTO sync_data VALUES ('test-1', 'Test User', 'test@example.com', 'active', 1, NOW(3), 'db');"
   ```
2. Wait 3 seconds
3. Check Google Sheet - row should appear
4. Check UI - row should appear in Sheet panel

### Test 3: Conflict Resolution

1. Edit row 1 in Sheet: change name to "Updated Name"
2. Immediately edit row 1 in DB:
   ```bash
   docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e \
   "UPDATE sync_data SET name='DB Updated', version=version+1, updated_at=NOW(3), last_updated_by='db' WHERE id='1';"
   ```
3. Wait for sync
4. Most recent edit should win
5. Check version number incremented

### Test 4: Loop Prevention

1. Add row in Sheet
2. Wait for sync to DB
3. Check logs - should see "Updated X rows in DB from Sheet"
4. Next sync cycle should show "No changes detected"
5. Row should NOT sync back to Sheet

### Test 5: Concurrent Edits

1. Open Sheet in 2 browser tabs
2. Edit row 1 in tab 1: change email
3. Edit row 2 in tab 2: change status
4. Both changes should sync without conflict
5. Each row is independent

## Debugging

### Backend Not Starting

**Check ports:**
```bash
lsof -i :3000
```

**Check MySQL connection:**
```bash
docker exec -it synclayer-mysql mysql -uroot -ppassword -e "SELECT 1;"
```

**Check Redis connection:**
```bash
docker exec -it synclayer-redis redis-cli ping
```

### Sync Not Working

**Check service account permissions:**
- Verify sheet is shared with service account email
- Service account has Editor access

**Check Google Sheets API:**
- API is enabled in Google Cloud Console
- Quota not exceeded

**Check logs:**
```bash
cd backend
pnpm dev
```
Look for error messages

**Manual trigger:**
```bash
curl -X POST http://localhost:3000/api/sync/trigger
```

### Data Not Appearing

**Check sheet format:**
- Headers in row 1: id | name | email | status | version | updated_at | last_updated_by
- Data starts from row 2

**Check data types:**
- version must be integer
- updated_at must be ISO 8601 string
- last_updated_by must be 'sheet' or 'db'

**Check MySQL:**
```bash
docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e "SELECT * FROM sync_data;"
```

## Performance Testing

### Load Test Sync

```bash
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/sync/trigger &
done
wait
```

Check queue stats:
```bash
curl http://localhost:3000/api/sync/stats | jq
```

### Monitor Memory

```bash
docker stats
```

### Measure Sync Latency

1. Note current time
2. Edit sheet
3. Check UI logs for sync completion
4. Calculate difference

Target: <5 seconds

## Cleanup

### Stop All Services

```bash
docker-compose down
```

### Remove All Data

```bash
docker-compose down -v
```

### Reset Everything

```bash
docker-compose down -v
cd backend && rm -rf node_modules dist
cd ../frontend && rm -rf node_modules dist
```

## Production Deployment Checklist

- [ ] Change MySQL password
- [ ] Use production Redis (not localhost)
- [ ] Store service account key securely (AWS Secrets Manager, etc.)
- [ ] Set up monitoring (Datadog, New Relic)
- [ ] Configure alerting
- [ ] Set up backup for MySQL
- [ ] Enable Redis persistence
- [ ] Add rate limiting
- [ ] Add authentication
- [ ] Set up CI/CD
- [ ] Configure CORS properly
- [ ] Use environment-specific configs
- [ ] Set up logging aggregation
- [ ] Configure health checks
- [ ] Set up auto-scaling
- [ ] Load test before launch

## Useful Commands

**Restart backend:**
```bash
cd backend && pnpm dev
```

**Rebuild backend:**
```bash
cd backend && pnpm build && pnpm start
```

**Format code:**
```bash
cd backend && pnpm format
cd frontend && pnpm format
```

**Type check:**
```bash
cd backend && pnpm tsc --noEmit
cd frontend && pnpm tsc --noEmit
```

**View all jobs:**
```bash
curl http://localhost:3000/api/sync/stats
```

## Tips

1. Keep browser console open to see API calls
2. Watch backend terminal for detailed logs
3. Use Google Sheet version history to debug
4. MySQL timestamp precision is 3ms - matches ISO string
5. Redis is in-memory - data lost on restart (use persistence in prod)
6. BullMQ UI available at http://localhost:3000/admin/queues (if added)
7. Rate limit: 20 API calls per sync cycle (10 read + 10 write)

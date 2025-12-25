# 🚀 SETUP COMPLETE - Next Steps

## ✅ What's Done

1. ✅ Backend dependencies installed (pnpm)
2. ✅ Frontend dependencies installed (pnpm)
3. ✅ Docker containers running (MySQL + Redis)
4. ✅ Environment files created (.env)
5. ✅ Placeholder service account key created

## 🔧 What You Need To Do

### STEP 1: Get Google Service Account Key

**Follow these steps:**

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Enable **Google Sheets API**:
   - Click "APIs & Services" → "Library"
   - Search "Google Sheets API"
   - Click "Enable"

4. Create **Service Account**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name: `synclayer-service`
   - Role: `Editor`
   - Click "Done"

5. Generate **JSON Key**:
   - Click on the service account you created
   - Go to "Keys" tab
   - Click "Add Key" → "Create New Key"
   - Choose `JSON` format
   - **Download the file**

6. **Replace** the placeholder:
   ```bash
   # Replace this file with your downloaded JSON key:
   backend/service-account-key.json
   ```

### STEP 2: Create & Share Google Sheet

1. **Create a new Google Sheet**: https://sheets.google.com

2. **Add headers in Row 1** (exact format):
   ```
   id | name | email | status | version | updated_at | last_updated_by
   ```

3. **Copy the Sheet ID** from URL:
   ```
   https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_SHEET_ID]/edit
   ```

4. **Share the sheet** with your service account:
   - Click the "Share" button
   - Paste the service account email (from JSON key file):
     ```
     your-service-account@your-project.iam.gserviceaccount.com
     ```
   - Grant **Editor** access
   - Click "Share"

5. **Update backend/.env**:
   ```bash
   GOOGLE_SHEET_ID=paste_your_sheet_id_here
   ```

### STEP 3: Add Sample Data (Optional)

Add sample rows to your Google Sheet (starting from Row 2):

```
Row 2: 1 | John Doe | john@example.com | active | 1 | 2025-12-25T10:00:00.000Z | sheet
Row 3: 2 | Jane Smith | jane@example.com | pending | 1 | 2025-12-25T10:00:00.000Z | sheet
Row 4: 3 | Bob Wilson | bob@example.com | active | 1 | 2025-12-25T10:00:00.000Z | sheet
```

## 🚀 Start The Application

Once you've completed Steps 1 & 2 above:

### Terminal 1 - Backend:
```bash
cd backend
pnpm dev
```

Expected output:
```
✅ Database initialized
✅ Redis connected
✅ Sheet headers initialized
✅ Services initialized
✅ Server running on http://localhost:3000
⏱️  Starting sync polling every 3000ms
```

### Terminal 2 - Frontend:
```bash
cd frontend
pnpm dev
```

Expected output:
```
VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Open Browser:
```
http://localhost:5173
```

You should see the SyncLayer dashboard!

## 🧪 Test The Sync

1. **Test Sheet → DB**:
   - Edit a cell in your Google Sheet
   - Wait 3 seconds
   - Check the UI - data should appear in "MySQL Data" panel

2. **Test DB → Sheet**:
   ```bash
   docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e \
   "INSERT INTO sync_data VALUES ('test-1', 'Test User', 'test@example.com', 'active', 1, NOW(3), 'db');"
   ```
   - Wait 3 seconds
   - Check your Google Sheet - new row should appear

## 📊 Check Infrastructure

```bash
# Check running containers
docker ps

# Check MySQL
docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e "SHOW TABLES;"

# Check Redis
docker exec -it synclayer-redis redis-cli ping

# View backend logs
cd backend && pnpm dev

# View container logs
docker logs -f synclayer-mysql
docker logs -f synclayer-redis
```

## 🐛 Troubleshooting

### Backend won't start:

**Error: "Cannot find module 'googleapis'"**
```bash
cd backend && pnpm install
```

**Error: "ECONNREFUSED MySQL"**
```bash
docker ps  # Check if MySQL is running
docker logs synclayer-mysql  # Check MySQL logs
```

**Error: "Invalid service account"**
- Make sure you replaced `backend/service-account-key.json` with real credentials
- Check the JSON format is valid

### Sheet not syncing:

1. **Verify service account email** in sheet sharing
2. **Check sheet ID** in backend/.env
3. **Verify headers** in Row 1 match exactly
4. **Check backend logs** for errors

### Frontend not loading:

```bash
cd frontend && pnpm install
pnpm dev
```

## 📚 Documentation

- **Setup Guide**: README.md
- **Quick Reference**: QUICK_REFERENCE.md
- **Architecture**: ARCHITECTURE.md
- **Deployment**: DEPLOYMENT.md
- **All Docs**: INDEX.md

## 🎯 Quick Commands

```bash
# Stop everything
docker-compose down

# Restart containers
docker-compose restart

# View all data in MySQL
docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e "SELECT * FROM sync_data;"

# Clear all data
docker exec -it synclayer-mysql mysql -uroot -ppassword synclayer -e "TRUNCATE TABLE sync_data;"

# Check queue stats
curl http://localhost:3000/api/sync/stats | jq

# Trigger manual sync
curl -X POST http://localhost:3000/api/sync/trigger
```

## ✨ You're Almost Ready!

Just complete Steps 1 & 2 above, then run the backend and frontend. The sync will start automatically every 3 seconds.

**Current Status:**
- ✅ Code complete
- ✅ Dependencies installed
- ✅ Docker running
- ⚠️  Need: Google credentials & Sheet ID
- ⚠️  Need: Start backend & frontend

---

**Happy syncing! 🚀**

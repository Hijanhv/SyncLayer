# 🚀 Step-by-Step Setup Walkthrough

**Estimated Time: 15 minutes**  
**Current Status: Infrastructure ready, need Google credentials**

---

## ✅ STEP 1: Google Cloud Project Setup (10 minutes)

### 1.1 Create Google Cloud Project (2 minutes)

1. **Open Google Cloud Console**
   - Go to: https://console.cloud.google.com
   - Sign in with your Google account

2. **Create New Project**
   - Click the project dropdown at the top (next to "Google Cloud")
   - Click **"NEW PROJECT"**
   - Project name: `SyncLayer` (or anything you want)
   - Click **"CREATE"**
   - Wait ~30 seconds for project creation
   - **Select your new project** from the dropdown

---

### 1.2 Enable Google Sheets API (2 minutes)

1. **Open API Library**
   - In the left sidebar, click **"APIs & Services"** → **"Library"**
   - OR go directly to: https://console.cloud.google.com/apis/library

2. **Find Google Sheets API**
   - Search for: `Google Sheets API`
   - Click on **"Google Sheets API"** from results

3. **Enable the API**
   - Click the blue **"ENABLE"** button
   - Wait ~10 seconds for activation
   - You should see "API enabled" ✅

---

### 1.3 Create Service Account (3 minutes)

1. **Go to Service Accounts**
   - In left sidebar: **"APIs & Services"** → **"Credentials"**
   - OR go to: https://console.cloud.google.com/apis/credentials

2. **Create Service Account**
   - Click **"+ CREATE CREDENTIALS"** at the top
   - Select **"Service Account"**

3. **Fill Service Account Details**
   - **Service account name**: `synclayer-service`
   - **Service account ID**: (auto-generated, e.g., `synclayer-service@...`)
   - **Description**: `Service account for SyncLayer sync system`
   - Click **"CREATE AND CONTINUE"**

4. **Grant Access (Optional)**
   - **Select a role**: Skip this (click "CONTINUE")
   - **Grant users access**: Skip this (click "DONE")

---

### 1.4 Download JSON Key (3 minutes)

1. **Find Your Service Account**
   - You should see your service account in the list
   - Email format: `synclayer-service@your-project-id.iam.gserviceaccount.com`
   - **Copy this email address** - you'll need it soon! 📋

2. **Create Key**
   - Click on the service account email (the one you just created)
   - Go to **"KEYS"** tab at the top
   - Click **"ADD KEY"** → **"Create new key"**

3. **Download JSON**
   - Select **"JSON"** format
   - Click **"CREATE"**
   - A JSON file downloads automatically (e.g., `your-project-123456-abcdef.json`)
   - **Important**: Keep this file safe!

4. **Replace Placeholder File**
   ```bash
   # Move your downloaded JSON to replace the placeholder
   # Replace 'your-project-123456-abcdef.json' with your actual filename
   
   mv ~/Downloads/your-project-123456-abcdef.json /Users/janhv/Desktop/SyncLayer/backend/service-account-key.json
   ```

   **OR manually:**
   - Open your downloaded JSON file
   - Copy all the contents
   - Open `/Users/janhv/Desktop/SyncLayer/backend/service-account-key.json`
   - Replace everything with your copied JSON
   - Save the file

---

## ✅ STEP 2: Google Sheet Setup (5 minutes)

### 2.1 Create New Google Sheet (1 minute)

1. **Go to Google Sheets**
   - Open: https://sheets.google.com
   - Click **"+ Blank"** to create new sheet

2. **Name Your Sheet**
   - Click "Untitled spreadsheet" at the top
   - Rename to: `SyncLayer Data` (or any name you prefer)

---

### 2.2 Add Column Headers (1 minute)

1. **Add Headers in Row 1**
   - In cell **A1**, type: `id`
   - In cell **B1**, type: `name`
   - In cell **C1**, type: `email`
   - In cell **D1**, type: `status`
   - In cell **E1**, type: `version`
   - In cell **F1**, type: `updated_at`
   - In cell **G1**, type: `last_updated_by`

2. **Format Headers (Optional)**
   - Select row 1
   - Make it bold (Ctrl/Cmd + B)
   - Add background color if you want

**Your sheet should look like this:**
```
| id | name | email | status | version | updated_at | last_updated_by |
|----|------|-------|--------|---------|------------|-----------------|
|    |      |       |        |         |            |                 |
```

---

### 2.3 Share with Service Account (1 minute)

1. **Click "Share" Button**
   - Top-right corner of the sheet

2. **Add Service Account**
   - Paste the service account email you copied earlier
   - Format: `synclayer-service@your-project-id.iam.gserviceaccount.com`
   - Permission: **"Editor"** (default is fine)
   - **Uncheck** "Notify people" (service accounts don't need emails)
   - Click **"Share"** or **"Done"**

---

### 2.4 Copy Sheet ID (1 minute)

1. **Get Sheet ID from URL**
   - Look at your browser URL bar
   - Format: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - The Sheet ID is the long string between `/d/` and `/edit`
   
   **Example:**
   ```
   URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
   
   Sheet ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
                ↑ Copy this part ↑
   ```

2. **Copy the Sheet ID** 📋

---

### 2.5 Update Environment Variable (1 minute)

1. **Open backend/.env file**
   ```bash
   open /Users/janhv/Desktop/SyncLayer/backend/.env
   ```

2. **Update SHEET_ID**
   - Find the line: `SHEET_ID=your_sheet_id_here`
   - Replace `your_sheet_id_here` with your actual Sheet ID
   - Save the file

   **Before:**
   ```env
   SHEET_ID=your_sheet_id_here
   ```

   **After:**
   ```env
   SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
   ```

---

## ✅ STEP 3: Start Services (1 minute)

### 3.1 Start Backend (30 seconds)

1. **Open Terminal 1**
   ```bash
   cd /Users/janhv/Desktop/SyncLayer/backend
   pnpm dev
   ```

2. **Wait for Success Messages**
   You should see:
   ```
   ✅ Database initialized
   ✅ Redis connected
   ✅ Google Sheets API authenticated
   ✅ Sheet headers initialized
   ✅ Services initialized
   ✅ Server running on http://localhost:3000
   ⏱️  Starting sync polling every 3000ms
   🔄 Sync completed: 0 changes detected
   ```

   **If you see errors:**
   - ❌ "Error reading service account file" → Go back to Step 1.4
   - ❌ "Error accessing Sheet" → Go back to Step 2.3
   - ❌ "Invalid Sheet ID" → Go back to Step 2.5

---

### 3.2 Start Frontend (30 seconds)

1. **Open Terminal 2** (new terminal window/tab)
   ```bash
   cd /Users/janhv/Desktop/SyncLayer/frontend
   pnpm dev
   ```

2. **Wait for Vite to Start**
   You should see:
   ```
   VITE v5.0.0  ready in 423 ms

   ➜  Local:   http://localhost:5173/
   ➜  Network: use --host to expose
   ➜  press h + enter to show help
   ```

---

## ✅ STEP 4: Open Application (10 seconds)

1. **Open Browser**
   - Go to: http://localhost:5173
   - You should see the **SyncLayer Dashboard** 🎉

2. **What You Should See:**
   - Yellow navigation bar with "SyncLayer Dashboard"
   - Two panels: "Google Sheet Data" and "MySQL Database Data"
   - Controls: "Trigger Sync Now" button
   - Live logs at the bottom
   - Queue stats (Waiting, Active, Completed, Failed)

---

## ✅ STEP 5: Test the Sync (2 minutes)

### 5.1 Test Sheet → Database Sync

1. **Add Data to Google Sheet**
   - Go to your Google Sheet
   - In row 2 (first empty row), add:
     - A2: `1`
     - B2: `John Doe`
     - C2: `john@example.com`
     - D2: `active`
     - (Leave E2, F2, G2 empty - auto-filled by backend)

2. **Watch the Dashboard**
   - Go back to http://localhost:5173
   - Within 3-5 seconds, the data appears in both panels ✅
   - Check the logs - you should see "Sync completed: 1 changes detected"

---

### 5.2 Test Database → Sheet Sync

1. **Add Data to MySQL**
   - In Terminal 3, run:
   ```bash
   docker exec -it synclayer-mysql mysql -u root -prootpassword synclayer
   ```

2. **Insert a Row**
   ```sql
   INSERT INTO sync_data (id, name, email, status, version, updated_at, last_updated_by)
   VALUES (2, 'Jane Smith', 'jane@example.com', 'active', 1, NOW(), 'db');
   ```

3. **Exit MySQL**
   ```sql
   exit
   ```

4. **Check Google Sheet**
   - Within 3-5 seconds, row 3 appears with Jane's data ✅

---

### 5.3 Test Conflict Resolution

1. **Edit Same Row in Both Systems**
   - **In Sheet**: Change John's email to `john.new@example.com`
   - **In MySQL**: Run:
     ```sql
     docker exec synclayer-mysql mysql -u root -prootpassword synclayer \
       -e "UPDATE sync_data SET email='john.old@example.com' WHERE id=1;"
     ```

2. **Wait 3-5 Seconds**
   - The **last write wins** ✅
   - Both systems should show the same email
   - Check dashboard logs for "Conflict resolved"

---

## 🎉 SUCCESS! You're Live!

### What's Working:
✅ Backend polling Google Sheets every 3 seconds  
✅ Changes sync from Sheet → MySQL automatically  
✅ Changes sync from MySQL → Sheet automatically  
✅ Conflicts resolved by timestamp (last write wins)  
✅ Infinite loops prevented (source tracking)  
✅ Real-time dashboard updates  
✅ Job queue processing background tasks  

---

## 🐛 Troubleshooting

### Frontend Not Loading (http://localhost:5173)

**Issue**: Site shows "This site can't be reached"

**Fix:**
```bash
# Check if frontend is running
lsof -i :5173

# If not running, restart frontend
cd /Users/janhv/Desktop/SyncLayer/frontend
pnpm dev
```

---

### Backend Errors on Startup

**Error: "Error reading service account file"**
- **Cause**: Invalid or missing JSON key
- **Fix**: Repeat Step 1.4 - download new key and replace file

**Error: "Request had insufficient authentication scopes"**
- **Cause**: Google Sheets API not enabled
- **Fix**: Repeat Step 1.2 - enable the API

**Error: "The caller does not have permission"**
- **Cause**: Service account not shared with Sheet
- **Fix**: Repeat Step 2.3 - share Sheet with service account email

**Error: "Unable to parse range"**
- **Cause**: Wrong Sheet ID in .env
- **Fix**: Repeat Step 2.5 - copy correct Sheet ID from URL

---

### No Data Syncing

**Issue**: Backend running but no sync happening

**Check:**
```bash
# Verify Docker containers
docker ps | grep synclayer

# Check backend logs
# Look in Terminal 1 for error messages
```

**Common fixes:**
1. Restart backend: Ctrl+C in Terminal 1, then `pnpm dev`
2. Check Sheet headers match exactly (step 2.2)
3. Verify service account has Editor permissions

---

### Database Connection Failed

**Issue**: "Error connecting to database"

**Fix:**
```bash
# Restart MySQL container
docker restart synclayer-mysql

# Wait 10 seconds, then restart backend
cd /Users/janhv/Desktop/SyncLayer/backend
pnpm dev
```

---

## 📊 Verify Everything Works

Run this quick health check:

```bash
cd /Users/janhv/Desktop/SyncLayer

# 1. Check Docker
docker ps | grep synclayer
# Should show 2 healthy containers

# 2. Check Backend
curl http://localhost:3000/health
# Should return: {"status":"ok"}

# 3. Check Frontend
curl http://localhost:5173
# Should return HTML

# 4. Check Database
docker exec synclayer-mysql mysql -u root -prootpassword synclayer \
  -e "SELECT COUNT(*) FROM sync_data;"
# Should return row count
```

---

## 🚀 Next Steps

### Add More Data
- Add 10-20 rows to your Sheet
- Watch them sync to MySQL automatically
- Try editing/deleting rows

### Monitor Performance
- Dashboard shows queue statistics
- Check logs for sync timing
- Watch for any errors

### Production Deployment
- See DEPLOYMENT.md for AWS/GCP setup
- Configure production passwords
- Set up monitoring (Datadog/Sentry)
- Enable HTTPS/SSL

---

## 📞 Need Help?

Check these files:
- [README.md](README.md) - Full setup guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - How it works
- [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) - API details
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production setup

---

**Status**: 🎯 **READY TO USE**  
**Time Taken**: ~15 minutes  
**Result**: Production-grade sync system running locally

*Happy syncing! 🚀✨*

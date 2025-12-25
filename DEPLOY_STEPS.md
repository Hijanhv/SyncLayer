# 🚀 Step-by-Step Deployment Guide

## Prerequisites
- ✅ Code pushed to GitHub (main branch)
- ✅ Railway account (https://railway.app)
- ✅ Vercel account (https://vercel.com)
- ✅ Google Service Account JSON key

---

## Part 1: Deploy Backend to Railway (10 mins)

### Step 1: Create Railway Project
1. Go to https://railway.app/dashboard
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `SyncLayer` repository
4. Railway will auto-detect the backend and start building

### Step 2: Add MySQL Database
1. In your Railway project, click **"+ New"** → **"Database"** → **"Add MySQL"**
2. Railway auto-creates: `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
3. These variables are automatically injected into your backend service

### Step 3: Add Redis Database
1. Click **"+ New"** → **"Database"** → **"Add Redis"**
2. Railway auto-creates: `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT`
3. Variables automatically available to backend

### Step 4: Configure Environment Variables
In your backend service settings → **Variables** tab, add:

```bash
# Google Sheets Configuration
GOOGLE_SHEET_ID=your_sheet_id_here

# Google Service Account (paste entire JSON as one line)
GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account","project_id":"your-project",...}

# Port (Railway sets this automatically)
PORT=3000
```

**How to get Service Account JSON as one line:**
```bash
cat backend/service-account-key.json | tr -d '\n'
```

### Step 5: Deploy & Get Backend URL
1. Railway deploys automatically after adding variables
2. Go to **Settings** → **Networking** → **Generate Domain**
3. Copy the URL (e.g., `https://synclayer-backend-production.up.railway.app`)
4. **Save this URL** - you'll need it for frontend config

---

## Part 2: Deploy Frontend to Vercel (5 mins)

### Step 1: Connect to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Click **"Configure Project"**

### Step 2: Configure Build Settings
```
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### Step 3: Add Environment Variable
In **Environment Variables** section:
```
Name: VITE_API_URL
Value: https://your-railway-backend-url.up.railway.app
```
(Use the URL from Railway Step 5)

### Step 4: Deploy
1. Click **"Deploy"**
2. Wait 2-3 minutes for build
3. Copy your Vercel URL (e.g., `https://synclayer.vercel.app`)

---

## Part 3: Connect Frontend & Backend (2 mins)

### Update Backend CORS
1. Go back to Railway dashboard
2. Open your backend service → **Variables**
3. Add new variable:
```
CORS_ORIGIN=https://your-vercel-url.vercel.app
```

Railway will auto-redeploy with new CORS settings.

---

## Part 4: Verify Deployment ✅

### Test Backend
Open: `https://your-railway-url.up.railway.app/health`

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-26T...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "sheets": "connected"
  }
}
```

### Test Frontend
1. Open: `https://your-vercel-url.vercel.app`
2. You should see the SyncLayer dashboard
3. Click **"Sync Now"** button
4. Data should appear in both columns

### Test Sync Flow
1. Edit your Google Sheet (add/modify rows)
2. Wait 3 seconds (auto-sync interval)
3. See changes reflected in UI
4. Check sync logs at bottom of dashboard

---

## 🎉 You're Live!

Your production URLs:
- **Frontend:** `https://synclayer.vercel.app`
- **Backend:** `https://synclayer-backend.up.railway.app`
- **Google Sheet:** Your shared sheet

---

## Troubleshooting

### Backend won't start
- Check Railway logs for errors
- Verify `GOOGLE_APPLICATION_CREDENTIALS` is valid JSON (one line)
- Ensure Google Sheet is shared with service account email

### Frontend shows "Network Error"
- Verify `VITE_API_URL` in Vercel matches Railway backend URL
- Check backend CORS allows Vercel domain
- Test backend `/health` endpoint directly

### Sync not working
- Check backend logs in Railway dashboard
- Verify Google Sheet ID is correct
- Ensure service account has Editor access to sheet

### Database errors
- Railway MySQL might need 30-60 seconds to fully initialize
- Check connection logs in Railway dashboard
- Verify environment variables are set

---

## Cost Breakdown

**Railway (Backend + Databases):**
- Hobby Plan: $5/month (500 hours)
- MySQL: Included in plan
- Redis: Included in plan
- **Total: $5/month**

**Vercel (Frontend):**
- Hobby Plan: Free
- 100GB bandwidth/month
- **Total: $0/month**

**Grand Total: $5/month** 🎉

---

## Next Steps

1. **Add Custom Domain** (Optional)
   - Point your domain to Vercel
   - Add domain in Vercel dashboard
   - Update CORS in Railway

2. **Monitor Usage**
   - Railway dashboard shows resource usage
   - Vercel analytics track traffic

3. **Scale Up** (When needed)
   - Railway: Increase replicas for auto-scaling
   - MySQL: Add read replicas
   - Redis: Increase memory

4. **Security Hardening**
   - Add authentication to frontend
   - Implement API rate limiting
   - Enable Redis password
   - Use strong MySQL password

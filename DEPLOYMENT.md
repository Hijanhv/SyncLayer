# Production Deployment Guide

## Infrastructure Requirements

### Minimum Specs
- **Backend:** 1 vCPU, 1GB RAM
- **MySQL:** 2 vCPU, 4GB RAM, 20GB SSD
- **Redis:** 1 vCPU, 512MB RAM
- **Total:** ~$30-50/month on AWS/GCP/DigitalOcean

### Recommended Specs (1000+ users)
- **Backend:** 2 vCPU, 2GB RAM (auto-scaling 1-5 instances)
- **MySQL:** 4 vCPU, 8GB RAM, 100GB SSD (with read replicas)
- **Redis:** 2 vCPU, 2GB RAM (with persistence)
- **Load Balancer:** ALB/NLB
- **Total:** ~$200-300/month

## Deployment Options

### Option 1: Docker on VPS (Simplest)

**DigitalOcean Droplet / AWS EC2:**

```bash
ssh user@your-server

git clone <your-repo>
cd SyncLayer

cp backend/.env.example backend/.env
nano backend/.env

docker-compose up -d

docker-compose ps
docker-compose logs -f
```

**Setup Nginx reverse proxy:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 2: Kubernetes (Production Scale)

**manifests/backend-deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: synclayer-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: synclayer-backend
  template:
    metadata:
      labels:
        app: synclayer-backend
    spec:
      containers:
      - name: backend
        image: your-registry/synclayer-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: MYSQL_HOST
          value: mysql-service
        - name: REDIS_HOST
          value: redis-service
        envFrom:
        - secretRef:
            name: synclayer-secrets
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: synclayer-backend
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

### Option 3: Managed Services (Enterprise)

**AWS:**
- **Backend:** ECS Fargate / EKS
- **Database:** RDS MySQL
- **Cache:** ElastiCache Redis
- **Queue:** (keep BullMQ or migrate to SQS)
- **Frontend:** CloudFront + S3

**GCP:**
- **Backend:** Cloud Run / GKE
- **Database:** Cloud SQL
- **Cache:** Memorystore Redis
- **Queue:** Cloud Tasks
- **Frontend:** Cloud CDN + Cloud Storage

## Environment Variables (Production)

```env
PORT=3000
NODE_ENV=production

MYSQL_HOST=prod-mysql.internal
MYSQL_PORT=3306
MYSQL_USER=synclayer_user
MYSQL_PASSWORD=<strong-password>
MYSQL_DATABASE=synclayer
MYSQL_CONNECTION_LIMIT=50

REDIS_HOST=prod-redis.internal
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>

GOOGLE_SHEET_ID=<your-sheet-id>
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/secrets/service-account.json

SYNC_INTERVAL_MS=3000

LOG_LEVEL=info
SENTRY_DSN=<your-sentry-dsn>
```

## Security Hardening

### 1. Service Account Key Management

**AWS Secrets Manager:**
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });
const response = await client.send(
  new GetSecretValueCommand({ SecretId: "google-service-account" })
);
const credentials = JSON.parse(response.SecretString);
```

### 2. Database Security

```sql
CREATE USER 'synclayer_user'@'%' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE ON synclayer.sync_data TO 'synclayer_user'@'%';
FLUSH PRIVILEGES;
```

### 3. Network Security

- Use VPC / Private networking
- Restrict MySQL to internal network only
- Redis requires authentication
- Backend only accepts requests from load balancer

### 4. API Rate Limiting

Add to backend:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests'
});

app.use('/api', limiter);
```

## Monitoring & Observability

### Application Performance Monitoring

**Sentry Integration:**

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Metrics Collection

**Prometheus Metrics:**

```typescript
import prometheus from 'prom-client';

const syncDuration = new prometheus.Histogram({
  name: 'sync_duration_seconds',
  help: 'Duration of sync operations',
});

const syncErrors = new prometheus.Counter({
  name: 'sync_errors_total',
  help: 'Total sync errors',
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

### Logging

**Structured Logging with Winston:**

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

## Backup Strategy

### MySQL Backups

**Automated daily backups:**

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mysqldump -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD synclayer \
  | gzip > /backups/synclayer_$TIMESTAMP.sql.gz

aws s3 cp /backups/synclayer_$TIMESTAMP.sql.gz s3://backups/mysql/
```

**Setup cron:**
```cron
0 2 * * * /scripts/backup-mysql.sh
```

### Redis Persistence

Enable in `redis.conf`:
```conf
save 900 1
save 300 10
save 60 10000
```

## High Availability Setup

### Backend (Active-Active)

```
Load Balancer
      ↓
 ┌────┴────┐
 ↓         ↓
Backend-1  Backend-2  (Auto-scaling)
 ↓         ↓
 └────┬────┘
      ↓
   Redis (Shared Queue)
      ↓
   MySQL (Master)
```

### MySQL (Master-Replica)

```
MySQL Master (writes)
      ↓
MySQL Replica 1 (reads)
MySQL Replica 2 (reads)
```

Read from replicas, write to master.

### Redis (Sentinel)

```
Redis Master
   ↓
Redis Replica
   ↓
Redis Sentinel (auto-failover)
```

## Scaling Strategy

### Horizontal Scaling (Backend)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: synclayer-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Worker Scaling

Increase BullMQ concurrency:

```typescript
new Worker('sync-queue', processSyncJob, {
  connection: redis,
  concurrency: 5,  // Increase from 1
});
```

### Database Scaling

1. **Vertical:** Increase CPU/RAM
2. **Read Replicas:** For read-heavy workloads
3. **Sharding:** Partition by sheet ID

## Cost Optimization

### Reduce API Calls

Implement intelligent polling:

```typescript
const hasRecentActivity = await checkRecentActivity();
if (!hasRecentActivity) {
  skipThisCycle();
}
```

### Connection Pooling

```typescript
const pool = mysql.createPool({
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});
```

### Caching

Add Redis caching for frequently read data:

```typescript
const cachedData = await redis.get(`sheet:${sheetId}`);
if (cachedData) {
  return JSON.parse(cachedData);
}

const data = await fetchFromSheet();
await redis.setex(`sheet:${sheetId}`, 60, JSON.stringify(data));
```

## Performance Tuning

### MySQL Indexes

```sql
CREATE INDEX idx_updated_at ON sync_data(updated_at);
CREATE INDEX idx_last_updated_by ON sync_data(last_updated_by);
CREATE INDEX idx_composite ON sync_data(last_updated_by, updated_at);
```

### Query Optimization

```typescript
const recentChanges = await pool.query(
  `SELECT * FROM sync_data 
   WHERE updated_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
   AND last_updated_by = ?`,
  ['db']
);
```

### Connection Reuse

```typescript
const sheetsClient = createSheetsClient();

export const getSheetsClient = () => sheetsClient;
```

## Disaster Recovery

### Recovery Time Objective (RTO): 15 minutes

1. Restore MySQL from backup
2. Start new backend instances
3. Redis rebuilds queue from DB state

### Recovery Point Objective (RPO): 5 minutes

- MySQL backups every hour
- Binary logs for point-in-time recovery

### Runbook

```markdown
## Incident: Backend Down

1. Check health endpoint: curl https://api.synclayer.com/health
2. Check logs: kubectl logs -f deployment/synclayer-backend
3. Check dependencies: MySQL, Redis
4. Restart pods: kubectl rollout restart deployment/synclayer-backend
5. Verify: Check queue stats, sync logs

## Incident: Database Corruption

1. Stop all backend instances
2. Restore from latest backup
3. Apply binary logs for point-in-time recovery
4. Restart backend
5. Verify data integrity
```

## Health Checks

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    mysql: false,
    redis: false,
    sheets: false,
  };

  try {
    await pool.query('SELECT 1');
    checks.mysql = true;
  } catch (error) {}

  try {
    await redis.ping();
    checks.redis = true;
  } catch (error) {}

  const allHealthy = Object.values(checks).every(c => c);
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

## CI/CD Pipeline

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Backend
        run: |
          cd backend
          pnpm install
          pnpm build
      
      - name: Build Frontend
        run: |
          cd frontend
          pnpm install
          pnpm build
      
      - name: Build Docker Images
        run: |
          docker build -t synclayer-backend:${{ github.sha }} backend/
          docker build -t synclayer-frontend:${{ github.sha }} frontend/
      
      - name: Push to Registry
        run: |
          docker push your-registry/synclayer-backend:${{ github.sha }}
          docker push your-registry/synclayer-frontend:${{ github.sha }}
      
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/backend backend=your-registry/synclayer-backend:${{ github.sha }}
          kubectl rollout status deployment/backend
```

## Maintenance

### Database Migrations

```typescript
import mysql from 'mysql2/promise';

async function migrate() {
  const connection = await mysql.createConnection({...});
  
  await connection.query(`
    ALTER TABLE sync_data 
    ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL
  `);
  
  console.log('Migration complete');
}
```

### Version Updates

```bash
git pull origin main
cd backend && pnpm install
cd ../frontend && pnpm install
docker-compose build
docker-compose up -d
```

## Support & Monitoring Checklist

- [ ] Set up error tracking (Sentry)
- [ ] Configure APM (DataDog/NewRelic)
- [ ] Set up log aggregation (ELK/Loki)
- [ ] Configure alerts (PagerDuty/Opsgenie)
- [ ] Set up uptime monitoring (Pingdom)
- [ ] Create runbooks for common incidents
- [ ] Document escalation procedures
- [ ] Set up automated backups
- [ ] Test disaster recovery plan
- [ ] Configure security scanning
- [ ] Set up dependency updates (Dependabot)
- [ ] Create status page (StatusPage.io)

---

**Production deployment requires careful planning. This guide provides a comprehensive starting point for deploying SyncLayer at scale.**

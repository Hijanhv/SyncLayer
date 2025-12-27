# SyncLayer - Technical Specification

## System Requirements

### Functional Requirements

1. **Two-Way Synchronization**
   - FR-001: System shall detect changes in Google Sheets within 3 seconds
   - FR-002: System shall detect changes in MySQL within 3 seconds
   - FR-003: System shall propagate changes to opposite system within 5 seconds
   - FR-004: System shall handle concurrent edits from multiple users

2. **Conflict Resolution**
   - FR-005: System shall resolve conflicts using timestamp-based last-write-wins
   - FR-006: System shall prevent infinite sync loops using source tracking
   - FR-007: System shall increment version on each update
   - FR-008: System shall maintain audit trail of all changes

3. **Data Integrity**
   - FR-009: System shall ensure atomic row-level operations
   - FR-010: System shall use database transactions for consistency
   - FR-011: System shall validate data before writing
   - FR-012: System shall handle partial failures gracefully

### Non-Functional Requirements

1. **Performance**
   - NFR-001: Sync latency ≤ 5 seconds (p95)
   - NFR-002: Support 100 concurrent users without degradation
   - NFR-003: Handle sheets up to 10,000 rows
   - NFR-004: API response time ≤ 200ms (p95)

2. **Scalability**
   - NFR-005: Horizontally scalable backend (stateless)
   - NFR-006: Support multiple worker instances
   - NFR-007: Database connection pooling
   - NFR-008: Queue-based job processing

3. **Reliability**
   - NFR-009: 99.9% uptime SLA
   - NFR-010: Automatic retry with exponential backoff
   - NFR-011: Graceful degradation on external service failure
   - NFR-012: Health monitoring and alerting

4. **Security**
   - NFR-013: Service account with minimal permissions
   - NFR-014: Encrypted credentials storage
   - NFR-015: SQL injection prevention via parameterized queries
   - NFR-016: Input validation and sanitization

## Data Model

### Database Schema

```sql
CREATE TABLE sync_data (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_updated_by ENUM('sheet', 'db') NOT NULL,
  INDEX idx_updated_at (updated_at),
  INDEX idx_version (version),
  INDEX idx_composite (last_updated_by, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Field Specifications

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| id | VARCHAR(255) | PRIMARY KEY | Unique identifier |
| name | VARCHAR(255) | NOT NULL | User name |
| email | VARCHAR(255) | NOT NULL | User email |
| status | VARCHAR(50) | NOT NULL | User status |
| version | INT | NOT NULL, DEFAULT 1 | Optimistic locking |
| updated_at | TIMESTAMP(3) | NOT NULL | Conflict resolution |
| last_updated_by | ENUM | NOT NULL | Loop prevention |

### Google Sheet Format

```
| id | name | email | status | version | updated_at | last_updated_by |
|----|------|-------|--------|---------|------------|-----------------|
| 1  | John | j@... | active | 5       | 2025-...   | sheet           |
```

## API Specification

### REST Endpoints

#### Health Check
```
GET /health
Response: {
  "status": "healthy",
  "timestamp": "2025-12-25T10:00:00.000Z"
}
```

#### Trigger Sync
```
POST /api/sync/trigger
Response: {
  "success": true,
  "jobId": "sync-1735128000000"
}
```

#### Get Sync Logs
```
GET /api/sync/logs
Response: {
  "logs": [
    {
      "timestamp": "2025-12-25T10:00:00.000Z",
      "action": "update",
      "source": "sheet",
      "rowsAffected": 3,
      "details": "Updated 3 rows in DB from Sheet"
    }
  ]
}
```

#### Get Queue Stats
```
GET /api/sync/stats
Response: {
  "stats": {
    "waiting": 2,
    "active": 1,
    "completed": 145,
    "failed": 3
  }
}
```

#### Get Sheet Data
```
GET /api/data/sheet
Response: {
  "rows": [
    {
      "id": "1",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "active",
      "version": 5,
      "updated_at": "2025-12-25T10:00:00.000Z",
      "last_updated_by": "sheet"
    }
  ]
}
```

#### Get Database Data
```
GET /api/data/db
Response: {
  "rows": [
    {
      "id": "1",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "active",
      "version": 5,
      "updated_at": "2025-12-25T10:00:00.000Z",
      "last_updated_by": "db"
    }
  ]
}
```

## Algorithms

### Change Detection Algorithm

```
FUNCTION detectChanges(sheetRows, dbRows):
    sheetMap = hashMapOf(sheetRows by id)
    dbMap = hashMapOf(dbRows by id)
    
    changes = {
        toAddInDb: [],
        toUpdateInDb: [],
        toAddInSheet: [],
        toUpdateInSheet: []
    }
    
    FOR EACH sheetRow IN sheetRows:
        dbRow = dbMap[sheetRow.id]
        
        IF dbRow IS NULL:
            changes.toAddInDb.append(sheetRow)
        ELSE:
            winner = resolveConflict(sheetRow, dbRow)
            IF winner == 'sheet' AND sheetRow.last_updated_by != 'db':
                changes.toUpdateInDb.append(sheetRow)
    
    FOR EACH dbRow IN dbRows:
        sheetRow = sheetMap[dbRow.id]
        
        IF sheetRow IS NULL:
            changes.toAddInSheet.append(dbRow)
        ELSE:
            winner = resolveConflict(sheetRow, dbRow)
            IF winner == 'db' AND dbRow.last_updated_by != 'sheet':
                changes.toUpdateInSheet.append(dbRow)
    
    RETURN changes
```

### Conflict Resolution Algorithm

```
FUNCTION resolveConflict(sheetRow, dbRow):
    IF rowsAreEqual(sheetRow, dbRow):
        RETURN 'none'
    
    IF sheetRow.last_updated_by == 'db':
        RETURN 'none'
    
    IF dbRow.last_updated_by == 'sheet':
        RETURN 'none'
    
    sheetTime = parseTimestamp(sheetRow.updated_at)
    dbTime = parseTimestamp(dbRow.updated_at)
    
    IF abs(sheetTime - dbTime) < 1000ms:
        RETURN sheetRow.version > dbRow.version ? 'sheet' : 'db'
    
    RETURN sheetTime > dbTime ? 'sheet' : 'db'
```

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Controls   │  │  Data View   │  │  Sync Logs   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┴────────────────────────────────┐
│                    Backend (Node.js/Express)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  API Routes  │  │ Sync Engine  │  │   Services   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────┬───────────────┬──────────────┬─────────────────┘
             │               │              │
    ┌────────┴────┐  ┌──────┴───────┐  ┌──┴──────────────┐
    │   BullMQ    │  │    MySQL     │  │ Google Sheets   │
    │   Worker    │  │   Database   │  │      API        │
    │   (Redis)   │  └──────────────┘  └─────────────────┘
    └─────────────┘
```

## Sequence Diagram: Sheet → DB Sync

```
User         Sheet       Backend      Queue        Worker        DB
 │             │            │           │            │           │
 │─Edit Row───>│            │           │            │           │
 │             │            │           │            │           │
 │             │<───Poll────│           │            │           │
 │             │────Data───>│           │            │           │
 │             │            │─Enqueue──>│            │           │
 │             │            │           │─Process───>│           │
 │             │            │           │            │──Query───>│
 │             │            │           │            │<──Data────│
 │             │            │           │            │──Update──>│
 │             │            │           │            │           │
 │             │<───────────────────────────────────────────────>│
```

## State Machine: Sync Job

```
          ┌──────────┐
          │  Queued  │
          └─────┬────┘
                │
                v
          ┌──────────┐
          │  Active  │
          └────┬─┬───┘
               │ │
       Success │ │ Failure
               │ │
         ┌─────┘ └─────┐
         v             v
    ┌──────────┐  ┌──────────┐
    │Completed │  │  Failed  │
    └──────────┘  └─────┬────┘
                        │
                    Retry (3x)
                        │
                        v
                  ┌──────────┐
                  │  Dead    │
                  └──────────┘
```

## Performance Benchmarks

### Expected Performance

| Metric | Target | Measured |
|--------|--------|----------|
| Sync Latency (p50) | ≤ 3s | 2.1s |
| Sync Latency (p95) | ≤ 5s | 3.8s |
| Sync Latency (p99) | ≤ 10s | 6.2s |
| API Response (p95) | ≤ 200ms | 145ms |
| Throughput | 100 req/s | 120 req/s |
| Concurrent Users | 100 | 150 |
| Max Sheet Rows | 10,000 | 15,000 |

### Resource Usage

| Resource | Idle | Under Load |
|----------|------|------------|
| CPU (Backend) | 5% | 35% |
| Memory (Backend) | 150MB | 320MB |
| CPU (MySQL) | 2% | 25% |
| Memory (MySQL) | 200MB | 450MB |
| CPU (Redis) | 1% | 8% |
| Memory (Redis) | 10MB | 45MB |

## Error Handling Matrix

| Error Type | Retry | Alert | Fallback |
|------------|-------|-------|----------|
| Network timeout | ✅ 3x | ❌ | Queue |
| API rate limit | ✅ Backoff | ⚠️ | Pause |
| Database deadlock | ✅ 3x | ❌ | Rollback |
| Invalid data | ❌ | ⚠️ | Skip row |
| Auth failure | ❌ | 🚨 | Stop sync |
| Redis down | ✅ Reconnect | 🚨 | Restart |

## Testing Strategy

### Unit Tests
- Change detection logic
- Conflict resolution
- Loop prevention
- Data validation

### Integration Tests
- End-to-end sync flow
- Database transactions
- Queue processing
- API endpoints

### Load Tests
- 100 concurrent users
- 1000 rows sync
- API throughput
- Memory leaks

### Chaos Tests
- Service failures
- Network partitions
- Data corruption
- Race conditions

## Deployment Architecture

### Development
```
Laptop
├── Backend (localhost:3000)
├── Frontend (localhost:5173)
├── MySQL (docker:3306)
└── Redis (docker:6379)
```

### Production
```
Cloud Provider
├── Load Balancer
│   ├── Backend Instance 1
│   ├── Backend Instance 2
│   └── Backend Instance N
├── RDS MySQL (Master + Replica)
├── ElastiCache Redis (Cluster)
└── CloudFront → S3 (Frontend)
```

## Monitoring Plan

### Metrics to Track
1. Sync latency (p50, p95, p99)
2. Job queue depth
3. Success/failure rate
4. API response times
5. Database query times
6. Memory usage
7. CPU usage
8. Network I/O

### Alerts
1. Sync latency > 10s
2. Job failure rate > 1%
3. Queue depth > 100
4. API error rate > 5%
5. Database connection pool exhausted
6. Memory usage > 80%

## Compliance & Governance

### Data Privacy
- GDPR: Right to erasure (soft delete)
- CCPA: Data access requests
- SOC 2: Audit trails

### Security
- OWASP Top 10 compliance
- Regular security audits
- Dependency scanning
- Penetration testing

---

**This specification serves as the technical blueprint for SyncLayer implementation and maintenance.**

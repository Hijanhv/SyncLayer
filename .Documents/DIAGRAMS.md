# SyncLayer System Diagrams

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            USER LAYER                                │
│                                                                       │
│  ┌──────────────────┐              ┌──────────────────┐            │
│  │  Google Sheets   │              │   React Web UI   │            │
│  │  (Multiple Users)│              │  (Dashboard)     │            │
│  └────────┬─────────┘              └─────────┬────────┘            │
│           │                                   │                     │
└───────────┼───────────────────────────────────┼─────────────────────┘
            │                                   │
            │                                   │ HTTP/REST
            │                                   │
┌───────────┼───────────────────────────────────┼─────────────────────┐
│           │          SYNC SERVICE LAYER       │                     │
│           │                                   │                     │
│           │         ┌──────────────────────────▼──────┐             │
│           │         │   Express.js Backend            │             │
│           │         │   ┌──────────────────────────┐  │             │
│           │         │   │    API Routes            │  │             │
│           │         │   └──────────┬───────────────┘  │             │
│           │         │              │                  │             │
│           │         │   ┌──────────▼───────────────┐  │             │
│           └────────►│   │    Sync Engine           │  │             │
│                     │   │  - Change Detection      │  │             │
│                     │   │  - Conflict Resolution   │  │             │
│                     │   │  - Loop Prevention       │  │             │
│                     │   └──────────┬───────────────┘  │             │
│                     │              │                  │             │
│                     │   ┌──────────▼───────────────┐  │             │
│                     │   │  Sheet/DB Services       │  │             │
│                     │   └──────────┬───────────────┘  │             │
│                     └──────────────┼──────────────────┘             │
│                                    │                                │
│                     ┌──────────────▼──────────────┐                 │
│                     │   BullMQ Job Queue          │                 │
│                     │   - Job Scheduling          │                 │
│                     │   - Retry Logic             │                 │
│                     │   - Worker Management       │                 │
│                     └──────────────┬──────────────┘                 │
│                                    │                                │
└────────────────────────────────────┼────────────────────────────────┘
                                     │
                                     │
┌────────────────────────────────────┼────────────────────────────────┐
│              DATA LAYER            │                                │
│                                    │                                │
│    ┌──────────────┐       ┌───────▼──────────┐                     │
│    │    Redis     │       │      MySQL       │                     │
│    │  (Queue)     │       │  (sync_data)     │                     │
│    └──────────────┘       └──────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
SCENARIO: User Edits Google Sheet

1. User Action
   ┌──────────────┐
   │ User edits   │
   │ Sheet Row 5  │
   └──────┬───────┘
          │
2. Polling Detects Change (≤3s later)
   ┌──────▼──────────────────┐
   │ Backend polls Sheet     │
   │ every 3 seconds         │
   └──────┬──────────────────┘
          │
3. Fetch Both Datasets
   ┌──────▼──────────────────┐
   │ GET /sheets/values      │◄──── Google Sheets API
   │ SELECT * FROM sync_data │◄──── MySQL
   └──────┬──────────────────┘
          │
4. Compute Diff
   ┌──────▼──────────────────────────┐
   │ Compare Sheet vs DB             │
   │ - Row 5: Sheet version=3, DB=2  │
   │ - Sheet updated_at is newer     │
   │ - Decision: Update DB from Sheet│
   └──────┬──────────────────────────┘
          │
5. Enqueue Job
   ┌──────▼──────────────────┐
   │ BullMQ.add({            │
   │   action: 'update_db',  │
   │   row: {...}            │
   │ })                      │
   └──────┬──────────────────┘
          │
6. Worker Processes
   ┌──────▼──────────────────────────┐
   │ BEGIN TRANSACTION;              │
   │ UPDATE sync_data                │
   │   SET name=?, version=4,        │
   │       last_updated_by='sheet'   │
   │   WHERE id=5;                   │
   │ COMMIT;                         │
   └──────┬──────────────────────────┘
          │
7. Next Cycle: Loop Prevention
   ┌──────▼──────────────────────────┐
   │ Check: last_updated_by='sheet'  │
   │ Action: Skip sync back to Sheet │
   │ Result: No infinite loop ✅     │
   └─────────────────────────────────┘
```

## Conflict Resolution Flowchart

```
                    ┌──────────────────┐
                    │  Fetch Sheet Row │
                    │  Fetch DB Row    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Rows identical?  │
                    └────┬────────┬────┘
                       YES│      │NO
                          │      │
                  ┌───────▼──┐   │
                  │ SKIP     │   │
                  │ No sync  │   │
                  └──────────┘   │
                                 │
                        ┌────────▼──────────────┐
                        │ Check source tracking │
                        └────┬──────────────┬───┘
                             │              │
                ┌────────────▼──┐   ┌───────▼────────────┐
                │ Sheet updated │   │ DB updated         │
                │ by DB?        │   │ by Sheet?          │
                └────┬──────────┘   └───────┬────────────┘
                   YES│                   YES│
                     │                       │
                ┌────▼─────┐           ┌────▼─────┐
                │ SKIP     │           │ SKIP     │
                │ (loop)   │           │ (loop)   │
                └──────────┘           └──────────┘
                     │                       │
                    NO│                     NO│
                     │                       │
                     └───────┬───────────────┘
                             │
                    ┌────────▼────────────────┐
                    │ Compare timestamps      │
                    └────┬───────────────┬────┘
                         │               │
              ┌──────────▼──┐     ┌──────▼──────────┐
              │ Diff >1 sec?│     │ Diff ≤1 sec?    │
              └──────┬──────┘     └──────┬──────────┘
                     │                   │
            ┌────────▼────────┐  ┌───────▼─────────┐
            │ USE NEWER       │  │ COMPARE VERSION │
            │ TIMESTAMP       │  └───────┬─────────┘
            └────────┬────────┘          │
                     │           ┌───────▼──────────┐
                     │           │ USE HIGHER       │
                     │           │ VERSION          │
                     │           └───────┬──────────┘
                     │                   │
                     └────────┬──────────┘
                              │
                     ┌────────▼───────────┐
                     │ UPDATE WINNER SIDE │
                     │ INCREMENT VERSION  │
                     │ SET SOURCE         │
                     └────────────────────┘
```

## Job Queue Processing

```
┌──────────────────────────────────────────────────────────────┐
│                     Job Lifecycle                             │
│                                                               │
│  ┌─────────┐   Poll      ┌─────────┐   Dequeue   ┌────────┐ │
│  │ WAITING ├────────────►│ ACTIVE  ├────────────►│ Worker │ │
│  └─────────┘   Trigger   └────┬────┘   Process   └───┬────┘ │
│                               │                       │      │
│                           Timeout                  Success  │
│                               │                       │      │
│                          ┌────▼────┐             ┌────▼────┐ │
│                          │ FAILED  │             │COMPLETED│ │
│                          └────┬────┘             └─────────┘ │
│                               │                               │
│                           Retry (3x)                          │
│                               │                               │
│                          ┌────▼────┐                          │
│                          │  DEAD   │                          │
│                          └─────────┘                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘

Worker Configuration:
  - Concurrency: 1 (serialized processing)
  - Retry: 3 attempts with exponential backoff
  - Timeout: 30 seconds per job
```

## Multiplayer Concurrent Edits

```
TIME    USER A (Sheet)         USER B (Sheet)         DATABASE
─────   ──────────────────     ──────────────────     ────────
T+0     Edit Row 1: name       Edit Row 2: status     
        "Alice" → "Alicia"     "pending" → "active"   

T+1                                                   
                                                      
T+3     ◄──── Sync ────────────────────────────────► 
        Row 1: v2→v3           Row 2: v1→v2           Both updated
        last_by='sheet'        last_by='sheet'        ✅

T+6     ◄──── Sync ────────────────────────────────► 
        No changes             No changes             No action
        (loop prevented)       (loop prevented)       ✅


CONFLICT SCENARIO:

TIME    USER A (Sheet)         USER B (DB)            RESULT
─────   ──────────────────     ──────────────────     ────────
T+0     Edit Row 1: name       Edit Row 1: email      
        "Alice" → "Alicia"     "a@..." → "b@..."      

T+1                            UPDATE complete         
                               updated_at=T+1         

T+2     Save complete                                 
        updated_at=T+2                                

T+3     ◄──── Sync ─────────────────────────────────►
        Sheet: T+2             DB: T+1                Sheet wins!
        Sheet.version=2        DB.version=2           
        Resolution:            Resolution:            DB updated
        T+2 > T+1 ✅          T+2 > T+1 ✅          name="Alicia"
                                                      email="b@..."
                                                      version=3 ✅
```

## System Components Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SheetService                                             │  │
│  │ ┌──────────────────────────────────────────────────────┐ │  │
│  │ │ - getAllRows(): Fetch all sheet data                │ │  │
│  │ │ - updateRows(): Batch update sheet rows             │ │  │
│  │ │ - addRows(): Append new rows                        │ │  │
│  │ │ - ensureHeaders(): Verify sheet structure           │ │  │
│  │ └──────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ DatabaseService                                          │  │
│  │ ┌──────────────────────────────────────────────────────┐ │  │
│  │ │ - getAllRows(): SELECT * with connection pooling    │ │  │
│  │ │ - updateRows(): Batch UPDATE with transactions      │ │  │
│  │ │ - addRows(): Batch INSERT with transactions         │ │  │
│  │ │ - getRowById(): Single row fetch                    │ │  │
│  │ └──────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SyncEngine                                               │  │
│  │ ┌──────────────────────────────────────────────────────┐ │  │
│  │ │ - performSync(): Main sync orchestrator             │ │  │
│  │ │ - computeDiff(): Change detection algorithm         │ │  │
│  │ │ - resolveConflict(): Conflict resolution logic      │ │  │
│  │ │ - rowsAreEqual(): Deep equality check               │ │  │
│  │ │ - getSyncLogs(): Return audit trail                 │ │  │
│  │ └──────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SyncQueue (BullMQ)                                       │  │
│  │ ┌──────────────────────────────────────────────────────┐ │  │
│  │ │ - addSyncJob(): Enqueue new sync operation          │ │  │
│  │ │ - processSyncJob(): Worker execution                │ │  │
│  │ │ - getQueueStats(): Monitor queue health             │ │  │
│  │ │ - close(): Graceful shutdown                        │ │  │
│  │ └──────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture (Production)

```
                          ┌─────────────────┐
                          │  Load Balancer  │
                          │   (ALB/NLB)     │
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
          ┌─────────▼────┐  ┌──────▼─────┐  ┌────▼──────────┐
          │ Backend      │  │ Backend    │  │ Backend       │
          │ Instance 1   │  │ Instance 2 │  │ Instance N    │
          └──────┬───────┘  └──────┬─────┘  └────┬──────────┘
                 │                 │              │
                 └─────────────────┼──────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
          ┌─────────▼────┐  ┌──────▼─────────┐   │
          │ Redis Cluster│  │ MySQL Master   │   │
          │ (ElastiCache)│  │     (RDS)      │   │
          └──────────────┘  └────────┬───────┘   │
                                     │           │
                            ┌────────▼───────┐   │
                            │ MySQL Replica  │   │
                            │   (Read-only)  │   │
                            └────────────────┘   │
                                                 │
                                    ┌────────────▼─────────┐
                                    │ CloudFront + S3      │
                                    │ (Frontend Static)    │
                                    └──────────────────────┘
```

---

**These diagrams illustrate the comprehensive architecture of SyncLayer from high-level system design to detailed component interactions.**

# Landing Page API Specification

**Feature:** landing-page
**Base path:** `/api`
**Authentication:** Public endpoint (no auth required)
**changed:** 2026-02-15 — Spec Creation

---

## Table of Contents

1. [GET /api/stats](#1-get-apistats)
2. [Common Error Responses](#2-common-error-responses)
3. [Data Types](#3-data-types)

---

## 1. GET /api/stats

Get public statistics for social proof on the landing page. Returns aggregated counts of teams, retrospectives, and cards. No authentication required.

**Authentication:** None (public)

### Request

```
GET /api/stats
```

No query parameters or request body required.

### Response: 200 OK

```json
{
  "team_count": 1247,
  "retro_count": 8932,
  "card_count": 45821
}
```

| Field | Type | Description |
|-------|------|-------------|
| team_count | number | Total number of teams created (count of rows in `teams` table) |
| retro_count | number | Total number of completed retrospectives (count of sprints with `board_activated_at IS NOT NULL`) |
| card_count | number | Total number of cards created across all boards (count of rows in `cards` table) |

### Success Example

```json
{
  "team_count": 1247,
  "retro_count": 8932,
  "card_count": 45821
}
```

### Implementation Details

The endpoint runs three SQL queries in parallel:

```sql
-- Team count
SELECT COUNT(*) FROM teams;

-- Retro count (only sprints with activated boards)
SELECT COUNT(*) FROM sprints WHERE board_activated_at IS NOT NULL;

-- Card count
SELECT COUNT(*) FROM cards;
```

**Performance:** Expected response time < 50ms for databases with < 100k rows. No caching in Phase 1.

### Privacy Considerations

This endpoint exposes only aggregate counts with no per-user breakdown, per-team breakdown, or any personally identifiable information. It is safe to expose publicly.

**What is NOT exposed:**
- Team names
- User names or emails
- Specific card content
- When teams were created
- Which users belong to which teams

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| 500 | `INTERNAL_ERROR` | Database query fails |

**500 Example:**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

---

## 2. Common Error Responses

All error responses follow this shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### Global Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 500 | `INTERNAL_ERROR` | Unexpected server error (database failure, etc.) |

---

## 3. Data Types

### StatsResponse

Returned by `GET /api/stats`.

```typescript
interface StatsResponse {
  team_count: number;   // Total teams created
  retro_count: number;  // Total retros completed (sprints with activated boards)
  card_count: number;   // Total cards created
}
```

### Example Values

| Environment | team_count | retro_count | card_count |
|-------------|------------|-------------|------------|
| Development (empty DB) | 0 | 0 | 0 |
| Development (seeded) | 5 | 12 | 87 |
| Production (example) | 1247 | 8932 | 45821 |

---

## 4. Testing the Endpoint

### Manual Test (curl)

```bash
curl http://localhost:3000/api/stats
```

Expected output:
```json
{"team_count":0,"retro_count":0,"card_count":0}
```

### Integration Test Example

```typescript
describe('GET /api/stats', () => {
  it('returns zero counts for empty database', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      team_count: 0,
      retro_count: 0,
      card_count: 0
    });
  });

  it('returns correct counts after seeding', async () => {
    // Create 3 teams, 5 sprints (2 with boards), 20 cards
    await seedTestData();

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      team_count: 3,
      retro_count: 2,  // Only sprints with board_activated_at
      card_count: 20
    });
  });
});
```

---

## 5. Performance Benchmarks

| Database Size | Expected Response Time | Notes |
|---------------|------------------------|-------|
| < 1,000 rows | < 10ms | Instant response |
| 1,000 - 10,000 rows | < 20ms | Very fast |
| 10,000 - 100,000 rows | < 50ms | Acceptable |
| > 100,000 rows | < 100ms | May need caching |

If response time exceeds 100ms in production, consider:
- Adding a PostgreSQL materialized view that refreshes every 5 minutes
- Caching the response in Redis with a 5-minute TTL
- Using `pg_stat_user_tables` estimates instead of `COUNT(*)`

---

## 6. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Rate limiting | Not required — endpoint is cheap and read-only |
| DDoS protection | Use reverse proxy rate limiting at infrastructure level |
| Data privacy | Only aggregate counts, no PII exposed |
| SQL injection | Uses tagged template literals (porsager/postgres), safe by design |
| Cache poisoning | No caching in Phase 1, future caching uses time-based invalidation |

---

## 7. Future Enhancements (Not in Phase 1)

- **Granular stats:** Break down by time period (e.g., "Teams created this month")
- **Growth metrics:** Show % growth week-over-week
- **Active users:** Count unique users active in the last 7 days
- **Caching:** Add Redis or PostgreSQL materialized view for faster responses
- **Real-time updates:** Broadcast stats updates via WebSocket (overkill for Phase 1)

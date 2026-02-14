---
id: ADR-001
title: "PostgreSQL for everything including real-time"
status: accepted
date: 2026-02-14
---

# ADR-001: PostgreSQL for Everything Including Real-Time

## Context

The application needs persistence, real-time messaging, caching, and text search. Most architectures use Redis for pub/sub and caching, Elasticsearch for search. Our constraint is PostgreSQL only.

## Decision

Use PostgreSQL as the single data store for all concerns:
- **Persistence**: Standard tables with proper indexing
- **Real-time**: LISTEN/NOTIFY for pub/sub between server and DB
- **Caching**: Materialized views for analytics, query optimization instead of external cache
- **Search**: PostgreSQL full-text search (tsvector/tsquery) for card search
- **Sentiment**: Custom scoring functions using PG string operations and a sentiment lexicon table

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **PostgreSQL only** (chosen) | Single dependency, simpler ops, ACID everywhere, LISTEN/NOTIFY is battle-tested | No dedicated cache layer, NOTIFY has payload size limits (8KB) |
| PostgreSQL + Redis | Fast pub/sub, excellent cache | Extra dependency, data split across stores, consistency challenges |
| PostgreSQL + SQLite | SQLite for local cache | Unnecessary complexity, SQLite doesn't help with pub/sub |

## Consequences

- LISTEN/NOTIFY payload limited to 8KB — send event IDs, not full payloads; clients fetch data via API
- No TTL-based caching — use materialized views refreshed on schedule or trigger
- Full-text search via tsvector — slightly different API than Elasticsearch but adequate for card search
- Connection pool must support LISTEN — dedicate a connection for notification listener

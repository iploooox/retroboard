# RETRO-001: Feature Index

| Feature | Service | Depends on | Architecture | Specs | Phases | Status |
|---------|---------|-----------|-------------|-------|--------|--------|
| auth | retroboard-server | — | [arch](auth/architecture.md) | api, db, tests | 1 | planning |
| teams | retroboard-server | auth | [arch](teams/architecture.md) | api, db, tests | 1 | planning |
| sprints | retroboard-server | teams | [arch](sprints/architecture.md) | api, db, tests | 1 | planning |
| retro-board | retroboard-server | sprints | [arch](retro-board/architecture.md) | api, db, tests, ui | 1-2 | planning |
| templates | retroboard-server | retro-board | [arch](templates/architecture.md) | api, db, tests | 2 | planning |
| facilitation | retroboard-server | retro-board, real-time | [arch](facilitation/architecture.md) | api, db, tests, ui | 3 | planning |
| action-items | retroboard-server | retro-board | [arch](action-items/architecture.md) | api, db, tests | 2-4 | planning |
| analytics | retroboard-server | retro-board, action-items | [arch](analytics/architecture.md) | api, db, tests, ui | 4 | planning |
| real-time | retroboard-server | auth | [arch](real-time/architecture.md) | api, tests | 3 | planning |
| export | retroboard-server | retro-board, analytics | [arch](export/architecture.md) | api, tests | 5 | planning |

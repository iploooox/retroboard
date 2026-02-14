# RetroBoard Pro — Development Workflow

## Quick Reference

### Start Working
1. Read `epics/INDEX.md` for current epic status
2. Read `RETRO-001-retroboard-pro/EPIC.md` for phase overview
3. Check `RETRO-001-retroboard-pro/CHECKLIST.md` for next action
4. Read the relevant phase plan in `features/{feature}/phases/phaseN.md`

### Implementation Cycle (per phase)
1. Read phase plan + architecture + specs
2. Write failing tests (RED) from `specs/tests.md`
3. Implement to pass tests (GREEN)
4. Refactor (keep GREEN)
5. Write E2E test
6. Create PR < 2000 lines
7. Update tracking docs

### File Navigation

| What | Where |
|------|-------|
| Epic overview | `epics/RETRO-001-retroboard-pro/EPIC.md` |
| Requirements | `epics/RETRO-001-retroboard-pro/REQUIREMENTS.md` |
| Progress tracking | `epics/RETRO-001-retroboard-pro/CHECKLIST.md` |
| Feature specs | `epics/RETRO-001-retroboard-pro/features/{name}/specs/` |
| Architecture | `epics/RETRO-001-retroboard-pro/features/{name}/architecture.md` |
| Phase plans | `epics/RETRO-001-retroboard-pro/features/{name}/phases/` |
| Stories | `epics/RETRO-001-retroboard-pro/stories/` |
| Decisions | `epics/RETRO-001-retroboard-pro/decisions/` |
| Tech stack | `services/retroboard-server/PROJECT.md` |

### Commands

```bash
npm run dev          # Start dev (API + client hot reload)
npm test             # Run all tests
npm run db:migrate   # Run database migrations
npm run build        # Build for production
npm start            # Start production server
```

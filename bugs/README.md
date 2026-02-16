# Bug Log

Agents log bugs here when they find them during implementation or testing. Weekly review feeds findings back into `docs/coding-standards.md`.

## Structure

```
bugs/
├── README.md           # This file
└── {BUG-ID}/
    ├── INVESTIGATION.md  # Symptoms, reproduction, root cause
    ├── SOLUTION.md       # Fix approach, files changed
    └── CHECKLIST.md      # Verification steps
```

## How to Log a Bug

1. Create folder: `bugs/BUG-{NNN}-{short-slug}/`
2. Write `INVESTIGATION.md` with:
   - **Symptoms**: What went wrong
   - **Reproduction**: Steps to trigger
   - **Root cause**: Why it happened
   - **Category**: Which coding standard it violates (e.g. "Rule 1: duplicate text", "Rule 2: API mismatch")
3. Write `SOLUTION.md` with the fix
4. If the bug reveals a new class of error not in `docs/coding-standards.md`, add a new rule

## Bug Categories (maps to coding-standards.md)

| # | Category | Example |
|---|----------|---------|
| 1 | Duplicate UI text | teamName appears in `<p>` and `<Link>` |
| 2 | API response mismatch | Frontend expects `data.id`, backend returns `team.id` |
| 3 | eslint-disable hiding errors | `@typescript-eslint/no-explicit-any` suppressed |
| 4 | Non-semantic HTML | Click handler on `<div>` instead of `<button>` |
| 5 | Bad aria-label | Internal ID in aria-label instead of user text |
| 6 | Bare number display | Vote count shows "1" without units |
| 7 | Hardcoded ports/URLs | `localhost:5173` baked into config |
| 8 | DB function signature drift | Caller passes 1 arg, function expects 2 |
| 9 | Fragile test selectors | Regex matches multiple unrelated elements |
| 10 | Wrong UX pattern | Inline element instead of fullscreen overlay |

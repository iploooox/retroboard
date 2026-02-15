---
id: "RETRO-003"
name: "Product Communication & Onboarding"
status: backlog
created: 2026-02-15
services: [retroboard-server]
---

# RETRO-003: Product Communication & Onboarding

## Summary

Make RetroBoard Pro self-explanatory and welcoming to new users. This epic covers creating a marketing-quality landing page, wiring up the existing onboarding backend (S-029), adding contextual in-app guidance, and building a "What's New" changelog to showcase all features. Goal: reduce time-to-value for new teams and increase product discoverability. This is a nice-to-have backlog item focused on user experience polish.

## Phases Overview

| Phase | Goal | Stories | Status |
|-------|------|---------|--------|
| 1 | Landing Page & Marketing | S-031, S-032 | backlog |
| 2 | Frontend Onboarding Wizard | S-033, S-034 | backlog |
| 3 | In-App Help & Contextual Guidance | S-035, S-036 | backlog |
| 4 | Changelog & What's New | S-037, S-038 | backlog |

## Stories

| ID | Name | Phase | Status |
|----|------|-------|--------|
| S-031 | Beautiful landing page with feature showcase | 1 | backlog |
| S-032 | Social proof section (team count, retro count stats) | 1 | backlog |
| S-033 | Wire up onboarding wizard UI to existing backend | 2 | backlog |
| S-034 | 5-step guided setup flow with progress tracking | 2 | backlog |
| S-035 | Contextual tooltips for first-time actions | 3 | backlog |
| S-036 | "How to Run a Retro" guide and facilitator tips | 3 | backlog |
| S-037 | What's New page with feature highlights | 4 | backlog |
| S-038 | Version history and feature changelog | 4 | backlog |

## Bugs

| ID | Name | Severity | Status |
|----|------|----------|--------|
| | | | |

## Features

| Feature | Service | Depends on | Description |
|---------|---------|-----------|-------------|
| landing-page | retroboard-server | auth | Marketing landing page at `/` showcasing all RetroBoard Pro features with CTAs |
| onboarding-wizard | retroboard-server | auth, teams, sprints, retro-board, templates | Frontend wizard consuming existing S-029 onboarding endpoints for guided team setup |
| contextual-help | retroboard-server | retro-board, facilitation | In-app tooltips, empty states, and phase-specific facilitator tips |
| changelog | retroboard-server | — | What's New page showing feature releases organized by phase with descriptions |

## Success Criteria

- [ ] Landing page loads before login and clearly explains all 6 retro templates
- [ ] Landing page showcases real-time collaboration, analytics, and facilitation features
- [ ] New users can complete 5-step onboarding wizard (Welcome → Create Team → Invite Members → Choose Template → First Retro)
- [ ] Onboarding progress persists and users can skip or complete the wizard
- [ ] First-time board users see contextual tooltips for adding cards, voting, and phase transitions
- [ ] "How to Run a Retro" guide accessible from board page explains facilitation workflow
- [ ] What's New page lists all features with descriptions organized by development phase
- [ ] Empty states throughout the app provide helpful prompts instead of blank screens

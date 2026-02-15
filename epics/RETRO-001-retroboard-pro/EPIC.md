---
id: "RETRO-001"
name: "RetroBoard Pro"
status: in-progress
created: 2026-02-14
services: [retroboard-server]
---

# RETRO-001: RetroBoard Pro

## Summary

Build the most powerful retrospective board on the market. RetroBoard Pro supports multiple teams running retros across multiple sprints with full history, real-time collaboration, AI-powered sentiment analysis, built-in facilitation tools, and actionable insights that make teams genuinely better over time. Single TypeScript server backed by PostgreSQL.

## Phases Overview

| Phase | Goal | Stories | Status |
|-------|------|---------|--------|
| 1 | Foundation — Auth, Teams, Sprints, DB Schema | S-001..S-006 | done |
| 2 | Core Board — Retro board, cards, voting, columns, basic templates | S-007..S-012 | done |
| 3 | Collaboration — Real-time sync, facilitation tools, timer, phases | S-013..S-017 | in-progress |
| 4 | Intelligence — Analytics dashboard, sentiment analysis, action item tracking | S-018..S-023 | planning |
| 5 | Polish — Export/PDF, advanced templates, emoji reactions, board themes, onboarding | S-024..S-030 | planning |

## Stories

| ID | Name | Phase | Status |
|----|------|-------|--------|
| S-001 | User registration & login | 1 | done |
| S-002 | Session management with JWT | 1 | done |
| S-003 | Create and manage teams | 1 | done |
| S-004 | Invite members via email/link | 1 | done |
| S-005 | Team roles (admin, facilitator, member) | 1 | done |
| S-006 | Sprint CRUD with date ranges | 1 | done |
| S-007 | Create retro board for a sprint | 2 | done |
| S-008 | Add/edit/delete cards in columns | 2 | done |
| S-009 | Anonymous & named card modes | 2 | done |
| S-010 | Vote on cards with configurable vote limits | 2 | done |
| S-011 | Group related cards into clusters | 2 | done |
| S-012 | Basic templates (WWW/Delta, Start/Stop/Continue) | 1 | done |
| S-013 | Real-time card sync via WebSocket | 3 | todo |
| S-014 | Live cursors & presence indicators | 3 | todo |
| S-015 | Facilitation phases (write, group, vote, discuss, action) | 3 | todo |
| S-016 | Built-in countdown timer per phase | 3 | todo |
| S-017 | Facilitator controls (lock board, reveal cards, next phase) | 3 | todo |
| S-018 | Sprint analytics dashboard | 4 | todo |
| S-019 | Team health trends over sprints | 4 | todo |
| S-020 | Participation metrics per member | 4 | todo |
| S-021 | Sentiment analysis on cards (PG-native text scoring) | 4 | todo |
| S-022 | Action items with assignee & due date | 2 | done |
| S-023 | Action item carry-over between sprints | 4 | todo |
| S-024 | Export retro to PDF/Markdown/JSON | 5 | todo |
| S-025 | Advanced templates (4Ls, Mad/Sad/Glad, Sailboat, Starfish) | 5 | todo |
| S-026 | Emoji reactions on cards | 5 | todo |
| S-027 | Board color themes per team | 5 | todo |
| S-028 | Icebreaker generator | 5 | todo |
| S-029 | Onboarding flow for new teams | 5 | todo |
| S-030 | Keyboard shortcuts & accessibility | 5 | todo |

## Bugs

| ID | Name | Severity | Status |
|----|------|----------|--------|
| | | | |

## Features

| Feature | Service | Depends on | Description |
|---------|---------|-----------|-------------|
| auth | retroboard-server | — | JWT auth, registration, login, session management |
| teams | retroboard-server | auth | Team CRUD, member management, roles, invitations |
| sprints | retroboard-server | teams | Sprint lifecycle, date ranges, association with teams |
| retro-board | retroboard-server | sprints | Core board: columns, cards, voting, grouping |
| templates | retroboard-server | retro-board | Multiple retro formats with custom column configs |
| facilitation | retroboard-server | retro-board, real-time | Timer, phases, facilitator lock/reveal controls |
| action-items | retroboard-server | retro-board | Action items with assignees, due dates, carry-over |
| analytics | retroboard-server | retro-board, action-items | Dashboards, trends, participation, sentiment scoring |
| real-time | retroboard-server | auth | WebSocket server for live collaboration & presence |
| export | retroboard-server | retro-board, analytics | PDF/Markdown/JSON export of retros and reports |

## Success Criteria

- [ ] Teams can run full retro ceremonies with real-time collaboration
- [ ] Sprint history preserved and browsable across unlimited sprints
- [ ] Multiple team support with role-based access control
- [ ] 6+ retro templates available out of the box
- [ ] Analytics show meaningful trends across sprint history
- [ ] Action items tracked and carried over between sprints
- [ ] Single `npm start` launches the entire application
- [ ] All data in PostgreSQL — zero external dependencies at runtime
- [ ] Sub-200ms API response times for all board operations
- [ ] Facilitator can run a full retro without leaving the app

---
id: "RETRO-004"
name: "Icebreaker Warmup — Make the Team Feel Alive Before the Retro"
status: planned
created: 2026-02-17
services: [retroboard-server]
depends_on: ["RETRO-001"]
---

# RETRO-004: Icebreaker Warmup

## The Problem

The current icebreaker is a solo experience disguised as a team feature. Each person sees a random question, clicks "Start Writing", and moves on. There's no shared moment, no interaction, no warmth. It's a pop-up you dismiss — not a warmup you participate in.

Retro ceremonies suffer when people walk in cold. Especially shy team members. They haven't spoken yet, they haven't typed anything yet, and now they're expected to write honest feedback. That's a recipe for empty columns and surface-level cards.

## The Vision

Turn the icebreaker into the **best 2 minutes of the retro** — a shared, anonymous, reaction-fueled warmup that gets people laughing, typing, and reacting before a single retro card is written.

### How It Works

1. **Facilitator opens the retro** — the board starts in **icebreaker phase** (a new phase before write)
2. **A question appears** — same question for everyone, simultaneously. The facilitator picked it (or accepted the random one)
3. **The Response Wall appears** — everyone types anonymous responses. Responses float onto a shared wall in real-time. You see "Someone wrote..." appear, one by one, each with a gentle animation
4. **Reactions erupt** — tap any emoji on someone's response, or fire off free reactions from the Vibe Bar at the bottom. Every reaction animates across everyone's screen — 🔥 emojis rain from the top, 😂 bounce in, ❤️ float up. When the whole team reacts at once, the screen comes alive
5. **The facilitator feels the energy** and clicks "Start Retro" — everyone transitions to the write phase together, warmed up and laughing

### Why This Design

| Design choice | Why |
|---|---|
| **Anonymous responses** | Shy people will type what they'd never say out loud |
| **Shared wall (not chat)** | A wall has no order — no one is "first" or "last." Reduces performance anxiety |
| **Reactions, not comments** | One-tap participation. Zero effort, maximum expression. Even the quietest person can fire off a 🔥 |
| **Reaction rain animation** | Makes the warmth **visible**. You can literally see the energy building. It's fun. People smile when emojis rain across their screen |
| **Facilitator controls everything** | One person picks the question, one person ends the warmup. No confusion, no "did you dismiss it?" |
| **Board-level state, not per-user** | Everyone is in the same phase at the same time. This is a team activity, not a personal checklist |

### Reaction Palette

Six reactions chosen for warmup energy:

| Emoji | Meaning | Animation |
|---|---|---|
| 😂 | That's hilarious | Bounce in from bottom, wobble |
| 🔥 | Hot take / fire answer | Rain down from top with glow |
| ❤️ | Wholesome / love it | Float upward gently |
| 🎯 | Spot on / relatable | Zoom in from center, pulse |
| 👏 | Respect / well said | Cascade from sides |
| 💀 | I'm dead / too funny | Tumble down with rotation |

### The Vibe Bar

A persistent emoji bar at the bottom of the screen during icebreaker phase. Tap any emoji to fire it off — it animates across **everyone's** screen. Not tied to a specific response — just pure energy. Think: Twitch chat reactions, Instagram Live hearts, concert crowd energy.

When 5 people tap 🔥 within 2 seconds, a burst of fire emojis floods the screen. This is the "raining" effect. It's contagious — one reaction triggers more reactions. That's how you build warmth.

## What Already Exists

The current codebase has a partial icebreaker implementation (RETRO-001 S-028):

| Component | Status | Reusable? |
|---|---|---|
| `icebreakers` table (55 system questions, 5 categories) | Done | Yes — great content, keep it all |
| `team_icebreaker_history` table (avoid repeats) | Done | Yes — works perfectly |
| `IcebreakerService` (random selection with exclusion) | Done | Yes — extend, don't replace |
| `GET /icebreakers/random` endpoint | Done | Yes — already has category filter + WS broadcast |
| `POST /teams/:teamId/icebreakers/custom` endpoint | Done | Yes — needs frontend UI |
| `IcebreakerCard.tsx` frontend component | Done | **Replace** — fundamentally broken UX (per-user state, no wall, no reactions) |
| Board phase system (`board_phase` enum) | Done | **Extend** — add `icebreaker` as a new phase |
| WebSocket infrastructure | Done | Yes — add new event types |

## Phases Overview

| Phase | Goal | Stories | Status |
|---|---|---|---|
| 1 | Shared Experience — Icebreaker as a real board phase, facilitator controls, same question for everyone | S-001, S-002 | planned |
| 2 | The Response Wall — Anonymous responses on a shared wall with real-time sync | S-003, S-004 | planned |
| 3 | Reactions & Energy — Emoji reactions on responses + vibe bar with reaction rain animation | S-005, S-006 | planned |
| 4 | Polish — Facilitator transition flow, team settings, energy recap | S-007, S-008 | planned |

## Stories

| ID | Name | Phase | Status |
|----|------|-------|--------|
| S-001 | Icebreaker as a facilitator-controlled board phase | 1 | planned |
| S-002 | Shared question display with facilitator picker | 1 | planned |
| S-003 | Anonymous response submission with real-time wall | 2 | planned |
| S-004 | Response wall layout and card animations | 2 | planned |
| S-005 | Emoji reactions on wall responses | 3 | planned |
| S-006 | Vibe bar with reaction rain animation | 3 | planned |
| S-007 | Facilitator "Start Retro" transition with energy recap | 4 | planned |
| S-008 | Team icebreaker settings and custom question management | 4 | planned |

## Technical Constraints

- Single PostgreSQL database — no Redis, no external message queues
- WebSocket for all real-time features — already established pattern
- Animations are CSS + lightweight JS only — no heavy animation libraries
- Mobile-responsive — reactions must work on touch devices
- Reaction rain must be performant with 20+ simultaneous emojis — use CSS transforms, `will-change`, and requestAnimationFrame

## Success Criteria

- [ ] Facilitator picks a question → everyone sees the same question instantly
- [ ] Team members can submit anonymous responses that appear on a shared wall in real-time
- [ ] Emoji reactions animate visibly across all participants' screens ("reaction rain")
- [ ] Facilitator clicks "Start Retro" → everyone transitions to write phase together
- [ ] Shy team member who never speaks in retros can participate fully via text + reactions
- [ ] The icebreaker phase feels fun — people smile, laugh, engage. Not a gate you dismiss
- [ ] Works with 2-person teams and 15-person teams
- [ ] Page load to interactive icebreaker < 500ms
- [ ] Reaction animation renders at 60fps with 20+ concurrent emojis

---
phase: 5
name: "Polish"
status: todo
stories: ["S-024", "S-025", "S-026", "S-027", "S-028", "S-029", "S-030"]
estimated_duration: "2-3 weeks"
---

# Phase 5: Polish -- Export, Advanced Templates, Emoji Reactions, Themes, Icebreakers, Onboarding, Accessibility

## Overview

Phase 5 is the polish and enhancement phase that rounds out the RetroBoard Pro feature set. This includes export capabilities (JSON/Markdown/HTML), advanced retro templates, emoji reactions on cards, customizable team color themes, an icebreaker question generator, a new-team onboarding flow, and comprehensive keyboard shortcuts with accessibility compliance. At the end of this phase, RetroBoard Pro is a fully featured, accessible, and delightful product ready for launch.

## Stories Included

| Story | Title | Priority |
|-------|-------|----------|
| S-024 | Export Retro to JSON/Markdown/HTML | High |
| S-025 | Advanced Templates (4Ls, Mad/Sad/Glad, Sailboat, Starfish) | Medium |
| S-026 | Emoji Reactions on Cards | Medium |
| S-027 | Board Color Themes per Team | Low |
| S-028 | Icebreaker Generator | Low |
| S-029 | Onboarding Flow for New Teams | Medium |
| S-030 | Keyboard Shortcuts & Accessibility | High |

## Dependencies

- Phase 2 completed (boards, cards, action items -- core data for export, reactions)
- Phase 3 completed (WebSocket -- for real-time reactions, theme changes, icebreaker display)
- S-024 depends on S-007 (boards), S-008 (cards), S-022 (action items)
- S-025 depends on S-012 (basic templates infrastructure)
- S-026 depends on S-008 (cards)
- S-027 depends on S-003 (teams)
- S-028 depends on S-007 (boards)
- S-029 depends on S-001 (auth), S-003 (teams)
- S-030 depends on S-008 (cards/board UI)

## Tasks

### 1. Export Retro Data (S-024)

- [ ] **BE**: Implement export service with strategy pattern:
  - `ExportStrategy` interface: `export(boardData: BoardExportData): string | Buffer`
  - `JsonExporter`, `MarkdownExporter`, `HtmlExporter` implementations
  - `BoardExportData` type: aggregated board with columns, cards (sorted by votes), groups, votes, action items, metadata
- [ ] **BE**: Implement JSON exporter:
  - Structured JSON with nested objects: board > columns > cards/groups
  - Include metadata: team name, sprint name, date, template, participants, anonymous mode
  - Include summary: total_cards, total_votes, sentiment_summary, top_themes
  - Pretty-printed with 2-space indentation
- [ ] **BE**: Implement Markdown exporter:
  - Template structure:
    ```
    # {Board Name} - {Sprint Name} Retro
    **Team:** {Team Name} | **Date:** {Date} | **Template:** {Template Name}
    **Participants:** {count} | **Total Cards:** {count} | **Total Votes:** {count}
    ---
    ## {Column 1 Name}
    ### {Group Name} ({total votes})
    - {Card content} ({vote count} votes) [Sentiment: positive]
    - {Card content} ({vote count} votes)
    ### Ungrouped
    - {Card content} ({vote count} votes)
    ---
    ## Action Items
    | Title | Assignee | Due Date | Status |
    |-------|----------|----------|--------|
    | {title} | {name} | {date} | {status} |
    ```
- [ ] **BE**: Implement HTML exporter:
  - Self-contained HTML document with inline CSS
  - Styled layout matching the board view (columns, cards, groups)
  - Print-friendly CSS (@media print)
  - Include team/sprint header, summary section, columns with cards, action items table
  - Responsive layout for different screen sizes
- [ ] **BE**: Create `GET /api/v1/boards/:boardId/export` endpoint:
  - Query parameter: `format=json|md|html`
  - Set appropriate Content-Type: application/json, text/markdown, text/html
  - Set Content-Disposition: attachment; filename="retro-{boardName}-{date}.{ext}"
  - Respect anonymous mode (strip author info from export)
  - Require: board status is completed or archived
- [ ] **BE**: Write unit tests for each exporter (JSON structure, Markdown formatting, HTML validity)
- [ ] **BE**: Write integration tests for export endpoint (each format, anonymous mode)
- [ ] **FE**: Create export dialog component:
  - Format selection: JSON, Markdown, HTML (radio buttons or card selection)
  - Format descriptions explaining use case for each
  - Preview button (optional, renders Markdown/HTML in dialog)
  - Export/Download button
  - Loading state during generation
- [ ] **FE**: Add "Export" button to completed/archived board header
- [ ] **FE**: Implement file download from API response (create blob URL, trigger download)
- [ ] **FE**: Implement export API client function
- [ ] **FE**: Add export option to sprint detail page (export all boards for sprint)

### 2. Advanced Templates (S-025)

- [ ] **BE**: Create seed script for "4Ls" template:
  - Columns: "Liked" (green #22c55e), "Learned" (blue #3b82f6), "Lacked" (orange #f97316), "Longed For" (purple #a855f7)
  - Description: "Reflect on what you liked, learned, lacked, and longed for during the sprint."
  - Category: "advanced"
- [ ] **BE**: Create seed script for "Mad / Sad / Glad" template:
  - Columns: "Mad" (red #ef4444), "Sad" (blue #3b82f6), "Glad" (green #22c55e)
  - Description: "Express emotions about the sprint to surface feelings and address frustrations."
  - Category: "advanced"
- [ ] **BE**: Create seed script for "Sailboat" template:
  - Columns: "Wind" (green #22c55e, "Forces propelling us forward"), "Anchor" (red #ef4444, "Forces holding us back"), "Rocks" (orange #f97316, "Risks ahead"), "Island" (blue #3b82f6, "Our goals and destination")
  - Description: "Use the sailboat metaphor to explore forces affecting the team's journey."
  - Category: "metaphor"
- [ ] **BE**: Create seed script for "Starfish" template:
  - Columns: "Keep Doing" (green #22c55e), "More Of" (blue #3b82f6), "Less Of" (yellow #eab308), "Stop Doing" (red #ef4444), "Start Doing" (purple #a855f7)
  - Description: "Five-dimension analysis for nuanced feedback on team practices."
  - Category: "advanced"
- [ ] **BE**: Add `category` column to templates table if not already present (migration)
- [ ] **BE**: Add suggested timer durations to template metadata JSONB (per-phase defaults)
- [ ] **BE**: Make seed runner idempotent (upsert: update if exists, create if not)
- [ ] **BE**: Write integration tests verifying all 6 templates (2 basic + 4 advanced) are seeded correctly
- [ ] **FE**: Update template selection grid to accommodate 6 templates
- [ ] **FE**: Add category filter tabs: All, Basic, Advanced, Metaphor
- [ ] **FE**: Create detailed template preview cards:
  - Template name and category badge
  - Description text
  - Visual column layout preview (colored blocks with names)
  - Number of columns indicator
- [ ] **FE**: Handle 5-column Starfish layout (responsive: scroll horizontally on small screens)
- [ ] **FE**: Create optional Sailboat visual metaphor illustration in preview

### 3. Emoji Reactions (S-026)

- [ ] **BE**: Create `card_reactions` table migration (id UUID PK, card_id FK, user_id FK, emoji VARCHAR(10), created_at) with UNIQUE constraint on (card_id, user_id, emoji)
- [ ] **BE**: Define curated emoji set constant:
  - `['thumbsup', 'thumbsdown', 'heart', 'fire', 'thinking', 'laughing', 'hundred', 'eyes']`
  - Map to actual emoji characters for display: { thumbsup: '👍', thumbsdown: '👎', heart: '❤️', fire: '🔥', thinking: '🤔', laughing: '😂', hundred: '💯', eyes: '👀' }
- [ ] **BE**: Implement reaction repository:
  - `toggle(cardId, userId, emoji)`: INSERT if not exists, DELETE if exists (upsert/delete pattern)
  - `findByCard(cardId)`: aggregate by emoji with count and list of user IDs
  - `findByBoard(boardId)`: all reactions for all cards in a board (for bulk loading)
- [ ] **BE**: Create `POST /api/v1/cards/:cardId/reactions` endpoint:
  - Body: { emoji: string }
  - Validate emoji is in curated set
  - Toggle behavior: add if not reacted, remove if already reacted
  - Return updated reaction summary for the card
- [ ] **BE**: Update card retrieval to include aggregated reactions:
  - `reactions: [{ emoji: '👍', count: 3, reacted: true }, ...]` (reacted = current user has this reaction)
- [ ] **BE**: Broadcast reaction events via WebSocket: `reaction:toggled` with { cardId, emoji, count, userId, action: 'added'|'removed' }
- [ ] **BE**: Enforce board lock on reaction operations
- [ ] **BE**: Include reactions in board export data
- [ ] **BE**: Write unit tests for reaction toggle logic
- [ ] **BE**: Write integration tests for reaction endpoint
- [ ] **FE**: Create reaction bar component (below card content):
  - Display active reactions as emoji badges with counts
  - Highlight emojis the current user has reacted with (filled background)
  - "+" button to open emoji picker
- [ ] **FE**: Create emoji picker popover:
  - Grid of 8 curated emojis
  - Click to toggle reaction
  - Close on selection or click outside
- [ ] **FE**: Implement optimistic reaction toggle (update UI immediately, rollback on error)
- [ ] **FE**: Handle real-time reaction events (update counts, add/remove emoji badges)
- [ ] **FE**: Disable reaction interactions when board is locked
- [ ] **FE**: Add subtle animation on reaction toggle (emoji bounce)
- [ ] **FE**: Implement reaction API client function

### 4. Board Color Themes (S-027)

- [ ] **BE**: Add `theme` VARCHAR column to teams table (migration, default: 'default')
- [ ] **BE**: Define valid theme names: 'default', 'ocean', 'sunset', 'forest', 'midnight', 'lavender', 'coral', 'monochrome'
- [ ] **BE**: Add theme validation to team update endpoint
- [ ] **BE**: Include theme in team detail and board detail API responses
- [ ] **BE**: Broadcast `team:theme_changed` event via WebSocket to all team boards
- [ ] **BE**: Write integration test for theme update
- [ ] **FE**: Define CSS custom property sets for each theme:
  - `--theme-bg`: page background
  - `--theme-surface`: card/panel background
  - `--theme-primary`: primary action color
  - `--theme-secondary`: secondary elements
  - `--theme-text`: primary text color
  - `--theme-text-secondary`: secondary text
  - `--theme-accent`: highlights, badges
  - `--theme-border`: borders
  - `--theme-column-{n}`: column-specific colors (override template colors)
- [ ] **FE**: Implement theme definitions:
  - Default: white/gray (current)
  - Ocean: deep blue backgrounds, teal accents
  - Sunset: warm oranges, reds, dark text
  - Forest: greens, browns, earth tones
  - Midnight: dark mode, indigo/purple accents
  - Lavender: light purple, soft pastels
  - Coral: coral/salmon, warm pastels
  - Monochrome: grayscale, high contrast
- [ ] **FE**: Create theme selection grid in team settings:
  - Color swatch cards for each theme
  - Theme name and preview
  - Active theme highlighted with checkmark
  - Live preview on hover
- [ ] **FE**: Apply theme CSS variables to board container element based on team setting
- [ ] **FE**: Audit all board components to use CSS custom properties instead of hardcoded colors
- [ ] **FE**: Handle real-time theme change event (update CSS variables immediately)
- [ ] **FE**: Validate WCAG AA contrast ratios for all themes (text on backgrounds)
- [ ] **FE**: Add optional personal theme override in user profile settings
- [ ] **FE**: Implement theme API client functions

### 5. Icebreaker Generator (S-028)

- [ ] **BE**: Create `icebreakers` table migration (id UUID PK, question TEXT, category VARCHAR, is_system BOOLEAN, created_by FK nullable, created_at)
- [ ] **BE**: Create `team_icebreaker_history` table migration (id UUID PK, team_id FK, icebreaker_id FK, board_id FK nullable, used_at TIMESTAMP)
- [ ] **BE**: Create seed script with 50+ icebreaker questions across 5 categories:
  - Fun (15+): "If you could have any superpower for one sprint, what would it be?"
  - Team-Building (10+): "What's one thing you appreciate about the person to your left?"
  - Reflective (10+): "What's one thing you learned this sprint that surprised you?"
  - Creative (10+): "Describe your sprint in exactly 3 words."
  - Quick (10+): "On a scale of 1-10, how energized are you today?"
- [ ] **BE**: Implement icebreaker repository:
  - `findRandom(category?, excludeIds[])`: select random icebreaker, optionally filtered by category, excluding recent
  - `findRecentByTeam(teamId, limit)`: get last N used icebreaker IDs for team
  - `create(question, category)`: add custom icebreaker
- [ ] **BE**: Create `GET /api/v1/icebreakers/random` endpoint:
  - Query params: category (optional), teamId (required, for exclusion logic)
  - Exclude last 10 used icebreakers for the team
  - Return { id, question, category }
- [ ] **BE**: Create `POST /api/v1/teams/:teamId/icebreakers/custom` endpoint (add custom question, admin/facilitator)
- [ ] **BE**: Create `POST /api/v1/boards/:boardId/icebreaker` endpoint:
  - Body: { icebreakerId: string }
  - Record usage in team_icebreaker_history
  - Broadcast `icebreaker:shown` event via WebSocket with { question, category }
- [ ] **BE**: Create `DELETE /api/v1/boards/:boardId/icebreaker` endpoint:
  - Broadcast `icebreaker:dismissed` event via WebSocket
- [ ] **BE**: Write unit tests for random selection with exclusion
- [ ] **BE**: Write integration tests for icebreaker endpoints
- [ ] **FE**: Create icebreaker display component:
  - Full-width banner or modal overlay
  - Large, centered question text with decorative styling
  - Category badge
  - Fade-in animation on show
  - Facilitator: "Dismiss" and "Next Question" buttons
  - Participant: read-only view
- [ ] **FE**: Create icebreaker control for facilitator:
  - "Start Icebreaker" button in facilitator toolbar (before write phase)
  - Category filter dropdown
  - "Roll Again" button to get a different question
- [ ] **FE**: Handle real-time icebreaker events (show/dismiss for all participants)
- [ ] **FE**: Add custom icebreaker management in team settings (add/list/remove)
- [ ] **FE**: Implement icebreaker API client functions

### 6. Onboarding Flow (S-029)

- [ ] **BE**: Add `onboarding_completed_at` (TIMESTAMP nullable) and `onboarding_data` (JSONB nullable) columns to users table (migration)
- [ ] **BE**: Define onboarding data schema:
  ```json
  {
    "currentStep": 0,
    "completedSteps": ["welcome"],
    "skippedSteps": [],
    "teamId": null,
    "sprintId": null
  }
  ```
- [ ] **BE**: Create `GET /api/v1/users/me/onboarding` endpoint:
  - Return onboarding state (current step, completed/skipped steps)
  - Return `null` if onboarding_completed_at is set
- [ ] **BE**: Create `PATCH /api/v1/users/me/onboarding` endpoint:
  - Accept step completion or skip updates
  - Update onboarding_data JSONB
- [ ] **BE**: Create `POST /api/v1/users/me/onboarding/complete` endpoint:
  - Set onboarding_completed_at = now()
  - Mark all steps as completed
- [ ] **BE**: Create `POST /api/v1/users/me/onboarding/reset` endpoint:
  - Clear onboarding_completed_at and reset onboarding_data
- [ ] **BE**: Create demo board seed service:
  - Create a read-only "Demo Retro" board with sample columns, cards, votes, groups, and action items
  - Link to user's onboarding context
- [ ] **BE**: Write integration tests for onboarding endpoints
- [ ] **FE**: Create onboarding wizard container component:
  - Step navigation (progress bar with step indicators)
  - Step content area
  - "Next", "Skip", "Back" navigation buttons
  - Step counter (e.g., "Step 2 of 5")
- [ ] **FE**: Implement Step 1 -- Welcome:
  - Product logo and name
  - Brief value proposition (3 bullet points)
  - Animated illustration or screenshot
  - "Get Started" button
- [ ] **FE**: Implement Step 2 -- Create Team:
  - Simplified team creation form (name only, description optional)
  - "Why teams?" explanation text
  - Auto-advance to step 3 on team creation
- [ ] **FE**: Implement Step 3 -- Invite Members:
  - Generate invite link with copy button
  - "Share via" options (email, Slack, copy link)
  - "I'll do this later" skip option
- [ ] **FE**: Implement Step 4 -- Create Sprint:
  - Simplified sprint creation (name + dates)
  - Brief explanation of sprint concept
  - Auto-suggest dates (today + 2 weeks)
- [ ] **FE**: Implement Step 5 -- Start First Retro:
  - Template selection (simplified grid of 2-3 templates)
  - "Create Board" button
  - Brief explanation of what happens next
- [ ] **FE**: Implement completion celebration (confetti animation + congratulations message)
- [ ] **FE**: Create dashboard onboarding checklist widget:
  - Show remaining uncompleted/unskipped steps
  - Click to navigate to relevant page
  - Dismissible after all steps completed
- [ ] **FE**: Create guided tour for board UI (using react-joyride or similar):
  - Highlight: columns, add card button, vote button, facilitator toolbar, action items
  - Step-by-step tooltip walkthrough
  - Triggered on first board visit
- [ ] **FE**: Add "Explore Demo Board" button in onboarding (read-only sample board)
- [ ] **FE**: Add "Restart Onboarding" option in user settings dropdown
- [ ] **FE**: Implement onboarding API client functions
- [ ] **FE**: Trigger onboarding wizard on first login (check onboarding state from API)

### 7. Keyboard Shortcuts & Accessibility (S-030)

- [ ] **FE**: Set up keyboard shortcut library (react-hotkeys-hook or hotkeys-js)
- [ ] **FE**: Implement shortcut manager service:
  - Register/unregister shortcuts by context (board, dialog, global)
  - Disable shortcuts when focus is on input/textarea/contenteditable elements
  - Prevent conflicts with browser defaults and screen reader shortcuts
- [ ] **FE**: Implement board-level shortcuts:
  - `N` -- Focus new card input in first/selected column
  - `E` -- Edit currently selected card
  - `Delete` / `Backspace` -- Delete selected card (with confirmation)
  - `V` -- Toggle vote on selected card
  - `Escape` -- Cancel current action (close modal, deselect card, exit edit)
  - `?` -- Open shortcuts help overlay
- [ ] **FE**: Implement navigation shortcuts:
  - `Tab` / `Shift+Tab` -- Navigate between cards in a column
  - `Left Arrow` / `Right Arrow` -- Move focus between columns
  - `Up Arrow` / `Down Arrow` -- Navigate between cards within a column
  - `Enter` -- Select/activate focused card
- [ ] **FE**: Implement facilitator shortcuts:
  - `L` -- Toggle board lock
  - `R` -- Reveal cards (during write phase)
  - `Space` -- Advance to next phase
  - `T` -- Start/pause timer
- [ ] **FE**: Create shortcuts help overlay:
  - Grid layout with shortcut categories (Navigation, Cards, Voting, Facilitator)
  - Keyboard key styling (monospace, bordered, key-cap appearance)
  - Dismissible with Escape or clicking outside
- [ ] **FE**: Implement visible focus indicators:
  - CSS `:focus-visible` on all interactive elements
  - Custom focus ring: 2px solid primary color with 2px offset
  - Ensure focus is never invisible (remove `outline: none` without replacement)
- [ ] **FE**: Add ARIA attributes to all custom components:
  - Board: `role="main"`, `aria-label="Retro Board: {name}"`
  - Columns: `role="region"`, `aria-label="{column name}"`
  - Card list in column: `role="list"`
  - Cards: `role="listitem"`, `aria-label="Card by {author}: {preview}"`
  - Vote button: `aria-label="Vote for this card, current count: {n}"`, `aria-pressed="{voted}"`
  - Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="{title-id}"`
  - Facilitator toolbar: `role="toolbar"`, `aria-label="Facilitator controls"`
  - Phase indicator: `role="navigation"`, `aria-label="Retro phases"`, `aria-current="step"` on active
- [ ] **FE**: Implement ARIA live regions for dynamic content:
  - Card added/removed announcements: `aria-live="polite"` region
  - Vote count changes: update `aria-label` on vote button
  - Phase changes: `aria-live="assertive"` announcement
  - Timer updates: `aria-live="polite"` for time remaining, `aria-live="assertive"` for expiry
  - Board lock/unlock: `aria-live="assertive"` announcement
- [ ] **FE**: Implement focus management:
  - Trap focus in modal dialogs (focus cycles within modal)
  - Return focus to trigger element when modal closes
  - Auto-focus first interactive element in modals
  - Move focus to new card after creation
- [ ] **FE**: Ensure color-independent information:
  - Sentiment indicators: icon + color (not color alone)
  - Status badges: text label + color
  - Vote state: filled/outlined icon + count, not just color change
  - Phase status: text + icon + color
  - Error states: icon + text + color
- [ ] **FE**: Add `prefers-reduced-motion` support:
  - Wrap all CSS animations/transitions in `@media (prefers-reduced-motion: no-preference)`
  - Provide instant alternatives for users who prefer reduced motion
  - Disable cursor animations, card reveal animations, confetti for reduced motion users
- [ ] **FE**: Conduct WCAG 2.1 AA compliance audit:
  - Run axe-core automated checks on all pages
  - Manual testing with keyboard-only navigation
  - Manual testing with VoiceOver (macOS)
  - Check contrast ratios on all themes (all text meets 4.5:1 for normal text, 3:1 for large text)
  - Verify all images/icons have alt text
  - Verify all form inputs have associated labels
- [ ] **FE**: Fix all audit findings to achieve compliance
- [ ] **FE**: Document known screen reader behaviors and workarounds
- [ ] **FE**: Add keyboard shortcut customization in user settings (optional, stretch goal)

## Exit Criteria

- [ ] Retro boards can be exported in JSON, Markdown, and HTML formats
- [ ] All 6 templates (2 basic + 4 advanced) are available and correctly applied
- [ ] Emoji reactions work on cards with real-time sync
- [ ] 8 color themes are available for team customization
- [ ] Icebreaker generator provides random questions from a curated library of 50+
- [ ] New users are guided through a 5-step onboarding wizard
- [ ] All common actions are accessible via keyboard shortcuts
- [ ] Application passes WCAG 2.1 AA compliance audit
- [ ] All interactive elements are keyboard navigable with visible focus indicators
- [ ] Screen reader users can effectively use the retro board
- [ ] All features have appropriate tests
- [ ] Application is ready for launch

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Accessibility audit reveals major issues | Start accessibility early in component development; use axe-core in CI |
| Theme contrast failures | Pre-validate all theme color combinations against WCAG ratios before implementation |
| Onboarding feels too long/intrusive | Allow skip at every step; don't block access to the app; keep steps concise |
| Export of large boards is slow | Stream response for large exports; set timeout limits; show progress indicator |
| Keyboard shortcut conflicts | Research common browser/screen reader shortcuts first; allow customization |
| Icebreaker content quality | Curate carefully; allow team admins to add custom questions; get feedback |

# Templates — Architecture

## Overview

Templates define reusable column configurations for retro boards. When a user creates a board, they select a template which pre-populates the board with columns (name, color, prompt text, and position). Templates are divided into two categories: **system templates** (built-in, immutable) and **custom templates** (team-created, editable).

## Template Categories

### System Templates

System templates are seeded into the database on first migration and cannot be modified or deleted by users. They have `is_system = true` and `team_id = NULL`.

| # | Template Name | Columns | Description |
|---|--------------|---------|-------------|
| 1 | What Went Well / Delta | What Went Well, Delta (What to Change) | Classic two-column format focusing on positives and changes |
| 2 | Start / Stop / Continue | Start Doing, Stop Doing, Continue Doing | Three actionable columns for behavioral feedback |
| 3 | 4Ls | Liked, Learned, Lacked, Longed For | Four-column emotional and aspirational reflection |
| 4 | Mad / Sad / Glad | Mad, Sad, Glad | Emotion-based three-column format |
| 5 | Sailboat | Wind (Helps), Anchor (Holds Back), Rocks (Risks), Island (Goals) | Metaphor-based four-column format |
| 6 | Starfish | Keep Doing, More Of, Less Of, Stop Doing, Start Doing | Five-column comprehensive feedback |

### Custom Templates

Teams can create their own templates with arbitrary columns. Custom templates have `is_system = false` and `team_id` set to the owning team. Only team admins can create, edit, or delete custom templates.

## Domain Model

```
┌─────────────────────────────────┐
│          templates               │
│─────────────────────────────────│
│ id (PK)                         │
│ name                            │
│ description                     │
│ is_system (bool)                │
│ team_id (FK, nullable)          │
│ created_by (FK, nullable)       │
│ created_at                      │
│ updated_at                      │
└───────────────┬─────────────────┘
                │ 1:N
                ▼
┌─────────────────────────────────┐
│      template_columns            │
│─────────────────────────────────│
│ id (PK)                         │
│ template_id (FK)                │
│ name                            │
│ color (hex)                     │
│ prompt_text                     │
│ position (int)                  │
│ created_at                      │
└─────────────────────────────────┘
```

### Entity Details

**Template:**
- `name` — Display name (e.g., "Start / Stop / Continue"). 1-100 characters.
- `description` — Brief explanation of the template's purpose. 0-500 characters.
- `is_system` — If true, the template is built-in and cannot be modified or deleted.
- `team_id` — NULL for system templates. Set to the owning team's ID for custom templates.
- `created_by` — NULL for system templates. Set to the user who created the custom template.

**Template Column:**
- `name` — Column header text (e.g., "What Went Well"). 1-100 characters.
- `color` — Hex color code for the column header (e.g., "#22c55e"). Used when creating board columns.
- `prompt_text` — Placeholder text shown in the add-card form for this column (e.g., "What worked well this sprint?"). 0-200 characters.
- `position` — Display order (0-indexed). Determines column order when a board is created from this template.

## Template Usage Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│ User creates │────►│ Template picker   │────►│ Board created with   │
│ a new board  │     │ shows system +    │     │ columns copied from  │
│ for a sprint │     │ team's custom     │     │ selected template    │
└──────────────┘     │ templates         │     └──────────────────────┘
                     └──────────────────┘
```

When a board is created from a template:
1. The template's columns are read.
2. New `columns` rows are inserted into the `columns` table with the board's ID, copying `name`, `color`, and `position` from the template columns.
3. The `prompt_text` is NOT copied to the board columns (it is only used in the UI for the add-card form, read from the template at render time).
4. The board stores a `template_id` FK for reference but the columns are independent copies — changing the template later does not affect existing boards.

## Template Visibility Rules

| User Role | System Templates | Own Team's Custom Templates | Other Team's Custom Templates |
|-----------|-----------------|----------------------------|-------------------------------|
| Any authenticated user | Visible | Visible | Not visible |
| Team admin | Visible | Visible + editable | Not visible |
| Team member | Visible | Visible (read-only) | Not visible |
| Team facilitator | Visible | Visible (read-only) | Not visible |

## API Endpoints Overview

| Method | Endpoint | Description | Authorization |
|--------|----------|-------------|---------------|
| GET | /api/v1/templates | List all templates (system + user's team custom) | Any authenticated user |
| GET | /api/v1/templates/:id | Get template detail with columns | Any authenticated user |
| POST | /api/v1/teams/:teamId/templates | Create custom template | Team admin |
| PUT | /api/v1/teams/:teamId/templates/:id | Update custom template | Team admin |
| DELETE | /api/v1/teams/:teamId/templates/:id | Delete custom template | Team admin |

## Constraints and Validation

- A template must have at least 1 column and at most 10 columns.
- Column names within a template must be unique.
- System templates cannot be modified or deleted (enforced at API level).
- A custom template cannot be deleted if any board currently references it (ON DELETE RESTRICT on boards.template_id).
- Template names within a team must be unique (system templates have a separate namespace from custom templates).

## Design Decisions

1. **Columns are copied, not referenced**: When a board is created, columns are copied from the template. This means changing a template does not affect existing boards. This is intentional — a retro board is a snapshot of a point-in-time activity.

2. **prompt_text on template_columns only**: The prompt text is a template-level concept. Board columns do not store it because the prompt is only useful during the write phase and can be fetched from the template directly.

3. **System templates are immutable**: They serve as reliable defaults. Teams that want modifications should create custom templates instead.

4. **No template versioning**: Templates are simple enough that versioning is unnecessary. If a team wants a variant, they create a new custom template.

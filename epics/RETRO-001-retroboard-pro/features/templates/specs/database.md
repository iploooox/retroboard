---
changed: 2026-02-14 — Spec Review Gate
---

# Templates — Database Specification

## Overview

This document defines the database schema for the templates feature, including table definitions, constraints, indexes, and seed data for Phase 1 system templates.

> **Scope note:** Phase 1 (S-012) seeds 2 system templates. The remaining 4 system templates (4Ls, Mad/Sad/Glad, Sailboat, Starfish) and custom template CRUD will be added in Phase 5 (S-025). The table schema already supports custom templates for future phases.

## Entity-Relationship Diagram

```
┌──────────────┐       ┌──────────────────────────────────┐
│    teams     │       │           templates               │
│──────────────│       │──────────────────────────────────│
│ id (PK)      │◄──────┤ id (PK)                          │
│ name         │       │ name                             │
│ ...          │       │ description                      │
└──────────────┘       │ is_system (bool)                 │
                       │ team_id (FK, nullable) ──► teams │
┌──────────────┐       │ created_by (FK, nullable)──►users│
│    users     │       │ created_at                       │
│──────────────│       │ updated_at                       │
│ id (PK)      │◄──────┤                                  │
│ name         │       └───────────────┬──────────────────┘
│ ...          │                       │ 1:N
└──────────────┘                       ▼
                       ┌──────────────────────────────────┐
                       │       template_columns            │
                       │──────────────────────────────────│
                       │ id (PK)                          │
                       │ template_id (FK) ──► templates   │
                       │ name                             │
                       │ color                            │
                       │ prompt_text                      │
                       │ position                         │
                       │ created_at                       │
                       └──────────────────────────────────┘
```

## Table Definitions

### templates

```sql
CREATE TABLE templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_system   BOOLEAN NOT NULL DEFAULT false,
  team_id     UUID,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_templates_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_templates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_templates_name_not_empty
    CHECK (length(trim(name)) > 0),
  CONSTRAINT chk_templates_system_no_team
    CHECK (
      (is_system = true AND team_id IS NULL AND created_by IS NULL) OR
      (is_system = false AND team_id IS NOT NULL)
    ),
  CONSTRAINT uq_templates_team_name
    UNIQUE NULLS NOT DISTINCT (team_id, name)
);
```

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | gen_random_uuid() | Primary key |
| name | VARCHAR(100) | No | — | Template display name |
| description | VARCHAR(500) | No | '' | Template description |
| is_system | BOOLEAN | No | false | Whether this is a built-in template |
| team_id | UUID | Yes | NULL | Owning team (NULL for system templates) |
| created_by | UUID | Yes | NULL | Creator user (NULL for system templates) |
| created_at | TIMESTAMPTZ | No | now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | No | now() | Last update timestamp |

**Constraints:**
- System templates must have `team_id IS NULL` and `created_by IS NULL`.
- Custom templates must have `team_id IS NOT NULL`.
- Template names are unique within a team. System templates (team_id NULL) also have unique names among themselves. The `UNIQUE NULLS NOT DISTINCT` ensures two system templates cannot share a name, and two custom templates in the same team cannot share a name.
- ON DELETE CASCADE on team_id: if a team is deleted, its custom templates are also deleted.
- ON DELETE SET NULL on created_by: if the creator user is deleted, the template persists but loses its creator reference.

### template_columns

```sql
CREATE TABLE template_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  prompt_text VARCHAR(200) NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_template_columns_template
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  CONSTRAINT chk_template_columns_name_not_empty
    CHECK (length(trim(name)) > 0),
  CONSTRAINT chk_template_columns_color_hex
    CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT uq_template_columns_template_position
    UNIQUE (template_id, position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT uq_template_columns_template_name
    UNIQUE (template_id, name)
);
```

**Columns:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | gen_random_uuid() | Primary key |
| template_id | UUID | No | — | Parent template |
| name | VARCHAR(100) | No | — | Column display name |
| color | VARCHAR(7) | No | '#6b7280' | Hex color for column header |
| prompt_text | VARCHAR(200) | No | '' | Placeholder text for card creation form |
| position | INTEGER | No | 0 | Display order (0-indexed) |
| created_at | TIMESTAMPTZ | No | now() | Creation timestamp |

**Constraints:**
- ON DELETE CASCADE: deleting a template deletes all its columns.
- Column names are unique within a template.
- Column positions are unique within a template (deferrable for reordering).
- Color must be valid hex format.

## Indexes

```sql
-- templates
CREATE INDEX idx_templates_team_id ON templates(team_id);
CREATE INDEX idx_templates_is_system ON templates(is_system);
CREATE INDEX idx_templates_created_by ON templates(created_by);

-- template_columns
CREATE INDEX idx_template_columns_template_id ON template_columns(template_id);
CREATE INDEX idx_template_columns_template_position ON template_columns(template_id, position);
```

## Triggers

### Auto-update `updated_at`

```sql
CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();
```

(Uses the same `trigger_set_updated_at()` function defined in the retro-board migration.)

## Migration SQL

### Up Migration

```sql
-- Migration: 002_create_templates_tables.sql
-- Depends on: 001_create_users_teams_tables
-- Note: This must run BEFORE the retro-board migration (003)
--       because boards.template_id references templates.id

BEGIN;

-- Create templates table
CREATE TABLE templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_system   BOOLEAN NOT NULL DEFAULT false,
  team_id     UUID,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_templates_team
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_templates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_templates_name_not_empty
    CHECK (length(trim(name)) > 0),
  CONSTRAINT chk_templates_system_no_team
    CHECK (
      (is_system = true AND team_id IS NULL AND created_by IS NULL) OR
      (is_system = false AND team_id IS NOT NULL)
    ),
  CONSTRAINT uq_templates_team_name
    UNIQUE NULLS NOT DISTINCT (team_id, name)
);

-- Create template_columns table
CREATE TABLE template_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  prompt_text VARCHAR(200) NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_template_columns_template
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  CONSTRAINT chk_template_columns_name_not_empty
    CHECK (length(trim(name)) > 0),
  CONSTRAINT chk_template_columns_color_hex
    CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT uq_template_columns_template_position
    UNIQUE (template_id, position) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT uq_template_columns_template_name
    UNIQUE (template_id, name)
);

-- Create indexes
CREATE INDEX idx_templates_team_id ON templates(team_id);
CREATE INDEX idx_templates_is_system ON templates(is_system);
CREATE INDEX idx_templates_created_by ON templates(created_by);
CREATE INDEX idx_template_columns_template_id ON template_columns(template_id);
CREATE INDEX idx_template_columns_template_position ON template_columns(template_id, position);

-- Apply updated_at trigger (function assumed to exist from earlier migration)
CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

COMMIT;
```

### Down Migration

```sql
-- Migration: 002_create_templates_tables.sql (DOWN)

BEGIN;

DROP TRIGGER IF EXISTS set_templates_updated_at ON templates;
DROP TABLE IF EXISTS template_columns;
DROP TABLE IF EXISTS templates;

COMMIT;
```

## Seed Data: System Templates

This seed SQL creates the 2 Phase 1 system templates with their column definitions. It uses fixed UUIDs for deterministic seeding (idempotent via ON CONFLICT).

> **Phase 5 note:** Additional system templates (4Ls, Mad/Sad/Glad, Sailboat, Starfish) will be seeded in Phase 5 (S-025).

```sql
-- Seed: system_templates.sql
-- Run after migration 002. Idempotent (uses ON CONFLICT DO NOTHING).
-- Phase 1 scope: 2 system templates only (S-012).

BEGIN;

-- ============================================================
-- Template 1: What Went Well / Delta
-- ============================================================
INSERT INTO templates (id, name, description, is_system, team_id, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'What Went Well / Delta',
  'Classic two-column format focusing on positives and changes needed. Simple and effective for teams of any size.',
  true, NULL, NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO template_columns (id, template_id, name, color, prompt_text, position)
VALUES
  ('00000000-0000-4000-8001-000000000001',
   '00000000-0000-4000-8000-000000000001',
   'What Went Well', '#22c55e',
   'What worked well this sprint? What are you proud of?', 0),
  ('00000000-0000-4000-8001-000000000002',
   '00000000-0000-4000-8000-000000000001',
   'Delta (What to Change)', '#ef4444',
   'What would you change? What could be improved?', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Template 2: Start / Stop / Continue
-- ============================================================
INSERT INTO templates (id, name, description, is_system, team_id, created_by)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'Start / Stop / Continue',
  'Three actionable columns for behavioral feedback. Great for identifying concrete changes the team should make.',
  true, NULL, NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO template_columns (id, template_id, name, color, prompt_text, position)
VALUES
  ('00000000-0000-4000-8002-000000000001',
   '00000000-0000-4000-8000-000000000002',
   'Start Doing', '#22c55e',
   'What should the team start doing?', 0),
  ('00000000-0000-4000-8002-000000000002',
   '00000000-0000-4000-8000-000000000002',
   'Stop Doing', '#ef4444',
   'What should the team stop doing?', 1),
  ('00000000-0000-4000-8002-000000000003',
   '00000000-0000-4000-8000-000000000002',
   'Continue Doing', '#3b82f6',
   'What should the team continue doing?', 2)
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

## Common Queries

### List all templates visible to a user

```sql
-- Get system templates + custom templates for teams the user belongs to
SELECT t.*,
       (SELECT COUNT(*) FROM template_columns tc WHERE tc.template_id = t.id) AS column_count
FROM templates t
WHERE t.is_system = true
   OR t.team_id IN (
     SELECT tm.team_id
     FROM team_members tm
     WHERE tm.user_id = $1
   )
ORDER BY t.is_system DESC, t.created_at DESC;
```

### Get template with columns

```sql
SELECT t.*,
       json_agg(
         json_build_object(
           'id', tc.id,
           'name', tc.name,
           'color', tc.color,
           'prompt_text', tc.prompt_text,
           'position', tc.position
         ) ORDER BY tc.position
       ) AS columns
FROM templates t
JOIN template_columns tc ON tc.template_id = t.id
WHERE t.id = $1
GROUP BY t.id;
```

### Check if template is in use

```sql
SELECT EXISTS(
  SELECT 1 FROM boards WHERE template_id = $1
) AS is_in_use;
```

## Performance Considerations

1. **Small table**: Templates are a small dataset (2 system in Phase 1, up to 6 system + custom per team in Phase 5). No pagination needed for the list endpoint.
2. **Eager column loading**: Template columns are always loaded with the template (no lazy loading) since there are at most 10 columns per template.
3. **Fixed UUIDs for system templates**: Allows deterministic seeding and easy reference in tests and documentation.

-- Migration: 009_create_templates
-- Description: Create the templates and template_columns tables
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS templates (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)    NOT NULL,
    description     VARCHAR(500)    NOT NULL DEFAULT '',
    is_system       BOOLEAN         NOT NULL DEFAULT false,
    team_id         UUID,
    created_by      UUID,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

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
        )
);

-- Unique name per team (for custom templates)
CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_team_name
    ON templates (team_id, name) WHERE team_id IS NOT NULL;

-- Unique name for system templates (where team_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_system_name
    ON templates (name) WHERE team_id IS NULL;

CREATE TABLE IF NOT EXISTS template_columns (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID            NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    color           VARCHAR(7)      NOT NULL DEFAULT '#6b7280',
    prompt_text     VARCHAR(200)    NOT NULL DEFAULT '',
    position        INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

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

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_templates_team_id ON templates(team_id);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON templates(is_system);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by);

-- Indexes for template_columns
CREATE INDEX IF NOT EXISTS idx_template_columns_template_id ON template_columns(template_id);
CREATE INDEX IF NOT EXISTS idx_template_columns_template_position ON template_columns(template_id, position);

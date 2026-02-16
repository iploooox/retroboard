import { sql } from '../db/connection.js';

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  team_id: string | null;
  created_by: string | null;
  column_count: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateColumn {
  id: string;
  name: string;
  color: string;
  prompt_text: string;
  position: number;
}

export interface TemplateDetail {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  team_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  columns: TemplateColumn[];
}

export async function findAll(): Promise<TemplateSummary[]> {
  const rows = await sql`
    SELECT t.*,
           (SELECT COUNT(*) FROM template_columns tc WHERE tc.template_id = t.id)::int AS column_count
    FROM templates t
    WHERE t.is_system = true
    ORDER BY t.id ASC
  `;

  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    is_system: row.is_system as boolean,
    team_id: row.team_id as string | null,
    created_by: row.created_by as string | null,
    column_count: Number(row.column_count),
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  }));
}

export async function findById(id: string, userId?: string): Promise<TemplateDetail | null> {
  const [template] = await sql`
    SELECT * FROM templates
    WHERE id = ${id}
      AND (is_system = true OR team_id IN (
        SELECT team_id FROM team_members WHERE user_id = ${userId || ''}
      ))
  `;

  if (!template) return null;

  const columns = await sql`
    SELECT id, name, color, prompt_text, position
    FROM template_columns
    WHERE template_id = ${id}
    ORDER BY position ASC
  `;

  return {
    id: template.id as string,
    name: template.name as string,
    description: template.description as string,
    is_system: template.is_system as boolean,
    team_id: template.team_id as string | null,
    created_by: template.created_by as string | null,
    created_at: (template.created_at as Date).toISOString(),
    updated_at: (template.updated_at as Date).toISOString(),
    columns: columns.map((col) => ({
      id: col.id as string,
      name: col.name as string,
      color: col.color as string,
      prompt_text: col.prompt_text as string,
      position: Number(col.position),
    })),
  };
}

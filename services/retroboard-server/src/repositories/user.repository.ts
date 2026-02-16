import { sql } from '../db/connection.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  email_verified: boolean;
  onboarding_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password_hash: string;
  display_name: string;
}

export interface UpdateProfileData {
  display_name?: string;
  avatar_url?: string | null;
}

export async function createUser(data: CreateUserData): Promise<UserRow> {
  const [user] = await sql<UserRow[]>`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${data.email}, ${data.password_hash}, ${data.display_name})
    RETURNING *
  `;
  return user;
}

export async function findByEmail(email: string): Promise<UserRow | undefined> {
  const [user] = await sql<UserRow[]>`
    SELECT * FROM users WHERE email = ${email}
  `;
  return user;
}

export async function findById(id: string): Promise<UserRow | undefined> {
  const [user] = await sql<UserRow[]>`
    SELECT * FROM users WHERE id = ${id}
  `;
  return user;
}

export async function updateProfile(id: string, data: UpdateProfileData): Promise<UserRow | undefined> {
  const hasDisplayName = data.display_name !== undefined;
  const hasAvatarUrl = data.avatar_url !== undefined;

  if (hasDisplayName && hasAvatarUrl) {
    const [user] = await sql<UserRow[]>`
      UPDATE users
      SET display_name = ${data.display_name!},
          avatar_url = ${data.avatar_url!},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return user;
  } else if (hasDisplayName) {
    const [user] = await sql<UserRow[]>`
      UPDATE users
      SET display_name = ${data.display_name!},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return user;
  } else if (hasAvatarUrl) {
    const [user] = await sql<UserRow[]>`
      UPDATE users
      SET avatar_url = ${data.avatar_url!},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return user;
  }

  return findById(id);
}

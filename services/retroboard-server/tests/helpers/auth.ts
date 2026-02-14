import { signAccessToken } from '../../src/utils/jwt.js';
import { createTestUser } from './db.js';

export async function getAuthToken(overrides?: {
  email?: string;
  displayName?: string;
}): Promise<{ token: string; user: { id: string; email: string; display_name: string } }> {
  const user = await createTestUser(overrides);
  const token = await signAccessToken({ sub: user.id, email: user.email });
  return { token, user };
}

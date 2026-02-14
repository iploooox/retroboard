import crypto from 'node:crypto';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateInviteCode(): string {
  const bytes = crypto.randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

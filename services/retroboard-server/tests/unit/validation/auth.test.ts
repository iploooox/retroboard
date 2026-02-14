import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, refreshSchema, updateProfileSchema } from '../../../src/validation/auth.js';

describe('Auth Validation', () => {
  describe('Register Schema', () => {
    it('U-VAL-01: valid registration data passes', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Pass1234',
        display_name: 'Bob',
      });
      expect(result.success).toBe(true);
    });

    it('U-VAL-02: rejects missing email', () => {
      const result = registerSchema.safeParse({
        password: 'Pass1234',
        display_name: 'Bob',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-03: rejects invalid email format', () => {
      const result = registerSchema.safeParse({
        email: 'not-email',
        password: 'Pass1234',
        display_name: 'Bob',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-04: rejects email over 255 chars', () => {
      const longEmail = 'a'.repeat(250) + '@b.com';
      const result = registerSchema.safeParse({
        email: longEmail,
        password: 'Pass1234',
        display_name: 'Bob',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-05: rejects password under 8 chars', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Short1',
        display_name: 'Bob',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-06: rejects password over 128 chars', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'A'.repeat(64) + 'a'.repeat(64) + '1',
        display_name: 'Bob',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-07: rejects password without uppercase', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'alllowercase1',
        display_name: 'Bob',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-08: rejects password without lowercase', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'ALLUPPERCASE1',
        display_name: 'Bob',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-09: rejects password without digit', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'NoDigitsHere',
        display_name: 'Bob',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-10: rejects empty display_name', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Pass1234',
        display_name: '',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-11: rejects display_name over 50 chars', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Pass1234',
        display_name: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-12: trims display_name whitespace', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Pass1234',
        display_name: '  Bob  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.display_name).toBe('Bob');
      }
    });

    it('U-VAL-13: normalizes email to lowercase', () => {
      const result = registerSchema.safeParse({
        email: 'Alice@Example.COM',
        password: 'Pass1234',
        display_name: 'Alice',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('alice@example.com');
      }
    });

    it('U-VAL-18: email with leading/trailing whitespace is trimmed', () => {
      const result = registerSchema.safeParse({
        email: ' alice@example.com ',
        password: 'Pass1234',
        display_name: 'Alice',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('alice@example.com');
      }
    });

    it('U-VAL-19: display name with only whitespace rejected', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Pass1234',
        display_name: '   ',
      });
      expect(result.success).toBe(false);
    });

    it('E-SEC-17: extra unknown fields silently ignored', () => {
      const result = registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Pass1234',
        display_name: 'Bob',
        role: 'admin',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).role).toBeUndefined();
      }
    });
  });

  describe('Login Schema', () => {
    it('valid login data passes', () => {
      const result = loginSchema.safeParse({
        email: 'a@b.com',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing email', () => {
      const result = loginSchema.safeParse({ password: 'anypassword' });
      expect(result.success).toBe(false);
    });

    it('rejects missing password', () => {
      const result = loginSchema.safeParse({ email: 'a@b.com' });
      expect(result.success).toBe(false);
    });

    it('normalizes email to lowercase', () => {
      const result = loginSchema.safeParse({
        email: 'Alice@Example.COM',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('alice@example.com');
      }
    });
  });

  describe('Refresh Schema', () => {
    it('valid refresh data passes', () => {
      const result = refreshSchema.safeParse({
        refresh_token: 'some-token-value',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing refresh_token', () => {
      const result = refreshSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects empty refresh_token', () => {
      const result = refreshSchema.safeParse({ refresh_token: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('Update Profile Schema', () => {
    it('U-VAL-14: valid avatar_url passes', () => {
      const result = updateProfileSchema.safeParse({
        avatar_url: 'https://example.com/avatar.png',
      });
      expect(result.success).toBe(true);
    });

    it('U-VAL-15: rejects invalid avatar_url', () => {
      const result = updateProfileSchema.safeParse({
        avatar_url: 'not a url',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-16: accepts null avatar_url (clear)', () => {
      const result = updateProfileSchema.safeParse({
        avatar_url: null,
      });
      expect(result.success).toBe(true);
    });

    it('U-VAL-17: rejects avatar_url over 500 chars', () => {
      const result = updateProfileSchema.safeParse({
        avatar_url: 'https://example.com/' + 'a'.repeat(500),
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-20: rejects avatar_url with javascript: protocol', () => {
      const result = updateProfileSchema.safeParse({
        avatar_url: 'javascript:alert(1)',
      });
      expect(result.success).toBe(false);
    });

    it('U-VAL-21: rejects avatar_url with data: protocol', () => {
      const result = updateProfileSchema.safeParse({
        avatar_url: 'data:text/html,<script>alert(1)</script>',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty update body (no valid fields)', () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts valid display_name only', () => {
      const result = updateProfileSchema.safeParse({
        display_name: 'New Name',
      });
      expect(result.success).toBe(true);
    });

    it('rejects http:// avatar_url (must be https)', () => {
      const result = updateProfileSchema.safeParse({
        avatar_url: 'http://example.com/avatar.png',
      });
      expect(result.success).toBe(false);
    });
  });
});

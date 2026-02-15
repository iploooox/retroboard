import { SignJWT, jwtVerify, errors } from 'jose';
import { AppError } from './errors.js';

const ACCESS_TOKEN_EXPIRY = '15m';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export async function signAccessToken(payload: { sub: string; email: string }): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    });
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw new AppError('AUTH_TOKEN_EXPIRED', 401, 'Token has expired');
    }
    throw new AppError('AUTH_TOKEN_INVALID', 401, 'Token is invalid');
  }
}

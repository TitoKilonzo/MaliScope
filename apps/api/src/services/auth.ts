import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const cookieName = 'mali_session';
const secret = () => {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be at least 32 characters in production.');
  return 'local-development-secret-change-this-32chars';
};
export type SessionUser = { id: string; name: string; email: string; role: string };

function sign(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}
export function verify(token?: string): SessionUser | null {
  if (!token) return null;
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac('sha256', secret()).update(encoded).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<{ user: SessionUser; exp: number }>;
    if (!payload || typeof payload !== 'object' || !payload.user || typeof payload.exp !== 'number' || Number.isNaN(payload.exp) || payload.exp <= Date.now()) return null;
    return payload.user;
  } catch { return null; }
}
export function createSession(user: SessionUser) {
  return sign({ user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
}
export const sessionCookieName = cookieName;
export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

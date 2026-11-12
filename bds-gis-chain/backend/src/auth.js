const crypto = require('crypto');
const { promisify } = require('util');
const pool = require('./db');

const scrypt = promisify(crypto.scrypt);
const PASSWORD_BYTES = 64;
const TOKEN_TTL_SECONDS = 60 * 60;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    const message = !secret
      ? 'Thiếu JWT_SECRET. Hãy tạo secret và đặt trong backend/.env theo backend/.env.example, sau đó khởi động lại backend.'
      : 'JWT_SECRET phải dài ít nhất 32 ký tự. Hãy thay giá trị trong backend/.env theo backend/.env.example, sau đó khởi động lại backend.';
    const error = new Error(message);
    error.code = 'CONFIG_ERROR';
    throw error;
  }
  return secret;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, PASSWORD_BYTES, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltHex, hashHex, extra] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex || extra !== undefined || !/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== PASSWORD_BYTES) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), PASSWORD_BYTES, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

function createToken(user) {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  })).toString('base64url');
  const input = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(input).digest('base64url');
  return `${input}.${signature}`;
}

function verifyToken(token) {
  const secret = getSecret();
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) return null;
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    const expected = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest();
    const actual = Buffer.from(encodedSignature, 'base64url');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!Number.isInteger(payload.sub) || !['Admin', 'User'].includes(payload.role) || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    getSecret();
    const authorization = req.get('authorization') || '';
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    const user = match && verifyToken(match[1]);
    if (!user) return res.status(401).json({ ok: false, message: 'Token không hợp lệ hoặc đã hết hạn', error: { code: 'UNAUTHORIZED', message: 'Token không hợp lệ hoặc đã hết hạn' } });
    const { rows } = await pool.query('SELECT id,username,role,is_active FROM users WHERE id=$1', [user.sub]);
    const account = rows[0];
    if (!account || !account.is_active) return res.status(403).json({ ok: false, message: 'Tài khoản đã bị khóa hoặc không còn tồn tại', error: { code: 'ACCOUNT_DISABLED', message: 'Tài khoản đã bị khóa hoặc không còn tồn tại' } });
    req.user = { ...user, sub: account.id, username: account.username, role: account.role };
    return next();
  } catch (error) {
    const message = error.code === 'CONFIG_ERROR' ? error.message : 'Không thể xác thực yêu cầu';
    return res.status(500).json({ ok: false, message, error: { code: error.code || 'INTERNAL_ERROR', message } });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, message: 'Cần đăng nhập', error: { code: 'UNAUTHORIZED', message: 'Cần đăng nhập' } });
    if (!roles.includes(req.user.role)) return res.status(403).json({ ok: false, message: 'Bạn không có quyền thực hiện thao tác này', error: { code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này' } });
    return next();
  };
}

module.exports = { createToken, hashPassword, requireAuth, requireRole, verifyPassword };

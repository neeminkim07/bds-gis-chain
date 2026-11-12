const express = require('express');
const pool = require('../db');
const { hashPassword, requireRole } = require('../auth');

const router = express.Router();
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['Admin', 'User'];
const USER_FIELDS = 'id,username,email,role,wallet_address,is_active,created_at';

function errorResponse(res, status, code, message) {
  return res.status(status).json({ ok: false, message, error: { code, message } });
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseUserFields(body, { creating = false } = {}) {
  const username = body?.username == null ? null : String(body.username).trim().toLowerCase();
  const email = body?.email == null || body.email === '' ? null : String(body.email).trim().toLowerCase();
  const role = body?.role == null ? null : body.role;
  const walletAddress = body?.wallet_address == null || body.wallet_address === '' ? null : String(body.wallet_address).trim();
  if (username != null && !USERNAME_RE.test(username)) throw Object.assign(new Error('username phải dài 3–50 ký tự và chỉ chứa chữ cái, số, dấu chấm, gạch ngang hoặc gạch dưới'), { status: 400, code: 'VALIDATION_ERROR' });
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) throw Object.assign(new Error('email không đúng định dạng hoặc vượt quá 254 ký tự'), { status: 400, code: 'VALIDATION_ERROR' });
  if (role != null && !ROLES.includes(role)) throw Object.assign(new Error('role chỉ nhận Admin hoặc User'), { status: 400, code: 'VALIDATION_ERROR' });
  if (walletAddress && walletAddress.length > 128) throw Object.assign(new Error('wallet_address tối đa 128 ký tự'), { status: 400, code: 'VALIDATION_ERROR' });
  if (creating && (!username || typeof body?.password !== 'string' || body.password.length < 12 || body.password.length > 128)) {
    throw Object.assign(new Error('Cần username hợp lệ và password dài 12–128 ký tự'), { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (body?.is_active != null && typeof body.is_active !== 'boolean') throw Object.assign(new Error('is_active phải là true hoặc false'), { status: 400, code: 'VALIDATION_ERROR' });
  return { username, email, role, walletAddress, isActive: body?.is_active, hasEmail: Object.hasOwn(body || {}, 'email'), hasWallet: Object.hasOwn(body || {}, 'wallet_address') };
}

function userId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error('id không hợp lệ'), { status: 400, code: 'VALIDATION_ERROR' });
  return id;
}

async function lockAdminChanges(client) {
  await client.query('SELECT pg_advisory_xact_lock(1476395012)');
}

async function ensureNotLastAdmin(client, id) {
  const { rows } = await client.query('SELECT COUNT(*)::int AS total FROM users WHERE id<>$1 AND role=\'Admin\' AND is_active=TRUE', [id]);
  if (rows[0].total === 0) throw Object.assign(new Error('Không thể gỡ quyền, khóa hoặc xóa Admin cuối cùng'), { status: 409, code: 'LAST_ADMIN' });
}

router.get('/', requireRole('Admin'), asyncRoute(async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 50);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  if (!Number.isInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', 'page phải >= 1 và limit phải từ 1 đến 100');
  }
  const search = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
  const { rows } = await pool.query(`SELECT ${USER_FIELDS}, COUNT(*) OVER()::int AS total_count
    FROM users WHERE $1::text IS NULL OR username ILIKE $1 ESCAPE '\\' OR email ILIKE $1 ESCAPE '\\'
    ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, [search, limit, (page - 1) * limit]);
  const total = rows[0]?.total_count || 0;
  res.json({ ok: true, data: rows.map(({ total_count, ...user }) => user), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.post('/', requireRole('Admin'), asyncRoute(async (req, res) => {
  const fields = parseUserFields(req.body, { creating: true });
  const passwordHash = await hashPassword(req.body.password);
  try {
    const { rows } = await pool.query(`INSERT INTO users(username,email,password_hash,role,wallet_address)
      VALUES($1,$2,$3,$4,$5) RETURNING ${USER_FIELDS}`,
    [fields.username, fields.email, passwordHash, fields.role || 'User', fields.walletAddress]);
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    if (error.code === '23505') return errorResponse(res, 409, 'USER_EXISTS', 'Username hoặc email đã được sử dụng');
    throw error;
  }
}));

router.patch('/:id', requireRole('Admin'), asyncRoute(async (req, res) => {
  const id = userId(req.params.id);
  const fields = parseUserFields(req.body);
  const keys = Object.keys(req.body || {});
  if (!keys.some((key) => ['username', 'email', 'role', 'wallet_address', 'is_active'].includes(key))) return errorResponse(res, 400, 'VALIDATION_ERROR', 'Không có trường hợp lệ để cập nhật');
  if (keys.some((key) => !['username', 'email', 'role', 'wallet_address', 'is_active'].includes(key))) return errorResponse(res, 400, 'VALIDATION_ERROR', 'Request chứa trường không được hỗ trợ');
  if (id === req.user.sub && (fields.role && fields.role !== 'Admin' || fields.isActive === false)) return errorResponse(res, 409, 'SELF_PROTECTION', 'Không thể tự hạ quyền hoặc khóa tài khoản đang đăng nhập');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (keys.includes('role') || fields.isActive === false) await lockAdminChanges(client);
    const { rows: existingRows } = await client.query(`SELECT ${USER_FIELDS} FROM users WHERE id=$1 FOR UPDATE`, [id]);
    const existing = existingRows[0];
    if (!existing) { await client.query('ROLLBACK'); return errorResponse(res, 404, 'NOT_FOUND', 'Không tìm thấy người dùng'); }
    const nextRole = fields.role || existing.role;
    const nextActive = fields.isActive ?? existing.is_active;
    if (existing.role === 'Admin' && existing.is_active && (nextRole !== 'Admin' || !nextActive)) await ensureNotLastAdmin(client, id);
    const { rows } = await client.query(`UPDATE users SET
      username=COALESCE($2,username), email=CASE WHEN $3 THEN $4 ELSE email END,
      role=COALESCE($5,role), wallet_address=CASE WHEN $6 THEN $7 ELSE wallet_address END,
      is_active=COALESCE($8,is_active)
      WHERE id=$1 RETURNING ${USER_FIELDS}`,
    [id,fields.username,fields.hasEmail,fields.email,fields.role,fields.hasWallet,fields.walletAddress,fields.isActive ?? null]);
    await client.query('COMMIT');
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return errorResponse(res, 409, 'USER_EXISTS', 'Username hoặc email đã được sử dụng');
    if (error.status) return errorResponse(res, error.status, error.code, error.message);
    throw error;
  } finally { client.release(); }
}));

router.delete('/:id', requireRole('Admin'), asyncRoute(async (req, res) => {
  const id = userId(req.params.id);
  if (id === req.user.sub) return errorResponse(res, 409, 'SELF_PROTECTION', 'Không thể xóa tài khoản đang đăng nhập');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockAdminChanges(client);
    const { rows } = await client.query(`SELECT ${USER_FIELDS} FROM users WHERE id=$1 FOR UPDATE`, [id]);
    if (!rows[0]) { await client.query('ROLLBACK'); return errorResponse(res, 404, 'NOT_FOUND', 'Không tìm thấy người dùng'); }
    if (rows[0].role === 'Admin' && rows[0].is_active) await ensureNotLastAdmin(client, id);
    await client.query('DELETE FROM users WHERE id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true, data: { id, deleted: true } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) return errorResponse(res, error.status, error.code, error.message);
    throw error;
  } finally { client.release(); }
}));

module.exports = router;

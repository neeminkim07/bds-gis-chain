const express = require('express');
const pool = require('../db');
const { createToken, hashPassword, requireAuth, verifyPassword } = require('../auth');

const router = express.Router();
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

function invalid(res, message, details) {
  return res.status(400).json({ ok: false, message, error: { code: 'VALIDATION_ERROR', message, ...(details ? { details } : {}) } });
}

router.post('/register', async (req, res, next) => {
  const { username, password } = req.body || {};
  const emailInput = req.body?.email;
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() : null;

  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    return invalid(res, 'username phải dài 3–50 ký tự và chỉ chứa chữ cái, số, dấu chấm, gạch ngang hoặc gạch dưới');
  }
  if (emailInput != null && (typeof emailInput !== 'string' || email.length > 254 || !EMAIL_RE.test(email))) {
    return invalid(res, 'email không đúng định dạng hoặc vượt quá 254 ký tự');
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return invalid(res, `password phải dài từ ${PASSWORD_MIN} đến ${PASSWORD_MAX} ký tự`);
  }

  try {
    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'User')
       RETURNING id, username, email, role, created_at`,
      [username.trim().toLowerCase(), email, passwordHash],
    );
    const user = rows[0];
    return res.status(201).json({ ok: true, message: 'Tạo tài khoản thành công', data: { user } });
  } catch (error) {
    if (error.code === '23505') {
      const isEmail = String(error.constraint || '').includes('email');
      return res.status(409).json({
        ok: false,
        message: isEmail ? 'Email đã được sử dụng' : 'Tên đăng nhập đã được sử dụng',
        error: {
          code: isEmail ? 'EMAIL_EXISTS' : 'USERNAME_EXISTS',
          message: isEmail ? 'Email đã được sử dụng' : 'Tên đăng nhập đã được sử dụng',
        },
      });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  const identifier = typeof req.body?.username === 'string'
    ? req.body.username.trim()
    : typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { password } = req.body || {};
  if (!identifier || typeof password !== 'string' || !password) return invalid(res, 'Cần username hoặc email và password');

  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, password_hash, role, is_active
       FROM users
       WHERE lower(username) = lower($1) OR lower(email) = lower($1)
       LIMIT 1`,
      [identifier],
    );
    const user = rows[0];
    const passwordMatches = user ? await verifyPassword(password, user.password_hash) : false;
    if (!passwordMatches || !user.is_active || !['Admin', 'User'].includes(user.role)) {
      const message = 'Thông tin đăng nhập không chính xác hoặc tài khoản không hợp lệ';
      return res.status(401).json({ ok: false, message, error: { code: 'INVALID_CREDENTIALS', message } });
    }

    const token = createToken(user);
    const safeUser = { id: user.id, username: user.username, email: user.email, role: user.role };
    return res.json({
      ok: true,
      message: 'Đăng nhập thành công',
      token,
      token_type: 'Bearer',
      expires_in: 3600,
      user: safeUser,
      data: { token, token_type: 'Bearer', expires_in: 3600, user: safeUser },
    });
  } catch (error) {
    if (error.code === 'CONFIG_ERROR') return res.status(500).json({ ok: false, message: error.message, error: { code: error.code, message: error.message } });
    return next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id,username,email,role,wallet_address,is_active,created_at FROM users WHERE id=$1', [req.user.sub]);
    if (!rows[0]) return res.status(401).json({ ok: false, message: 'Tài khoản không còn tồn tại', error: { code: 'UNAUTHORIZED', message: 'Tài khoản không còn tồn tại' } });
    return res.json({ ok: true, data: { user: rows[0] } });
  } catch (error) { return next(error); }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  const usernameInput = req.body?.username;
  const emailInput = req.body?.email;
  const username = typeof usernameInput === 'string' ? usernameInput.trim().toLowerCase() : '';
  const email = typeof emailInput === 'string' ? emailInput.trim().toLowerCase() || null : emailInput == null ? null : '';
  const updateEmail = emailInput !== undefined;
  if (!USERNAME_RE.test(username)) return invalid(res, 'username phải dài 3–50 ký tự và chỉ chứa chữ cái, số, dấu chấm, gạch ngang hoặc gạch dưới');
  if (email === '' || (email && (email.length > 254 || !EMAIL_RE.test(email)))) return invalid(res, 'email không đúng định dạng hoặc vượt quá 254 ký tự');

  try {
    const { rows } = await pool.query(`UPDATE users SET username=$2,email=CASE WHEN $4 THEN $3 ELSE email END WHERE id=$1
      RETURNING id,username,email,role,wallet_address,is_active,created_at`, [req.user.sub, username, email, updateEmail]);
    if (!rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy tài khoản', error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản' } });
    return res.json({ ok: true, message: 'Đã cập nhật hồ sơ', data: { user: rows[0] } });
  } catch (error) {
    if (error.code === '23505') {
      const isEmail = String(error.constraint || '').includes('email');
      const message = isEmail ? 'Email đã được sử dụng' : 'Tên đăng nhập đã được sử dụng';
      return res.status(409).json({ ok: false, message, error: { code: isEmail ? 'EMAIL_EXISTS' : 'USERNAME_EXISTS', message } });
    }
    return next(error);
  }
});

module.exports = router;

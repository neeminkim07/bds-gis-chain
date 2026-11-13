const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const gisRoutes = require('./routes/gis');
const userRoutes = require('./routes/users');
const { requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', authRoutes);

app.get('/api/health', async (req, res) => {
  try {
    // Câu truy vấn có tham số/không tham số đều đi qua pool; ở đây chỉ cần hỏi phiên bản
    const { rows } = await pool.query(
      'SELECT PostGIS_Version() AS postgis, (SELECT COUNT(*)::int FROM properties) AS properties'
    );
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error('Health check failed:', err.code || 'unknown error');
    res.status(500).json({
      ok: false,
      message: 'Không kết nối được database hoặc chưa chạy schema',
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Không kết nối được database hoặc chưa chạy schema' },
    });
  }
});

// Keep health checks public; protect all other current and future API routes.
app.use('/api', requireAuth);
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api', (_req, res) => res.status(404).json({
  ok: false,
  message: 'API endpoint không tồn tại',
  error: { code: 'NOT_FOUND', message: 'API endpoint không tồn tại' },
}));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    const message = 'Request body không phải JSON hợp lệ';
    return res.status(400).json({ ok: false, message, error: { code: 'INVALID_JSON', message } });
  }
  if (err.code === '23505') {
    const message = 'Mã hồ sơ hoặc thông tin tài khoản đã tồn tại';
    return res.status(409).json({ ok: false, message, error: { code: 'CONFLICT', message } });
  }
  if (err.status === 400 || ['23514', '22P02', '22003', 'XX000', '23001'].includes(err.code)) {
    const message = err.status === 400 ? err.message : 'Dữ liệu không hợp lệ theo quy tắc hoặc hình học PostGIS';
    return res.status(400).json({ ok: false, message, error: { code: err.code || 'INVALID_DATA', message } });
  }
  const configured = err.code === 'CONFIG_ERROR';
  if (!configured) console.error('API request failed:', err.code || err.message || 'unknown error');
  const message = configured ? err.message : 'Có lỗi máy chủ, vui lòng thử lại sau';
  return res.status(configured ? 500 : 500).json({ ok: false, message, error: { code: configured ? 'CONFIG_ERROR' : 'INTERNAL_ERROR', message } });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend chạy tại http://localhost:${PORT}`));

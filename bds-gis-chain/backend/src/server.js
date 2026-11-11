const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const { requireAuth, requireRole } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

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
app.use('/api/admin', requireRole('Admin'));
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
  const code = err.code === 'CONFIG_ERROR' ? 'CONFIG_ERROR' : 'INTERNAL_ERROR';
  if (code === 'INTERNAL_ERROR') console.error('API request failed:', err.code || 'unknown error');
  return res.status(500).json({
    ok: false,
    message: code === 'CONFIG_ERROR' ? err.message : 'Có lỗi máy chủ, vui lòng thử lại sau',
    error: {
      code,
      message: code === 'CONFIG_ERROR' ? err.message : 'Có lỗi máy chủ, vui lòng thử lại sau',
    },
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend chạy tại http://localhost:${PORT}`));

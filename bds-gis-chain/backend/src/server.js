// Server Express tối thiểu của Bước 1: chỉ có /api/health để kiểm tra kết nối DB + PostGIS.
// Các API CRUD, GIS, blockchain sẽ được thêm ở các bước sau.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    // Câu truy vấn có tham số/không tham số đều đi qua pool; ở đây chỉ cần hỏi phiên bản
    const { rows } = await pool.query(
      'SELECT PostGIS_Version() AS postgis, (SELECT COUNT(*)::int FROM properties) AS properties'
    );
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Không kết nối được database hoặc chưa chạy schema' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend chạy tại http://localhost:${PORT}`));

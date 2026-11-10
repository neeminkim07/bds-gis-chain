// Kiểm tra dữ liệu đã vào DB đúng chưa. Dùng:  npm run check
const pool = require('../src/db');

// Mỗi mục: tên kiểm tra, câu SQL, hàm đánh giá đạt/không đạt
const checks = [
  {
    name: 'Tổng số bất động sản',
    sql: 'SELECT COUNT(*)::int AS v FROM properties',
    pass: (v) => v > 0,
  },
  {
    name: 'Số polygon không hợp lệ (ST_IsValid = false)',
    sql: 'SELECT COUNT(*)::int AS v FROM properties WHERE NOT ST_IsValid(boundary)',
    pass: (v) => v === 0,
  },
  {
    name: 'Số bản ghi sai SRID (khác 4326)',
    sql: 'SELECT COUNT(*)::int AS v FROM properties WHERE ST_SRID(boundary) <> 4326 OR ST_SRID(location) <> 4326',
    pass: (v) => v === 0,
  },
  {
    name: 'Số bản ghi thiếu location hoặc boundary',
    sql: 'SELECT COUNT(*)::int AS v FROM properties WHERE location IS NULL OR boundary IS NULL',
    pass: (v) => v === 0,
  },
  {
    name: 'Số marker nằm NGOÀI polygon của chính nó',
    sql: 'SELECT COUNT(*)::int AS v FROM properties WHERE NOT ST_Within(location, boundary)',
    pass: (v) => v === 0,
  },
  {
    name: 'Số cặp polygon chồng lấn nhau (thửa đất thường không chồng)',
    sql: `SELECT COUNT(*)::int AS v FROM properties a JOIN properties b
          ON a.id < b.id AND ST_Overlaps(a.boundary, b.boundary)`,
    pass: (v) => v === 0,
  },
  {
    name: 'Số chỉ mục GiST trên bảng properties',
    sql: `SELECT COUNT(*)::int AS v FROM pg_indexes
          WHERE tablename = 'properties' AND indexdef ILIKE '%USING gist%'`,
    pass: (v) => v >= 2,
  },
];

async function main() {
  let failed = 0;
  for (const c of checks) {
    const { rows } = await pool.query(c.sql);
    const ok = c.pass(rows[0].v);
    if (!ok) failed++;
    console.log(`${ok ? '✔' : '✘'} ${c.name}: ${rows[0].v}`);
  }

  // Phân bố theo loại + so sánh nhanh diện tích nhập tay với ST_Area (xem trước Bước 3)
  const byType = await pool.query('SELECT type, COUNT(*)::int AS n FROM properties GROUP BY type ORDER BY type');
  console.log('\nPhân bố theo loại:'); console.table(byType.rows);

  const sample = await pool.query(`
    SELECT code, area AS area_nhap_tay,
           ROUND(ST_Area(boundary::geography)::numeric, 1) AS area_postgis,
           ROUND(ST_X(location)::numeric, 5) AS lng, ROUND(ST_Y(location)::numeric, 5) AS lat
    FROM properties ORDER BY code LIMIT 5`);
  console.log('5 bản ghi đầu:'); console.table(sample.rows);

  console.log(failed ? `\n${failed} kiểm tra KHÔNG đạt.` : '\nTất cả kiểm tra đạt.');
  await pool.end();
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error('Lỗi:', e.message); process.exit(1); });

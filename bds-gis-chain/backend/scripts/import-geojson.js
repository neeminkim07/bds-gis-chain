// Nhập file GeoJSON (FeatureCollection) vào bảng properties.
//
// Dùng:  node scripts/import-geojson.js [đường_dẫn_geojson]
// Mặc định đọc ../data/properties.geojson (file QGIS của bạn); nếu chưa có thì dùng file mẫu.
//
// Mỗi Feature cần: geometry = Polygon (WGS84) và properties = { code, address, type, area?, price?, owner_name? }
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const VALID_TYPES = ['house', 'apartment', 'land', 'commercial'];

function resolveInput() {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const real = path.join(__dirname, '..', '..', 'data', 'properties.geojson');
  const sample = path.join(__dirname, '..', '..', 'data', 'properties.sample.geojson');
  return fs.existsSync(real) ? real : sample;
}

async function main() {
  const file = resolveInput();
  if (!fs.existsSync(file)) {
    throw new Error(`Không thấy file ${file}. Chạy "npm run make-sample" để tạo dữ liệu mẫu.`);
  }
  console.log('Đọc file:', file);
  const gj = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (gj.type !== 'FeatureCollection') throw new Error('File phải là FeatureCollection');

  const client = await pool.connect();
  let ok = 0;
  const errors = [];
  try {
    // Một transaction: lỗi giữa chừng thì hoàn tác hết, không để dữ liệu nửa vời
    await client.query('BEGIN');

    for (const [i, f] of gj.features.entries()) {
      const p = f.properties || {};
      const label = p.code || `feature #${i + 1}`;

      // --- Kiểm tra dữ liệu đầu vào ---
      if (!p.code || !p.address) { errors.push(`${label}: thiếu code hoặc address`); continue; }
      if (!VALID_TYPES.includes(p.type)) { errors.push(`${label}: type "${p.type}" không hợp lệ`); continue; }
      if (!f.geometry || f.geometry.type !== 'Polygon') {
        errors.push(`${label}: geometry phải là Polygon (nếu QGIS xuất MultiPolygon, dùng "Multipart to singleparts")`);
        continue;
      }

      // Truy vấn CÓ THAM SỐ ($1, $2, ...) -> chống SQL injection.
      // ST_GeomFromGeoJSON: đọc geometry từ chuỗi GeoJSON.
      // ST_SetSRID(..., 4326): gán hệ tọa độ WGS84.
      // ST_MakeValid: sửa polygon lỗi (tự cắt nhau...) nếu có.
      // ST_PointOnSurface: lấy 1 điểm NẰM TRONG polygon làm marker (an toàn hơn centroid với thửa lõm).
      // Nếu thiếu area: tự tính bằng ST_Area(geography) -> mét vuông thật.
      const sql = `
        WITH g AS (
          SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom
        )
        INSERT INTO properties (code, owner_name, address, area, type, price, location, boundary)
        SELECT $2, $3, $4,
               COALESCE($5::numeric, ROUND(ST_Area(geom::geography)::numeric, 2)),
               $6, $7::numeric,
               ST_PointOnSurface(geom),
               geom
        FROM g
        ON CONFLICT (code) DO UPDATE SET
          owner_name = EXCLUDED.owner_name, address = EXCLUDED.address, area = EXCLUDED.area,
          type = EXCLUDED.type, price = EXCLUDED.price,
          location = EXCLUDED.location, boundary = EXCLUDED.boundary, updated_at = now()`;
      await client.query(sql, [
        JSON.stringify(f.geometry), p.code, p.owner_name ?? null, p.address,
        p.area ?? null, p.type, p.price ?? null,
      ]);
      ok++;
    }

    if (errors.length) {
      await client.query('ROLLBACK');
      console.error(`\nCó ${errors.length} lỗi, đã hoàn tác (không nhập gì):`);
      errors.slice(0, 20).forEach((e) => console.error(' -', e));
      process.exitCode = 1;
    } else {
      await client.query('COMMIT');
      console.log(`Đã nhập/cập nhật ${ok} bất động sản.`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('Lỗi:', e.message); process.exit(1); });

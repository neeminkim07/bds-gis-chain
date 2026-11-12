// Import a validated GeoJSON FeatureCollection atomically into properties.
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

function validate(collection) {
  const errors = [];
  if (!collection || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    return ['Root phải là GeoJSON FeatureCollection có mảng features'];
  }
  if (collection.crs && !(collection.crs.type === 'name' && /(?:EPSG:)?4326$/i.test(collection.crs.properties?.name || ''))) {
    errors.push('Chỉ hỗ trợ EPSG:4326 (WGS84); hãy chuyển hệ tọa độ trước khi xuất');
  }
  const codes = new Set();
  collection.features.forEach((feature, index) => {
    const properties = feature?.properties || {};
    const label = properties.code || `feature #${index + 1}`;
    if (feature?.type !== 'Feature') errors.push(`${label}: phần tử phải có type Feature`);
    if (typeof properties.code !== 'string' || !/^[\p{L}\p{N}._-]{1,20}$/u.test(properties.code.trim())) errors.push(`${label}: code bắt buộc, tối đa 20 ký tự`);
    else if (codes.has(properties.code.trim())) errors.push(`${label}: code bị lặp trong file`);
    else codes.add(properties.code.trim());
    if (typeof properties.address !== 'string' || !properties.address.trim() || properties.address.trim().length > 255) errors.push(`${label}: address bắt buộc, tối đa 255 ký tự`);
    if (!VALID_TYPES.includes(properties.type)) errors.push(`${label}: type phải thuộc ${VALID_TYPES.join(', ')}`);
    if (properties.owner_name != null && (typeof properties.owner_name !== 'string' || properties.owner_name.length > 100)) errors.push(`${label}: owner_name tối đa 100 ký tự`);
    if (properties.area != null && (!Number.isFinite(Number(properties.area)) || Number(properties.area) <= 0 || Number(properties.area) > 9999999999.99)) errors.push(`${label}: area phải là số dương hợp lệ`);
    if (properties.price != null && (!Number.isFinite(Number(properties.price)) || Number(properties.price) < 0 || Number(properties.price) > 9999999999999999)) errors.push(`${label}: price phải là số không âm hợp lệ`);
    const geometry = feature?.geometry;
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) {
      errors.push(`${label}: geometry phải là Polygon hoặc MultiPolygon`);
      return;
    }
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    if (!polygons.length) { errors.push(`${label}: geometry không có polygon`); return; }
    for (const polygon of polygons) {
      if (!Array.isArray(polygon) || !polygon.length) { errors.push(`${label}: polygon không có ring`); continue; }
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4) errors.push(`${label}: mỗi ring cần ít nhất 4 vị trí`);
        else {
          const first = ring[0]; const last = ring[ring.length - 1];
          if (!Array.isArray(first) || !Array.isArray(last) || first[0] !== last[0] || first[1] !== last[1]) errors.push(`${label}: mỗi ring phải khép kín`);
        }
        if (Array.isArray(ring) && ring.some((point) => !Array.isArray(point) || point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90)) errors.push(`${label}: tọa độ sai; dùng [kinh độ, vĩ độ] EPSG:4326`);
      }
    }
  });
  return errors;
}

async function main() {
  const file = resolveInput();
  if (!fs.existsSync(file)) throw new Error(`Không tìm thấy file ${file}`);
  let collection;
  try { collection = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('File không phải JSON hợp lệ'); }
  const errors = validate(collection);
  if (errors.length) throw new Error(`Kiểm tra GeoJSON thất bại (${errors.length} lỗi):\n${errors.slice(0, 30).map((error) => ` - ${error}`).join('\n')}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const feature of collection.features) {
      const property = feature.properties;
      const { rowCount } = await client.query(`WITH raw AS (
          SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) AS geom
        ), valid AS (
          SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(geom),3))::geometry(MultiPolygon,4326) AS geom FROM raw
        )
        INSERT INTO properties(code,owner_name,address,area,type,price,location,boundary)
        SELECT $2,$3,$4,COALESCE($5::numeric,ROUND(ST_Area(geom::geography)::numeric,2)),$6,$7,
          ST_PointOnSurface(geom)::geometry(Point,4326),geom FROM valid
        WHERE NOT ST_IsEmpty(geom) AND ST_IsValid(geom)
        ON CONFLICT(code) DO UPDATE SET owner_name=EXCLUDED.owner_name,address=EXCLUDED.address,
          area=EXCLUDED.area,type=EXCLUDED.type,price=EXCLUDED.price,location=EXCLUDED.location,
          boundary=EXCLUDED.boundary,updated_at=now()`, [JSON.stringify(feature.geometry),property.code.trim(),property.owner_name?.trim() || null,property.address.trim(),property.area ?? null,property.type,property.price ?? null]);
      if (rowCount !== 1) throw new Error(`${property.code}: hình học rỗng hoặc không tạo được Polygon hợp lệ`);
    }
    await client.query('COMMIT');
    console.log(`Đã nhập/cập nhật ${collection.features.length} bất động sản.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Giao dịch đã rollback, không nhập dở dang: ${error.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(`Lỗi nhập dữ liệu: ${error.message}`); process.exit(1); });

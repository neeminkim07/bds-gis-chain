const express = require('express');
const pool = require('../db');
const { requireRole } = require('../auth');

const router = express.Router();
const TYPES = ['house', 'apartment', 'land', 'commercial'];

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'VALIDATION_ERROR';
  return error;
}

function number(value, name, { required = false, min = -Infinity, max = Infinity, integer = false } = {}) {
  if ((value === undefined || value === null || value === '') && !required) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw badRequest(`${name} không hợp lệ`);
  }
  return parsed;
}

function validateGeometry(geometry, name = 'geometry') {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) {
    throw badRequest(`${name} phải là GeoJSON Polygon hoặc MultiPolygon`);
  }
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!polygons.length) throw badRequest(`${name} không có polygon`);
  let positions = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) throw badRequest(`${name} có ring không hợp lệ`);
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) throw badRequest(`${name}: mỗi ring cần ít nhất 4 tọa độ`);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (!Array.isArray(first) || !Array.isArray(last) || first[0] !== last[0] || first[1] !== last[1]) {
        throw badRequest(`${name}: mỗi ring phải khép kín`);
      }
      for (const point of ring) {
        if (!Array.isArray(point) || point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90) {
          throw badRequest(`${name} cần tọa độ [kinh độ, vĩ độ] trong EPSG:4326`);
        }
        positions += 1;
      }
    }
  }
  if (!positions) throw badRequest(`${name} không có tọa độ`);
}

function readProperty(body) {
  const { code, address, type } = body || {};
  if (typeof code !== 'string' || !/^[\p{L}\p{N}._-]{1,20}$/u.test(code.trim())) throw badRequest('code bắt buộc, tối đa 20 ký tự');
  if (typeof address !== 'string' || !address.trim() || address.trim().length > 255) throw badRequest('address bắt buộc, tối đa 255 ký tự');
  if (!TYPES.includes(type)) throw badRequest(`type phải thuộc ${TYPES.join(', ')}`);
  if (body.owner_name != null && (typeof body.owner_name !== 'string' || body.owner_name.length > 100)) throw badRequest('owner_name tối đa 100 ký tự');
  if (body.description != null && (typeof body.description !== 'string' || body.description.length > 1000)) throw badRequest('description tối đa 1000 ký tự');
  const documentStatus = body.document_status || 'Chưa cung cấp';
  if (!['Chưa cung cấp', 'Đã tiếp nhận', 'Cần bổ sung'].includes(documentStatus)) throw badRequest('document_status không hợp lệ');
  if (body.boundary != null) validateGeometry(body.boundary, 'boundary');
  if (body.area == null && body.boundary == null) throw badRequest('Cần area hoặc boundary');
  const area = number(body.area, 'area', { min: Number.EPSILON, max: 9999999999.99 });
  const price = number(body.price, 'price', { min: 0, max: 9999999999999999 });
  return { code: code.trim(), address: address.trim(), type, owner_name: body.owner_name?.trim() || null, area, price, boundary: body.boundary || null, description: body.description || null, document_status: documentStatus };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const FIELDS = `id,code,owner_name,address,area,type,price,image_path,doc_path,created_at,updated_at,
  document_status,description,ST_AsGeoJSON(location)::json AS location, ST_AsGeoJSON(boundary)::json AS boundary`;

router.get('/', asyncRoute(async (req, res) => {
  const limit = number(req.query.limit ?? 20, 'limit', { min: 1, max: 100, integer: true });
  const page = number(req.query.page ?? 1, 'page', { min: 1, max: 1000000, integer: true });
  const areaMin = number(req.query.area_min, 'area_min', { min: 0 });
  const areaMax = number(req.query.area_max, 'area_max', { min: 0 });
  const priceMin = number(req.query.price_min, 'price_min', { min: 0 });
  const priceMax = number(req.query.price_max, 'price_max', { min: 0 });
  if (req.query.type && !TYPES.includes(req.query.type)) throw badRequest('type không hợp lệ');
  if ((areaMin != null && areaMax != null && areaMin > areaMax) || (priceMin != null && priceMax != null && priceMin > priceMax)) throw badRequest('Giá trị min không được lớn hơn max');
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const search = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
  const params = [req.query.type || null, areaMin, areaMax, priceMin, priceMax, search, limit, (page - 1) * limit];
  const { rows } = await pool.query(`SELECT ${FIELDS}, COUNT(*) OVER()::int AS total_count FROM properties
    WHERE ($1::text IS NULL OR type=$1) AND ($2::numeric IS NULL OR area >= $2) AND ($3::numeric IS NULL OR area <= $3)
      AND ($4::numeric IS NULL OR price >= $4) AND ($5::numeric IS NULL OR price <= $5)
      AND ($6::text IS NULL OR code ILIKE $6 ESCAPE '\\' OR address ILIKE $6 ESCAPE '\\')
    ORDER BY updated_at DESC,id LIMIT $7 OFFSET $8`, params);
  const total = rows[0]?.total_count || 0;
  res.json({ ok: true, data: rows.map(({ total_count, ...row }) => row), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const id = number(req.params.id, 'id', { required: true, min: 1, integer: true });
  const { rows } = await pool.query(`SELECT ${FIELDS} FROM properties WHERE id=$1`, [id]);
  if (!rows[0]) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ' } });
  res.json({ ok: true, data: rows[0] });
}));

const UPSERT = `WITH geom AS (
  SELECT CASE WHEN $7::jsonb IS NULL THEN NULL ELSE
    ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($7::text),4326)),3))::geometry(MultiPolygon,4326)
  END AS boundary
)
INSERT INTO properties(code,owner_name,address,area,type,price,location,boundary,description,document_status)
SELECT $1,$2,$3,COALESCE($4,ROUND(ST_Area(boundary::geography)::numeric,2)),$5,$6,
       CASE WHEN boundary IS NULL THEN NULL ELSE ST_PointOnSurface(boundary)::geometry(Point,4326) END,boundary,$8,$9
FROM geom WHERE boundary IS NULL OR (NOT ST_IsEmpty(boundary) AND ST_IsValid(boundary))
RETURNING ${FIELDS}`;

router.post('/bulk', requireRole('Admin'), asyncRoute(async (req, res) => {
  const properties = req.body?.properties;
  if (!Array.isArray(properties) || !properties.length || properties.length > 500) throw badRequest('properties phải là mảng từ 1 đến 500 hồ sơ');
  const validated = properties.map(readProperty);
  const codes = new Set();
  for (const property of validated) {
    if (codes.has(property.code.toLowerCase())) throw badRequest(`Mã hồ sơ ${property.code} bị lặp trong request`);
    codes.add(property.code.toLowerCase());
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const property of validated) {
      await client.query(`${UPSERT.replace('RETURNING', 'ON CONFLICT(code) DO UPDATE SET owner_name=EXCLUDED.owner_name,address=EXCLUDED.address,area=EXCLUDED.area,type=EXCLUDED.type,price=EXCLUDED.price,location=EXCLUDED.location,boundary=EXCLUDED.boundary,description=EXCLUDED.description,document_status=EXCLUDED.document_status,updated_at=now() RETURNING')}`,
      [property.code,property.owner_name,property.address,property.area,property.type,property.price,property.boundary ? JSON.stringify(property.boundary) : null,property.description,property.document_status]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, data: { upserted: validated.length } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}));

router.post('/', requireRole('Admin'), asyncRoute(async (req, res) => {
  const property = readProperty(req.body);
  const { rows } = await pool.query(UPSERT, [property.code, property.owner_name, property.address, property.area, property.type, property.price, property.boundary ? JSON.stringify(property.boundary) : null,property.description,property.document_status]);
  if (!rows[0]) return res.status(400).json({ ok: false, error: { code: 'INVALID_GEOMETRY', message: 'Ranh giới rỗng hoặc không tạo được polygon hợp lệ' } });
  res.status(201).json({ ok: true, data: rows[0] });
}));

router.put('/:id', requireRole('Admin'), asyncRoute(async (req, res) => {
  const id = number(req.params.id, 'id', { required: true, min: 1, integer: true });
  const property = readProperty(req.body);
  const { rows } = await pool.query(`UPDATE properties SET code=$2,owner_name=$3,address=$4,area=COALESCE($5,area),type=$6,price=$7,description=$9,document_status=$10,
    boundary=CASE WHEN $8::jsonb IS NULL THEN boundary ELSE ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($8::text),4326)),3))::geometry(MultiPolygon,4326) END,
    location=CASE WHEN $8::jsonb IS NULL THEN location ELSE ST_PointOnSurface(ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($8::text),4326)),3)))::geometry(Point,4326) END,
    updated_at=now() WHERE id=$1 RETURNING ${FIELDS}`, [id,property.code,property.owner_name,property.address,property.area,property.type,property.price,property.boundary ? JSON.stringify(property.boundary) : null,property.description,property.document_status]);
  if (!rows[0]) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ' } });
  res.json({ ok: true, data: rows[0] });
}));

router.delete('/:id', requireRole('Admin'), asyncRoute(async (req, res) => {
  const id = number(req.params.id, 'id', { required: true, min: 1, integer: true });
  const { rowCount } = await pool.query('DELETE FROM properties WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ' } });
  res.json({ ok: true, data: { id, deleted: true } });
}));

module.exports = router;

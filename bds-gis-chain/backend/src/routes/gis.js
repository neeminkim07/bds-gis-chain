const express = require('express');
const pool = require('../db');
const router = express.Router();

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function number(value, name, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(parsed) || parsed < min || parsed > max) {
    const error = new Error(`${name} không hợp lệ`);
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return parsed;
}

function geometry(value) {
  if (!value || !['Polygon', 'MultiPolygon'].includes(value.type) || !Array.isArray(value.coordinates)) {
    const error = new Error('geometry phải là GeoJSON Polygon hoặc MultiPolygon');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  const polygons = value.type === 'Polygon' ? [value.coordinates] : value.coordinates;
  if (!polygons.length || polygons.some((polygon) => !Array.isArray(polygon) || !polygon.length || polygon.some((ring) => !Array.isArray(ring) || ring.length < 4 || ring.some((point) => !Array.isArray(point) || point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90)))) {
    const error = new Error('geometry có ring hoặc tọa độ không hợp lệ; dùng [kinh độ, vĩ độ] EPSG:4326');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return value;
}

router.get('/radius', asyncRoute(async (req, res) => {
  const lon = number(req.query.lon, 'lon', { min: -180, max: 180 });
  const lat = number(req.query.lat, 'lat', { min: -90, max: 90 });
  const radius = number(req.query.radius_m, 'radius_m', { min: 0.01, max: 100000 });
  const { rows } = await pool.query(`SELECT id,code,address,area,type,price,
      ST_Distance(location::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric(14,2) AS distance_m,
      ST_AsGeoJSON(location)::json AS location
    FROM properties WHERE location IS NOT NULL
      AND ST_DWithin(location::geography,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3)
    ORDER BY distance_m`, [lon,lat,radius]);
  res.json({ ok: true, data: rows, units: { distance: 'm' } });
}));

router.post('/intersects', asyncRoute(async (req, res) => {
  const area = geometry(req.body?.geometry);
  const { rows } = await pool.query(`WITH g AS (
      SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)),3))::geometry(MultiPolygon,4326) AS geom
    )
    SELECT p.id,p.code,p.address,p.area,p.type,p.price,ST_AsGeoJSON(p.boundary)::json AS boundary
    FROM properties p,g WHERE p.boundary IS NOT NULL AND ST_Intersects(p.boundary,g.geom) ORDER BY p.id`, [JSON.stringify(area)]);
  res.json({ ok: true, data: rows });
}));

router.post('/area', asyncRoute(async (req, res) => {
  const input = geometry(req.body?.geometry);
  const { rows } = await pool.query(`SELECT ROUND(ST_Area(
      ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)),3))::geography
    )::numeric,2) AS area_m2`, [JSON.stringify(input)]);
  res.json({ ok: true, data: rows[0], units: { area: 'm2' } });
}));

router.get('/statistics', asyncRoute(async (_req, res) => {
  const [byType, summary] = await Promise.all([
    pool.query('SELECT type,COUNT(*)::int AS count,COALESCE(SUM(area),0)::numeric(16,2) AS area_m2 FROM properties GROUP BY type ORDER BY type'),
    pool.query('SELECT COUNT(*)::int AS total,COALESCE(AVG(price),0)::numeric(16,2) AS average_price,COALESCE(SUM(area),0)::numeric(16,2) AS total_area_m2 FROM properties'),
  ]);
  res.json({ ok: true, data: { summary: summary.rows[0], by_type: byType.rows, units: { area: 'm2', price: 'VND' } } });
}));

module.exports = router;

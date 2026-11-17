const express = require('express');
const pool = require('../db');
const { requireRole } = require('../auth');
const {
  checkBlockchainConnection,
  computePropertyHash,
  recordPropertyVersion,
  getOnChainLatest,
  getOnChainHistory,
} = require('../blockchain');

const router = express.Router();

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const FIELDS = `id,code,owner_name,address,area,type,price,image_path,doc_path,created_at,updated_at,
  document_status,description,ST_AsGeoJSON(location)::json AS location, ST_AsGeoJSON(boundary)::json AS boundary`;

/**
 * GET /api/verify/status
 * Kiểm tra trạng thái node blockchain và contract
 */
router.get(
  '/status',
  asyncRoute(async (_req, res) => {
    const status = await checkBlockchainConnection();
    res.json({ ok: true, data: status });
  })
);

/**
 * GET /api/verify/properties
 * Danh sách tóm tắt trạng thái xác thực của các hồ sơ
 */
router.get(
  '/properties',
  asyncRoute(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const search = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;

    const query = `
      SELECT p.id, p.code, p.owner_name, p.address, p.type, p.area, p.price,
             p.updated_at,
             ST_AsGeoJSON(p.location)::json AS location,
             ST_AsGeoJSON(p.boundary)::json AS boundary,
             v.version AS latest_db_version,
             v.data_hash AS latest_db_hash,
             v.tx_hash AS latest_tx_hash,
             v.created_at AS registered_at
      FROM properties p
      LEFT JOIN LATERAL (
        SELECT version, data_hash, tx_hash, created_at
        FROM property_versions
        WHERE property_id = p.id
        ORDER BY version DESC
        LIMIT 1
      ) v ON true
      WHERE ($1::text IS NULL OR p.code ILIKE $1 ESCAPE '\\' OR p.address ILIKE $1 ESCAPE '\\' OR p.owner_name ILIKE $1 ESCAPE '\\')
      ORDER BY p.updated_at DESC, p.id
      LIMIT 100
    `;

    const { rows } = await pool.query(query, [search]);
    res.json({ ok: true, data: rows });
  })
);

/**
 * GET /api/verify/:code
 * Kiểm tra đối chiếu chi tiết hồ sơ: tính hash hiện tại và so với Smart Contract
 */
router.get(
  '/:code',
  asyncRoute(async (req, res) => {
    const code = req.params.code?.trim();
    if (!code) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_CODE', message: 'Mã hồ sơ không hợp lệ' } });
    }

    // 1. Lấy dữ liệu hồ sơ hiện tại từ PostgreSQL
    const propRes = await pool.query(`SELECT ${FIELDS} FROM properties WHERE code = $1`, [code]);
    if (!propRes.rows[0]) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ' } });
    }
    const currentProperty = propRes.rows[0];

    // 2. Tính hash SHA-256 từ dữ liệu hiện tại
    const { hash: currentHash, canonicalJson, canonicalData } = computePropertyHash(currentProperty);

    // 3. Lấy lịch sử phiên bản trong database PostgreSQL
    const dbVersionsRes = await pool.query(
      `SELECT id, version, data_hash, tx_hash, created_at, data_json
       FROM property_versions
       WHERE property_id = $1
       ORDER BY version DESC`,
      [currentProperty.id]
    );
    const dbVersions = dbVersionsRes.rows;
    const latestDbVersion = dbVersions[0] || null;

    // 4. Kiểm tra kết nối blockchain & lấy dữ liệu on-chain
    const connection = await checkBlockchainConnection();
    let onChainLatest = null;
    let onChainHistory = [];
    let status = 'NOT_REGISTERED';
    let statusMessage = 'Hồ sơ chưa được đăng ký trên blockchain.';

    if (!connection.connected) {
      status = 'NODE_OFFLINE';
      statusMessage = 'Không thể kết nối đến node blockchain local (Hardhat). Vui lòng chạy "npx hardhat node".';
    } else if (!connection.contractReady) {
      status = 'CONTRACT_NOT_READY';
      statusMessage = 'Contract chưa được deploy hoặc địa chỉ contract chưa cấu hình.';
    } else {
      onChainLatest = await getOnChainLatest(code);
      onChainHistory = await getOnChainHistory(code);

      if (!onChainLatest) {
        status = 'NOT_REGISTERED';
        statusMessage = 'Hồ sơ chưa từng được đăng ký phiên bản nào trên blockchain.';
      } else {
        // So khớp hash hiện tại với hash lưu trên blockchain
        const onChainHashClean = onChainLatest.dataHash.toLowerCase();
        const currentHashClean = currentHash.toLowerCase();

        if (onChainHashClean === currentHashClean) {
          status = 'MATCH';
          statusMessage = 'Dữ liệu toàn vẹn: Mã băm của dữ liệu hiện tại KHỚP HOÀN TOÀN với Smart Contract.';
        } else {
          status = 'MODIFIED';
          statusMessage =
            'CẢNH BÁO: Dữ liệu đã bị chỉnh sửa ngoài quy trình! Mã băm hiện tại KHÔNG KHỚP với hash lưu trên blockchain.';
        }
      }
    }

    res.json({
      ok: true,
      data: {
        property: currentProperty,
        canonicalData,
        canonicalJson,
        currentHash,
        status,
        statusMessage,
        blockchain: {
          nodeConnected: connection.connected,
          contractReady: connection.contractReady,
          latest: onChainLatest,
          history: onChainHistory,
        },
        database: {
          latest: latestDbVersion,
          history: dbVersions,
        },
      },
    });
  })
);

/**
 * POST /api/verify/register/:id
 * Đăng ký phiên bản mới của hồ sơ lên blockchain (yêu cầu quyền Admin)
 */
router.post(
  '/register/:id',
  requireRole('Admin'),
  asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: 'ID hồ sơ không hợp lệ' } });
    }

    const propRes = await pool.query(`SELECT ${FIELDS} FROM properties WHERE id = $1`, [id]);
    if (!propRes.rows[0]) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ' } });
    }

    const property = propRes.rows[0];

    try {
      const result = await recordPropertyVersion(property, { requireBlockchain: true });
      res.status(201).json({
        ok: true,
        message: 'Đăng ký phiên bản lên blockchain thành công.',
        data: result,
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        message: 'Đăng ký lên blockchain thất bại: ' + (error.message || 'Lỗi giao dịch'),
        error: {
          code: 'BLOCKCHAIN_TRANSACTION_FAILED',
          message: error.message || 'Lỗi khi gửi giao dịch đến Smart Contract',
        },
      });
    }
  })
);

module.exports = router;

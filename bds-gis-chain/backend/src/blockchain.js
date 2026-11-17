// Module tích hợp Blockchain cho BĐS:
// 1. Chuẩn hóa dữ liệu hồ sơ (Canonical JSON) với thứ tự key cố định.
// 2. Tính mã băm SHA-256 từ dữ liệu chuẩn hóa.
// 3. Kết nối Hardhat qua Ethers.js: gọi registerVersion, tra cứu lịch sử on-chain.
// 4. Lưu vết phiên bản vào bảng property_versions trong PostgreSQL.
// Lưu ý: Chỉ lưu hash (bytes32) lên blockchain, KHÔNG lưu dữ liệu cá nhân.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const pool = require('./db');

// ABI của Smart Contract PropertyRegistry
const PROPERTY_REGISTRY_ABI = [
  'function registerVersion(string calldata code, bytes32 dataHash) external',
  'function getLatest(string calldata code) external view returns (bytes32 dataHash, uint256 versionNumber, uint256 timestamp, address registeredBy)',
  'function getVersion(string calldata code, uint256 n) external view returns (bytes32 dataHash, uint256 versionNumber, uint256 timestamp, address registeredBy)',
  'function getHistoryCount(string calldata code) external view returns (uint256 count)',
  'function owner() external view returns (address)',
  'function writers(address) external view returns (bool)',
  'event VersionRegistered(string indexed code, bytes32 dataHash, uint256 versionNumber, uint256 timestamp, address registeredBy)',
];

/**
 * Lấy địa chỉ contract từ .env hoặc từ file deployed-address.json
 */
function getContractAddress() {
  if (process.env.CONTRACT_ADDRESS && process.env.CONTRACT_ADDRESS.trim()) {
    return process.env.CONTRACT_ADDRESS.trim();
  }
  const deployedJsonPath = path.resolve(__dirname, '..', '..', 'contracts', 'deployed-address.json');
  try {
    if (fs.existsSync(deployedJsonPath)) {
      const info = JSON.parse(fs.readFileSync(deployedJsonPath, 'utf8'));
      if (info && info.address) return info.address;
    }
  } catch {
    // Bỏ qua lỗi đọc file
  }
  return null;
}

/**
 * Khởi tạo Ethers Provider & Signer kết nối mạng Hardhat local
 */
function getBlockchainClient() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
  const privateKey =
    process.env.BLOCKCHAIN_PRIVATE_KEY ||
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Account #0 Hardhat

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contractAddress = getContractAddress();
  const contract = contractAddress
    ? new ethers.Contract(contractAddress, PROPERTY_REGISTRY_ABI, wallet)
    : null;

  return { provider, wallet, contract, contractAddress, rpcUrl };
}

/**
 * Kiểm tra trạng thái kết nối tới blockchain node và contract
 */
async function checkBlockchainConnection() {
  const { provider, contractAddress, rpcUrl } = getBlockchainClient();
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    let contractReady = false;

    if (contractAddress) {
      const code = await provider.getCode(contractAddress);
      contractReady = code && code !== '0x';
    }

    return {
      connected: true,
      rpcUrl,
      chainId: Number(network.chainId),
      blockNumber,
      contractAddress,
      contractReady,
    };
  } catch (error) {
    return {
      connected: false,
      rpcUrl,
      contractAddress,
      contractReady: false,
      error: error.message || 'Không thể kết nối RPC node',
    };
  }
}

/**
 * Chuẩn hóa object thành Canonical JSON (sắp xếp key theo thứ tự từ điển, đệ quy)
 * Đảm bảo 2 object cùng nội dung luôn cho ra chuỗi ký tự giống hệt nhau
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => JSON.stringify(key) + ':' + stableStringify(value[key]));
  return '{' + parts.join(',') + '}';
}

/**
 * Trích xuất các trường nghiệp vụ của hồ sơ BĐS để chuẩn hóa dữ liệu
 * (bỏ qua id nội bộ DB, created_at, updated_at để chỉ băm nội dung thực tế)
 */
function buildCanonicalProperty(property) {
  return {
    address: property.address ? String(property.address).trim() : '',
    area: Number(property.area) || 0,
    boundary: property.boundary || null,
    code: property.code ? String(property.code).trim() : '',
    description: property.description || null,
    document_status: property.document_status || 'Chưa cung cấp',
    location: property.location || null,
    owner_name: property.owner_name ? String(property.owner_name).trim() : null,
    price: property.price != null ? Number(property.price) : null,
    type: property.type || '',
  };
}

/**
 * Tính mã SHA-256 dạng hex (64 ký tự) từ dữ liệu hồ sơ BĐS
 */
function computePropertyHash(property) {
  const canonicalData = buildCanonicalProperty(property);
  const canonicalJson = stableStringify(canonicalData);
  const hash = crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
  return { hash, canonicalJson, canonicalData };
}

/**
 * Gọi Smart Contract đăng ký hash lên chain
 */
async function registerHashOnChain(code, hashHex) {
  const { contract, contractAddress } = getBlockchainClient();
  if (!contract || !contractAddress) {
    throw new Error('Chưa cấu hình CONTRACT_ADDRESS hoặc chưa deploy contract.');
  }

  // Chuyển hash 64-char hex sang bytes32 (thêm prefix 0x)
  const bytes32Hash = '0x' + hashHex.replace(/^0x/, '');
  if (bytes32Hash.length !== 66) {
    throw new Error('Hash không đúng định dạng bytes32 (cần 32 bytes / 64 ký tự hex).');
  }

  const tx = await contract.registerVersion(code, bytes32Hash);
  const receipt = await tx.wait();

  // Tìm event VersionRegistered trong logs
  let versionNumber = null;
  for (const log of receipt.logs || []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === 'VersionRegistered') {
        versionNumber = Number(parsed.args.versionNumber);
        break;
      }
    } catch {
      // bỏ qua log không thuộc contract
    }
  }

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    versionNumber,
  };
}

/**
 * Tra cứu thông tin phiên bản mới nhất trên blockchain
 */
async function getOnChainLatest(code) {
  const { contract } = getBlockchainClient();
  if (!contract) return null;
  try {
    const [dataHash, versionNumber, timestamp, registeredBy] = await contract.getLatest(code);
    return {
      dataHash: dataHash.replace(/^0x/, ''),
      versionNumber: Number(versionNumber),
      timestamp: Number(timestamp),
      registeredBy,
    };
  } catch (err) {
    // "Chua co phien ban nao"
    return null;
  }
}

/**
 * Tra cứu toàn bộ lịch sử phiên bản trên blockchain của một mã BĐS
 */
async function getOnChainHistory(code) {
  const { contract } = getBlockchainClient();
  if (!contract) return [];
  try {
    const countBn = await contract.getHistoryCount(code);
    const count = Number(countBn);
    const history = [];
    for (let i = 1; i <= count; i++) {
      const [dataHash, versionNumber, timestamp, registeredBy] = await contract.getVersion(code, i);
      history.push({
        versionNumber: Number(versionNumber),
        dataHash: dataHash.replace(/^0x/, ''),
        timestamp: Number(timestamp),
        registeredBy,
      });
    }
    return history;
  } catch {
    return [];
  }
}

/**
 * Ghi vết phiên bản mới vào cơ sở dữ liệu và gọi Blockchain
 * @param {object} property - Dữ liệu hồ sơ BĐS đầy đủ
 * @param {object} options - { requireBlockchain: boolean }
 */
async function recordPropertyVersion(property, options = {}) {
  const { hash, canonicalData } = computePropertyHash(property);

  // 1. Lấy số phiên bản tiếp theo từ database
  const countRes = await pool.query(
    'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM property_versions WHERE property_id = $1',
    [property.id]
  );
  const nextVersion = countRes.rows[0].next_version;

  let txHash = null;
  let onChainError = null;

  // 2. Cố gắng ghi lên blockchain nếu có thể
  try {
    const onChainResult = await registerHashOnChain(property.code, hash);
    txHash = onChainResult.txHash;
  } catch (error) {
    onChainError = error.message;
    if (options.requireBlockchain) {
      throw error;
    }
  }

  // 3. Lưu vào bảng property_versions
  const insertRes = await pool.query(
    `INSERT INTO property_versions (property_id, version, data_json, data_hash, tx_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, now())
     RETURNING id, property_id, version, data_hash, tx_hash, created_at`,
    [property.id, nextVersion, JSON.stringify(canonicalData), hash, txHash]
  );

  return {
    versionRecord: insertRes.rows[0],
    dataHash: hash,
    txHash,
    onChain: !!txHash,
    onChainError,
  };
}

module.exports = {
  getContractAddress,
  getBlockchainClient,
  checkBlockchainConnection,
  stableStringify,
  buildCanonicalProperty,
  computePropertyHash,
  registerHashOnChain,
  getOnChainLatest,
  getOnChainHistory,
  recordPropertyVersion,
};

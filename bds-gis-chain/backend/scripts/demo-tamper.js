// Script kịch bản Demo cho Đức (Môn Blockchain):
// Minh họa phát hiện can thiệp dữ liệu trái phép (Tamper Detection)
// Cách chạy:
//   node backend/scripts/demo-tamper.js [code]
//   Ví dụ: node backend/scripts/demo-tamper.js BDS001

const pool = require('../src/db');
const { computePropertyHash, getOnChainLatest } = require('../src/blockchain');

async function main() {
  const code = process.argv[2] || 'BDS001';
  console.log('='.repeat(70));
  console.log(`  KỊCH BẢN DEMO XÁC MINH & PHÁT HIỆN SỬA ĐỔI DỮ LIỆU - MÃ ${code}`);
  console.log('='.repeat(70));

  // 1. Đọc dữ liệu từ DB
  const { rows } = await pool.query(
    `SELECT id, code, address, owner_name, area, type, price,
            ST_AsGeoJSON(boundary)::json AS boundary,
            ST_AsGeoJSON(location)::json AS location
     FROM properties WHERE code = $1`,
    [code]
  );

  if (!rows[0]) {
    console.error(`❌ Không tìm thấy hồ sơ ${code} trong database.`);
    process.exit(1);
  }

  const prop = rows[0];
  console.log('\n[BƯỚC 1] Dữ liệu hiện tại trong PostgreSQL:');
  console.log(` - Mã: ${prop.code}`);
  console.log(` - Chủ: ${prop.owner_name}`);
  console.log(` - Địa chỉ: ${prop.address}`);
  console.log(` - Diện tích: ${prop.area} m²`);
  console.log(` - Giá: ${prop.price} VND`);

  const { hash: currentHash, canonicalJson } = computePropertyHash(prop);
  console.log(`\n[BƯỚC 2] Tính mã băm SHA-256 (Canonical JSON):`);
  console.log(` - Hash DB: ${currentHash}`);

  // 2. Tra cứu on-chain
  console.log(`\n[BƯỚC 3] Tra cứu Smart Contract PropertyRegistry trên Hardhat:`);
  let onChain = null;
  try {
    onChain = await getOnChainLatest(code);
    if (onChain) {
      console.log(` - Hash trên Chain : ${onChain.dataHash}`);
      console.log(` - Phiên bản chain : #${onChain.versionNumber}`);
      console.log(` - Thời điểm ghi   : ${new Date(onChain.timestamp * 1000).toLocaleString('vi-VN')}`);
      console.log(` - Người ghi       : ${onChain.registeredBy}`);

      if (onChain.dataHash.toLowerCase() === currentHash.toLowerCase()) {
        console.log('\n✔ KẾT QUẢ: [MATCH] Dữ liệu toàn vẹn, hoàn toàn trùng khớp với Blockchain!');
      } else {
        console.log('\n⚠ KẾT QUẢ: [MODIFIED] Hash hiện tại KHÔNG khớp với Blockchain!');
        console.log('  => Dữ liệu đã bị sửa đổi trái phép trong CSDL!');
      }
    } else {
      console.log(' - Chưa có bản ghi nào trên Smart Contract cho mã này.');
      console.log(' - Hãy bấm "Đăng ký phiên bản lên Blockchain" trên web hoặc gọi API.');
    }
  } catch (err) {
    console.log(` - Không kết nối được node Hardhat: ${err.message}`);
    console.log(' - Gợi ý: Chạy "npx hardhat node" trong thư mục contracts.');
  }

  console.log('\n' + '='.repeat(70));
  console.log(' HƯỚNG DẪN DEMO SỬA TRỰC TIẾP DATABASE (TẠO CẢNH BÁO BỊ SỬA):');
  console.log(' 1. Mở psql hoặc pgAdmin, chạy:');
  console.log(`    UPDATE properties SET area = area + 1 WHERE code = '${code}';`);
  console.log(' 2. Mở trang web http://localhost:5173/verify, chọn ' + code);
  console.log(' 3. Quan sát thông báo CẢNH BÁO: PHÁT HIỆN HỒ SƠ ĐÃ BỊ CHỈNH SỬA!');
  console.log(' 4. Khôi phục lại:');
  console.log(`    UPDATE properties SET area = area - 1 WHERE code = '${code}';`);
  console.log('='.repeat(70) + '\n');

  await pool.end();
}

main().catch((err) => {
  console.error('Lỗi script demo:', err);
  process.exit(1);
});

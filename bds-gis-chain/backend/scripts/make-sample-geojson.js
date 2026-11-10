// Sinh file GeoJSON mẫu 100 thửa đất GIẢ để chạy thử ngay, trước khi bạn vẽ xong polygon bằng QGIS.
// Khi có dữ liệu QGIS thật, chỉ cần thay file data/properties.geojson (giữ đúng tên thuộc tính).
//
// Dùng:  node scripts/make-sample-geojson.js [vĩ_độ_tâm] [kinh_độ_tâm]
// Mặc định tâm ở khu vực nội thành Hà Nội; đổi sang phường của bạn bằng 2 tham số.
const fs = require('fs');
const path = require('path');

const centerLat = parseFloat(process.argv[2]) || 21.0285;
const centerLng = parseFloat(process.argv[3]) || 105.8542;

const N = 100;          // số thửa
const COLS = 10;        // lưới 10 x 10
const STEP_M = 70;      // khoảng cách giữa các ô lưới (mét) -> các thửa không chồng lên nhau

// Đổi mét -> độ. 1 độ vĩ ~ 111320 m; 1 độ kinh ~ 111320 * cos(vĩ độ) m.
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = 111320 * Math.cos((centerLat * Math.PI) / 180);

const TYPES = ['house', 'apartment', 'land', 'commercial'];
const STREETS = ['Phố Trần Hưng Đạo', 'Phố Hàng Bài', 'Phố Lê Thái Tổ', 'Phố Đinh Tiên Hoàng',
  'Phố Tràng Tiền', 'Phố Hàng Bông', 'Phố Lý Thường Kiệt', 'Phố Bà Triệu'];
const LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi'];
const MID = ['Văn', 'Thị', 'Minh', 'Quốc', 'Thu', 'Đức'];
const FIRST = ['An', 'Bình', 'Cường', 'Dung', 'Hà', 'Hùng', 'Lan', 'Nam', 'Phúc', 'Trang'];

// Số ngẫu nhiên có hạt giống cố định -> mỗi lần chạy ra cùng dữ liệu (dễ tái lập khi demo)
let seed = 20261110;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const features = [];
for (let i = 0; i < N; i++) {
  const row = Math.floor(i / COLS);
  const col = i % COLS;

  // Tâm thửa (mét) so với tâm khu vực, có xê dịch nhẹ
  const cx = (col - COLS / 2) * STEP_M + (rnd() - 0.5) * 10;
  const cy = (row - COLS / 2) * STEP_M + (rnd() - 0.5) * 10;
  const w = 12 + rnd() * 18;  // rộng 12-30 m
  const h = 15 + rnd() * 25;  // dài 15-40 m
  const ang = (rnd() - 0.5) * 0.4; // xoay nhẹ (radian) cho giống thửa thật

  // 4 góc hình chữ nhật đã xoay
  const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => {
    const rx = x * Math.cos(ang) - y * Math.sin(ang) + cx;
    const ry = x * Math.sin(ang) + y * Math.cos(ang) + cy;
    return [centerLng + rx / M_PER_DEG_LNG, centerLat + ry / M_PER_DEG_LAT];
  });
  corners.push(corners[0]); // polygon GeoJSON phải khép kín (điểm đầu = điểm cuối)

  // Diện tích hình chữ nhật (m2). Diện tích "nhập tay" lệch ngẫu nhiên -3%..+3%
  // để Bước 3 có ví dụ thực tế khi so sánh ST_Area với diện tích nhập tay.
  const trueArea = w * h;
  const manualArea = Math.round(trueArea * (0.97 + rnd() * 0.06) * 10) / 10;

  const type = pick(TYPES);
  const code = 'BDS' + String(i + 1).padStart(3, '0');
  features.push({
    type: 'Feature',
    properties: {
      code,
      owner_name: `${pick(LAST)} ${pick(MID)} ${pick(FIRST)}`, // tên GIẢ
      address: `${Math.floor(rnd() * 200) + 1} ${pick(STREETS)}`,
      type,
      area: manualArea,
      price: Math.round((manualArea * (20 + rnd() * 80) * 1e6) / 1e6) * 1e6, // giá giả lập (VND)
    },
    geometry: { type: 'Polygon', coordinates: [corners] },
  });
}

const outDir = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'properties.sample.geojson');
fs.writeFileSync(outFile, JSON.stringify({ type: 'FeatureCollection', features }, null, 2));
console.log(`Đã tạo ${features.length} thửa -> ${outFile}`);

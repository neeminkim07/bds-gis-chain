# Đồ án B: Quản lý & xác thực hồ sơ BĐS (GIS + Blockchain)

```
bds-gis-chain/
├── docker-compose.yml   # PostgreSQL + PostGIS
├── db/01_schema.sql     # tạo bảng + chỉ mục GiST
├── data/                # file GeoJSON (mẫu hoặc từ QGIS)
├── backend/             # Express + script nhập dữ liệu
├── frontend/            # React (Vite)
└── contracts/           # Hardhat (Bước 4)
```

## Chạy Bước 1

```bash
# 1. Bật database (lần đầu sẽ tự chạy db/01_schema.sql)
docker compose up -d

# 2. Cài backend, tạo .env
cd backend && npm install && cp .env.example .env

# 3. Tạo dữ liệu mẫu 100 thửa rồi nhập vào DB
npm run make-sample
npm run import

# 4. Kiểm tra dữ liệu
npm run check

# 5. Chạy server, mở http://localhost:4000/api/health
npm start
```

Frontend (terminal khác): `cd frontend && npm install && npm run dev` rồi mở http://localhost:5173

## Dùng dữ liệu QGIS của bạn

Xuất layer ra `data/properties.geojson` (EPSG:4326, kiểu Polygon, có các cột `code, owner_name, address, type, area, price`), rồi chạy lại `npm run import`. Script ưu tiên file này hơn file mẫu.

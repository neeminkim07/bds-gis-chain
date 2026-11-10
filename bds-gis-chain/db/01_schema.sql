-- =====================================================================
-- Bước 1: Lược đồ cơ sở dữ liệu cho hệ thống quản lý & xác thực hồ sơ BĐS
-- Chạy tự động khi container PostGIS khởi tạo lần đầu.
-- Chạy lại thủ công:  psql -U postgres -d bds_gis -f db/01_schema.sql
-- =====================================================================

-- Bật extension PostGIS: thêm kiểu geometry và hàng trăm hàm ST_*
CREATE EXTENSION IF NOT EXISTS postgis;

-- Xóa bảng cũ (nếu có) để chạy lại script nhiều lần được. CHỈ dùng khi phát triển.
DROP TABLE IF EXISTS property_versions;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- Bảng users: tài khoản đăng nhập (dùng ở Bước 2)
-- Mật khẩu KHÔNG lưu thô, chỉ lưu bcrypt hash trong password_hash.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(10)  NOT NULL DEFAULT 'User'
                  CHECK (role IN ('Admin', 'User')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Bảng properties: hồ sơ bất động sản
-- ---------------------------------------------------------------------
CREATE TABLE properties (
    id         SERIAL PRIMARY KEY,
    code       VARCHAR(20)   NOT NULL UNIQUE,          -- Mã BĐS, ví dụ BDS001 (cũng là khóa tra cứu trên blockchain)
    owner_name VARCHAR(100),                           -- Tên chủ (DỮ LIỆU GIẢ LẬP). Không bao giờ đưa lên chain.
    address    VARCHAR(255)  NOT NULL,
    area       NUMERIC(12,2) NOT NULL CHECK (area > 0),-- Diện tích nhập tay (m2), sẽ so với ST_Area ở Bước 3
    type       VARCHAR(20)   NOT NULL
               CHECK (type IN ('house', 'apartment', 'land', 'commercial')),
    price      NUMERIC(16,0) CHECK (price >= 0),       -- Giá giả lập (VND)
    -- Kiểu không gian. 4326 = WGS84 (kinh độ, vĩ độ), cùng hệ với GPS và Leaflet.
    location   geometry(Point, 4326),                  -- Tọa độ điểm đại diện (marker)
    boundary   geometry(Polygon, 4326),                -- Ranh giới thửa đất
    image_path VARCHAR(255),                           -- Ảnh (Bước 2)
    doc_path   VARCHAR(255),                           -- Hồ sơ đính kèm (Bước 2)
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Chỉ mục không gian GiST: giúp ST_DWithin, ST_Intersects, ST_Contains chạy nhanh
-- vì PostGIS lọc theo hộp bao (bounding box) trước, thay vì quét cả bảng.
CREATE INDEX idx_properties_location_gist ON properties USING GIST (location);
CREATE INDEX idx_properties_boundary_gist ON properties USING GIST (boundary);

-- Chỉ mục thường cho tìm kiếm / lọc ở Bước 2
CREATE INDEX idx_properties_type ON properties (type);
CREATE INDEX idx_properties_area ON properties (area);

-- ---------------------------------------------------------------------
-- Bảng property_versions: mỗi lần tạo/sửa hồ sơ sinh ra một phiên bản
--   data_json : bản chuẩn hóa của hồ sơ tại thời điểm đó
--   data_hash : SHA-256 (64 ký tự hex) của data_json -> đây là thứ được ghi lên blockchain
--   tx_hash   : mã giao dịch trên blockchain (NULL nếu chưa ghi được lên chain)
-- ---------------------------------------------------------------------
CREATE TABLE property_versions (
    id          SERIAL PRIMARY KEY,
    property_id INTEGER     NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    version     INTEGER     NOT NULL CHECK (version >= 1),
    data_json   JSONB       NOT NULL,
    data_hash   CHAR(64)    NOT NULL,
    tx_hash     VARCHAR(80),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (property_id, version)                      -- mỗi BĐS không có 2 phiên bản trùng số
);

CREATE INDEX idx_versions_property ON property_versions (property_id);

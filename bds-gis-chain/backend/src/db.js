// Kết nối PostgreSQL dùng chung cho cả server và các script.
// Dùng Pool: giữ sẵn vài kết nối để tái sử dụng, nhanh hơn mở kết nối mới mỗi request.
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bds_gis',
});

module.exports = pool;

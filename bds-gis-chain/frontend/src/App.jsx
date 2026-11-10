import React, { useEffect, useState } from 'react';

// Trang khởi đầu: gọi /api/health để xác nhận frontend -> backend -> PostGIS thông suốt.
export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError('Không gọi được backend (đã chạy "npm start" trong thư mục backend chưa?)'));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Quản lý BĐS: GIS + Blockchain</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {health && health.ok && (
        <p>
          Kết nối thành công. PostGIS {health.postgis}. Hiện có <b>{health.properties}</b> bất động sản.
        </p>
      )}
      {health && !health.ok && <p style={{ color: 'crimson' }}>{health.error}</p>}
    </div>
  );
}

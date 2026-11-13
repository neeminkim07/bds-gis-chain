import React from 'react';
import MainNavigation from '../components/MainNavigation.jsx';

const endpoints = [
  {
    method: 'GET', path: '/api/health', title: 'Kiểm tra backend và database', auth: false,
    description: 'Kiểm tra kết nối PostgreSQL/PostGIS và số hồ sơ hiện có.',
    response: `{
  "ok": true,
  "postgis": "...",
  "properties": 100
}`,
  },
  {
    method: 'POST', path: '/api/auth/register', title: 'Tạo tài khoản', auth: false,
    description: 'Tạo người dùng mới. Username dài 3–50 ký tự; password dài 12–128 ký tự. Email là trường tùy chọn theo backend hiện tại.',
    request: `{
  "username": "khiem",
  "password": "MatKhauThuNghiem123",
  "email": "khiem@example.com"
}`,
    response: `{
  "ok": true,
  "message": "Tạo tài khoản thành công",
  "data": {
    "user": { "id": 1, "username": "khiem", "email": "khiem@example.com", "role": "User" }
  }
}`,
    errors: '400 dữ liệu không hợp lệ · 409 username/email đã tồn tại',
  },
  {
    method: 'POST', path: '/api/auth/login', title: 'Đăng nhập', auth: false,
    description: 'Đăng nhập bằng username hoặc email cùng mật khẩu. Token có hạn 1 giờ.',
    request: `{
  "username": "khiem",
  "password": "MatKhauThuNghiem123"
}`,
    response: `{
  "ok": true,
  "token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": { "id": 1, "username": "khiem", "role": "User" }
}`,
    errors: '400 dữ liệu thiếu · 401 thông tin đăng nhập không đúng · 500 thiếu JWT_SECRET',
  },
  {
    method: 'GET', path: '/api/auth/me', title: 'Lấy tài khoản hiện tại', auth: true,
    description: 'Xác minh JWT và trả về thông tin tài khoản đang đăng nhập. Trang đăng nhập gọi endpoint này sau khi nhận token.',
    response: `{
  "ok": true,
  "data": {
    "user": { "id": 1, "username": "khiem", "role": "User" }
  }
}`,
    errors: '401 token thiếu, hết hạn hoặc không hợp lệ',
  },
  {
    method: 'PATCH', path: '/api/auth/me', title: 'Cập nhật hồ sơ cá nhân', auth: true,
    description: 'Cập nhật username/email hiện tại; role không được thay đổi từ form người dùng.',
    request: `{
  "username": "khiem_moi",
  "email": "khiem@example.com"
}`,
    response: `{
  "ok": true,
  "data": {
    "user": { "id": 1, "username": "khiem_moi", "email": "khiem@example.com", "role": "User" }
  }
}`,
    errors: '400 dữ liệu không hợp lệ · 401 token không hợp lệ · 409 username/email đã tồn tại',
  },
  {
    method: 'GET', path: '/api/users?page=1&limit=50&q=', title: 'Danh sách người dùng', auth: true,
    description: 'Chỉ Admin được xem. Tìm theo username/email, có phân trang. Response không chứa password hoặc password_hash.',
    response: `{
  "ok": true,
  "data": [
    { "id": 2, "username": "test_user_01", "email": "test_user_01@example.com", "role": "User", "created_at": "..." }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "pages": 1 }
}`,
    errors: '401 token không hợp lệ · 403 chỉ Admin được truy cập',
  },
  {
    method: 'POST', path: '/api/users', title: 'Tạo tài khoản (Admin)', auth: true,
    description: 'Admin tạo tài khoản với mật khẩu ban đầu; backend lưu mật khẩu dạng scrypt hash.',
    request: `{
  "username": "new_user",
  "email": "new@example.com",
  "password": "mat-khau-dai-hon-12",
  "role": "User",
  "wallet_address": ""
}`,
    response: `{
  "ok": true,
  "data": { "id": 12, "username": "new_user", "role": "User", "is_active": true }
}`,
    errors: '400 dữ liệu không hợp lệ · 403 chỉ Admin được truy cập · 409 username/email đã tồn tại',
  },
  {
    method: 'PATCH', path: '/api/users/:id', title: 'Sửa, phân quyền hoặc khóa tài khoản (Admin)', auth: true,
    description: 'Nhận một hoặc nhiều trường username, email, role, wallet_address, is_active. Tài khoản bị khóa mất quyền truy cập ngay.',
    request: `{
  "role": "Admin",
  "is_active": true,
  "wallet_address": "0x..."
}`,
    response: `{
  "ok": true,
  "data": { "id": 12, "username": "new_user", "role": "Admin", "is_active": true }
}`,
    errors: '400 dữ liệu không hợp lệ · 403 chỉ Admin · 409 nếu tác động tới Admin cuối cùng hoặc username/email trùng',
  },
  {
    method: 'DELETE', path: '/api/users/:id', title: 'Xóa tài khoản (Admin)', auth: true,
    description: 'Xóa tài khoản khỏi database. Không thể xóa tài khoản đang đăng nhập hoặc Admin cuối cùng còn hoạt động.',
    response: `{ "ok": true, "data": { "id": 12, "deleted": true } }`,
    errors: '403 chỉ Admin · 404 không tìm thấy · 409 không thể xóa chính mình hoặc Admin cuối cùng',
  },
];

function EndpointCard({ endpoint }) {
  const methodStyle = endpoint.method === 'GET'
    ? 'border-sky-300/20 bg-sky-300/[0.08] text-sky-200'
    : 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200';

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-panel/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md border px-2 py-1 font-mono text-[11px] font-semibold ${methodStyle}`}>{endpoint.method}</span>
        <code className="text-sm text-slate-100">{endpoint.path}</code>
        <span className={`ml-auto rounded-full border px-2.5 py-1 text-[10px] ${endpoint.auth ? 'border-amber-200/20 text-amber-100/80' : 'border-white/[0.08] text-slate-500'}`}>
          {endpoint.auth ? 'Bearer token' : 'Public'}
        </span>
      </div>
      <h2 className="mt-4 text-base font-medium text-white">{endpoint.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{endpoint.description}</p>
      <div className={`mt-4 grid gap-3 ${endpoint.request ? 'lg:grid-cols-2' : ''}`}>
        {endpoint.request && <CodeBlock title="Request JSON" value={endpoint.request} />}
        <CodeBlock title="Response JSON" value={endpoint.response} />
      </div>
      {endpoint.errors && <p className="mt-3 text-xs leading-5 text-slate-500">Lỗi thường gặp: {endpoint.errors}</p>}
    </article>
  );
}

function CodeBlock({ title, value }) {
  return <div className="min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0b0e14]">
    <div className="border-b border-white/[0.06] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">{title}</div>
    <pre className="overflow-x-auto p-3 text-xs leading-5 text-slate-300">{value}</pre>
  </div>;
}

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-7 lg:px-10">
        <MainNavigation />

        <section className="mb-8 mt-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Tài liệu tích hợp</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">API hiện có</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Các endpoint dưới đây được đối chiếu với backend hiện tại. Trong môi trường phát triển, frontend gọi cùng origin và Vite chuyển tiếp `/api` tới `http://localhost:4000`.</p>
        </section>

        <div className="mb-6 rounded-xl border border-indigo-200/15 bg-indigo-200/[0.04] p-4 text-sm leading-6 text-indigo-100/80">
          <strong className="font-medium text-indigo-100">Trạng thái:</strong> Các endpoint hiển thị ở đây đã được nối trong backend. API quản lý tài khoản chỉ dành cho Admin; tạo/sửa/khóa/xóa được lưu trực tiếp vào PostgreSQL.
        </div>

        <section className="space-y-4" aria-label="Danh sách API">
          {endpoints.map((endpoint) => <EndpointCard key={`${endpoint.method}-${endpoint.path}`} endpoint={endpoint} />)}
        </section>

        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-panel/70 p-5 sm:p-6">
          <h2 className="text-sm font-medium text-white">Gọi endpoint cần đăng nhập</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Gửi JWT nhận từ API đăng nhập trong header Authorization:</p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0b0e14] p-3 text-xs leading-5 text-indigo-100">{`Authorization: Bearer <JWT>`}</pre>
        </section>
      </div>
    </main>
  );
}

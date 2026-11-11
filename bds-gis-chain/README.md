# BĐS GIS + Blockchain

Backend hiện dùng Express, PostgreSQL/PostGIS (`pg`) và JWT bearer token. Mật khẩu được băm bằng Node.js `crypto.scrypt`; role được lưu trong bảng `users` với hai giá trị `Admin`/`User`.

## Khởi chạy backend

```powershell
Copy-Item backend/.env.example backend/.env
cd backend
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
# Dán secret vừa tạo vào JWT_SECRET trong backend/.env.
npm install
npm start
```

`JWT_SECRET` cần là chuỗi ngẫu nhiên ít nhất 32 ký tự. Backend luôn đọc file `backend/.env` theo đường dẫn của mã nguồn, kể cả khi tiến trình được khởi chạy từ thư mục gốc; biến môi trường của hệ thống được ưu tiên nếu đã đặt. Không dùng giá trị placeholder trong môi trường chia sẻ.

PostgreSQL mặc định được Compose mở ở `localhost:5431`:

```powershell
docker compose up -d
```

Schema tự chạy khi tạo volume lần đầu. Với database/volume đã tồn tại, áp dụng migration an toàn để thêm cột email/index mà không xóa dữ liệu bằng `psql -U postgres -d bds_gis -f db/01_schema.sql` từ thư mục dự án (hoặc chạy nội dung file qua công cụ quản trị DB). Script schema không còn `DROP TABLE` và có thể chạy lại.

## API xác thực

### Đăng ký

`POST /api/auth/register` là public. Tương thích form hiện tại với `username` và `password`; có thể gửi thêm `email`. Username được chuẩn hóa chữ thường và duy nhất không phân biệt hoa/thường. Nếu có email, API chuẩn hóa chữ thường, kiểm tra định dạng và bảo đảm duy nhất. Email tùy chọn để giữ tương thích schema và client hiện tại chỉ gửi username. Mọi tài khoản đăng ký mới luôn có role `User`; trường `role` trong request bị bỏ qua.

```json
{
  "username": "khiem",
  "email": "khiem@example.com",
  "password": "a-long-password-12"
}
```

Mật khẩu dài 12–128 ký tự. Thành công trả HTTP 201:

```json
{
  "ok": true,
  "message": "Tạo tài khoản thành công",
  "data": { "user": { "id": 1, "username": "khiem", "email": "khiem@example.com", "role": "User", "created_at": "..." } }
}
```

Email hoặc username trùng trả HTTP 409; dữ liệu sai trả HTTP 400. Mật khẩu/hash không có trong response. API không có endpoint công khai tạo/nâng Admin.

### Đăng nhập

`POST /api/auth/login` là public. Gửi `username` (có thể là email) và `password`; response token được trả ở top-level `token` để tương thích `frontend/src/pages/AuthPage.jsx`:

```json
{
  "ok": true,
  "message": "Đăng nhập thành công",
  "token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": { "id": 1, "username": "khiem", "email": "khiem@example.com", "role": "User" }
}
```

Sai thông tin hoặc tài khoản có role không hợp lệ trả HTTP 401 với thông báo chung. Token HS256 hết hạn sau một giờ; gửi cho API được bảo vệ bằng `Authorization: Bearer <JWT>`.

### Quyền truy cập

| Endpoint/nhóm | Quyền |
|---|---|
| `GET /api/health` | Public |
| `POST /api/auth/register` | Public |
| `POST /api/auth/login` | Public |
| `GET /api/auth/me` | User hoặc Admin, cần Bearer token |
| Các route `/api/*` khác | Cần Bearer token mặc định |
| `/api/admin/*` | Bearer token + role Admin |

Tại repo hiện tại, backend chỉ có health endpoint; chưa có route CRUD/GIS trong `server.js`. Các API khác đã bị chặn mặc định; namespace `/api/admin/*` yêu cầu role Admin. Middleware `requireAuth` và `requireRole` sẵn để gắn lên các route CRUD/GIS khi chúng được tích hợp. Không có tài khoản Admin mặc định hoặc API tự nâng quyền; Admin phải được cấp bởi người vận hành qua kênh quản trị database. Thay đổi role có hiệu lực khi token cũ hết hạn (tối đa một giờ), vì role nằm trong JWT.

Lỗi API dùng dạng `{ "ok": false, "error": { "code": "...", "message": "..." } }`. Lỗi database trả thông báo chung và không lộ query/credential.

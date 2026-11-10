import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api sang backend để frontend gọi "/api/..." mà không dính lỗi CORS khi phát triển
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});

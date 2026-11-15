import React from 'react';
import './index.css';
import GISMapPage from './pages/GISMapPage.jsx';
import PropertyManagementPage from './pages/PropertyManagementPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ApiDocsPage from './pages/ApiDocsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import MainNavigation from './components/MainNavigation.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import { getCachedUser } from './lib/authSession.js';

const destinations = [
  {
    number: '01',
    title: 'Bản đồ GIS',
    description: 'Khám phá vị trí, ranh giới và thông tin các bất động sản trên bản đồ.',
    href: '/gis',
    label: 'Không gian',
    icon: 'map',
  },
  {
    number: '02',
    title: 'Quản lý hồ sơ BĐS',
    description: 'Tạo, xem và cập nhật hồ sơ bất động sản trong hệ thống.',
    href: '/properties',
    label: 'Hồ sơ',
    icon: 'building',
  },
  {
    number: '03',
    title: 'Kiểm tra tính toàn vẹn',
    description: 'Xem dấu vân tay dữ liệu của hồ sơ. Đối chiếu blockchain sẽ khả dụng sau khi được kết nối.',
    href: '/verify',
    label: 'Đang hoàn thiện',
    icon: 'chain',
  },
  {
    number: '04',
    title: 'Quản trị tài khoản',
    description: 'Quản lý tài khoản, vai trò và trạng thái truy cập.',
    href: '/users',
    label: 'Chỉ dành cho Admin',
    icon: 'users',
  },
  {
    number: '05',
    title: 'Tài liệu tích hợp',
    description: 'Hướng dẫn kỹ thuật dành cho nhóm phát triển và tích hợp hệ thống.',
    href: '/api-docs',
    label: 'Tích hợp',
    icon: 'code',
  },
];

function FeatureIcon({ name }) {
  const paths = {
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
    building: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4" /></>,
    chain: <><path d="M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93l-1.72 1.72" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.72-1.72" /></>,
    code: <><path d="m8 17-5-5 5-5M16 7l5 5-5 5M14 4l-4 16" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      {paths[name]}
    </svg>
  );
}

function LandingPage() {
  const user = getCachedUser();
  const visibleDestinations = destinations.filter((item) => item.href !== '/users' || user?.role === 'Admin');
  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_50%_-15%,rgba(88,130,89,0.15),transparent_64%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-4 sm:px-7 lg:px-10">
        <MainNavigation mode="landing" rightSlot={<span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />Hệ thống quản lý hồ sơ</span>} />

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1fr_0.85fr] lg:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />Không gian quản lý bất động sản</div>
            <h1 className="mt-7 text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl">Dữ liệu tài sản,<span className="mt-2 block text-indigo-600">trên một bản đồ rõ ràng.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600">Tra cứu hồ sơ, xem ranh giới trên bản đồ và quản lý thông tin tập trung trong một không gian làm việc rõ ràng.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={user ? '/dashboard' : '/login'} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold !text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700">{user ? 'Mở tổng quan' : 'Đăng nhập'}<span aria-hidden="true">→</span></a>
              <a href="/gis" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700">Khám phá bản đồ</a>
            </div>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-slate-200 pt-5">{[['Hồ sơ tập trung', 'Tra cứu thuận tiện'], ['Bản đồ trực quan', 'Xem theo vị trí'], ['Phân quyền rõ ràng', 'Theo vai trò tài khoản']].map(([title, caption]) => <div key={title}><p className="text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 text-[11px] text-slate-500">{caption}</p></div>)}</div>
          </div>

          <div>
            <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">Bắt đầu tại đây</p><h2 className="mt-1 text-xl font-semibold text-slate-900">Chọn một chức năng</h2></div><span className="text-xs text-slate-500">{visibleDestinations.length} mục</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
            {visibleDestinations.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-900/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700 transition group-hover:bg-indigo-100">
                    <FeatureIcon name={item.icon} />
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-slate-400">{item.number}</span>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                  <span aria-hidden="true" className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600">↗</span>
                </div>
                <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{item.description}</p>
                <span className="mt-4 inline-flex rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">{item.label}</span>
              </a>
            ))}
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>GIS-CHAIN · Hệ thống quản lý và xác thực hồ sơ BĐS</span>
          <span>GIS · Hồ sơ · Không gian địa lý</span>
        </footer>
      </div>
    </main>
  );
}

function ComingSoon({ path }) {
  const page = destinations.find((item) => item.href === path);
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 text-slate-100">
      <section className="w-full max-w-lg rounded-2xl border border-line bg-panel p-8 sm:p-10">
        <span className="text-xs uppercase tracking-[0.18em] text-indigo-200">GIS-CHAIN · {page?.label ?? 'Module'}</span>
        <h1 className="mt-4 text-2xl font-medium">{page?.title ?? 'Trang chưa được cấu hình'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Module này chưa có trang chức năng. Có thể nối component tương ứng vào route này khi giao diện được triển khai.</p>
        <a href="/" className="mt-7 inline-flex rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-indigo-200">Về trang chủ</a>
      </section>
    </main>
  );
}

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/gis') return <GISMapPage />;
  if (path === '/properties') return <PropertyManagementPage />;
  if (path.startsWith('/properties/')) {
    const detailCode = decodeURIComponent(path.slice('/properties/'.length));
    return <PropertyManagementPage detailCode={detailCode} />;
  }
  if (path === '/dashboard') return <DashboardPage />;
  if (path === '/login') return <AuthPage initialMode="login" />;
  if (path === '/register') return <AuthPage initialMode="register" />;
  if (path === '/api-docs') return <ApiDocsPage />;
  if (path === '/profile') return <ProfilePage />;
  if (path === '/verify') return <VerifyPage />;
  if (path === '/notifications') return <NotificationsPage />;
  if (path === '/users') return <UsersPage />;
  return path === '/' ? <LandingPage /> : <ComingSoon path={path} />;
}

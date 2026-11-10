import React from 'react';
import './index.css';

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
    title: 'Xác thực Blockchain',
    description: 'Kiểm tra hash và lịch sử xác thực của một hồ sơ bất động sản.',
    href: '/verify',
    label: 'Toàn vẹn dữ liệu',
    icon: 'chain',
  },
  {
    number: '04',
    title: 'API Docs',
    description: 'Tài liệu endpoint dành cho frontend và các dịch vụ tích hợp.',
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
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      {paths[name]}
    </svg>
  );
}

function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-15%,rgba(110,128,255,0.15),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-8 pt-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/[0.08] pb-5">
          <a href="/" className="flex items-center gap-3" aria-label="GIS Chain, về trang chủ">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-sm font-semibold tracking-tight text-indigo-200">GC</span>
            <span>
              <span className="block text-sm font-semibold tracking-wide text-white">GIS-CHAIN</span>
              <span className="mt-0.5 block text-[11px] tracking-[0.16em] text-slate-500">BẤT ĐỘNG SẢN</span>
            </span>
          </a>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
            Môi trường demo
          </span>
        </header>

        <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-16 sm:py-20">
          <div className="mb-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-indigo-200/80">
            <span className="h-px w-8 bg-indigo-300/50" />
            Không gian làm việc
          </div>
          <h1 className="max-w-3xl text-4xl font-medium leading-[1.12] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
            Quản lý bất động sản
            <span className="mt-2 block text-slate-400">trên một nền tảng thống nhất.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Truy cập bản đồ không gian, hồ sơ tài sản và công cụ xác thực dữ liệu từ một nơi.
            Giao diện hiện dùng dữ liệu mẫu trong giai đoạn phát triển.
          </p>

          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {destinations.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-line bg-panel/80 p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/40 hover:bg-[#151925] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-indigo-200 transition group-hover:border-indigo-300/20 group-hover:bg-indigo-300/10">
                    <FeatureIcon name={item.icon} />
                  </span>
                  <span className="font-mono text-xs text-slate-600">{item.number}</span>
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <h2 className="text-base font-medium text-slate-100">{item.title}</h2>
                  <span aria-hidden="true" className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-indigo-200">↗</span>
                </div>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">{item.description}</p>
                <span className="mt-5 inline-flex rounded-full border border-white/[0.08] px-2.5 py-1 text-[11px] text-slate-500">{item.label}</span>
              </a>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" />Các module đang được phát triển</span>
            <span>React · Tailwind CSS · PostGIS · Blockchain</span>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/[0.08] pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>GIS-CHAIN · Hệ thống quản lý và xác thực hồ sơ BĐS</span>
          <span>Development workspace</span>
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
  return path === '/' ? <LandingPage /> : <ComingSoon path={path} />;
}

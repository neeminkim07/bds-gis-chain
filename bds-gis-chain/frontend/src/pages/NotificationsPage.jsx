import React from 'react';
import MainNavigation from '../components/MainNavigation.jsx';
import PageGuide from '../components/PageGuide.jsx';

export default function NotificationsPage() {
  return <main className="min-h-screen bg-canvas text-slate-100">
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-7 lg:px-10">
      <MainNavigation />

      <section className="mt-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Trung tâm cập nhật</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Thông báo</h1>
        <p className="mt-2 text-sm text-slate-400">Các cập nhật liên quan tới tài khoản và hồ sơ sẽ được tập hợp tại đây.</p>
      </section>

      <PageGuide steps={['Mở chuông thông báo trên thanh điều hướng để xem cập nhật mới.', 'Thông báo sẽ hiển thị ở trang này khi backend cung cấp dịch vụ thông báo.', 'Nếu đang tìm hồ sơ hoặc dữ liệu, tiếp tục từ Tổng quan hoặc Bất động sản.']} note="Thông báo nghiệp vụ chưa khả dụng vì backend hiện chưa có API thông báo." />

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm sm:px-10" aria-live="polite">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
        </span>
        <h2 className="mt-5 text-lg font-semibold text-slate-900">Chưa có thông báo</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">Khi có thông báo được gửi từ hệ thống, nội dung và thời gian cập nhật sẽ xuất hiện tại đây.</p>
        <a href="/dashboard" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold !text-white shadow-sm transition hover:bg-indigo-700">Về Tổng quan</a>
      </section>
    </div>
  </main>;
}

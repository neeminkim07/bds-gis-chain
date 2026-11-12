import React, { useEffect, useMemo, useState } from 'react';
import MainNavigation from '../components/MainNavigation.jsx';
import { DEMO_NOTIFICATIONS_CHANGED, loadDemoNotifications, markAllDemoNotificationsRead, setDemoNotificationRead } from '../lib/demoNotifications.js';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(loadDemoNotifications);
  const [filter, setFilter] = useState('all');
  const unreadCount = notifications.filter((item) => !item.read).length;
  const filtered = useMemo(() => filter === 'unread' ? notifications.filter((item) => !item.read) : notifications, [filter, notifications]);

  useEffect(() => {
    const sync = (event) => setNotifications(event.detail || loadDemoNotifications());
    window.addEventListener(DEMO_NOTIFICATIONS_CHANGED, sync);
    return () => window.removeEventListener(DEMO_NOTIFICATIONS_CHANGED, sync);
  }, []);

  return <main className="min-h-screen bg-canvas text-slate-100">
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-7 lg:px-10">
      <MainNavigation />

      <section className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Trung tâm cập nhật</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Thông báo</h1><p className="mt-2 text-sm text-slate-400">{unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã xem hết thông báo.'}</p></div>
        {unreadCount > 0 && <button type="button" onClick={markAllDemoNotificationsRead} className="rounded-lg border border-white/[0.1] px-3.5 py-2.5 text-sm text-slate-300 transition hover:border-white/20 hover:text-white">Đánh dấu tất cả đã đọc</button>}
      </section>

      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3"><p className="text-xs leading-5 text-amber-100/75">Thông báo mẫu, lưu trong trình duyệt này. Chưa có API thông báo từ backend.</p><span className="shrink-0 rounded-full border border-amber-200/15 px-2 py-0.5 text-[10px] text-amber-100/80">DEMO</span></div>

      <div className="mt-5 flex gap-2" role="group" aria-label="Lọc thông báo">
        {[['all', 'Tất cả'], ['unread', 'Chưa đọc']].map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-2 text-xs transition ${filter === key ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}>{label}{key === 'unread' && unreadCount > 0 ? ` · ${unreadCount}` : ''}</button>)}
      </div>

      <section className="mt-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70" aria-label="Danh sách thông báo">
        {filtered.length ? filtered.map((item) => <article key={item.id} className={`flex gap-4 border-b border-white/[0.06] p-5 last:border-0 ${item.read ? '' : 'bg-indigo-300/[0.025]'}`}>
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? 'bg-slate-700' : 'bg-indigo-300'}`} aria-label={item.read ? 'Đã đọc' : 'Chưa đọc'} />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-medium text-slate-100">{item.title}</h2><span className="rounded-full border border-amber-200/10 px-2 py-0.5 text-[9px] text-amber-100/60">Demo</span></div><p className="mt-1.5 text-sm leading-6 text-slate-400">{item.body}</p><p className="mt-2 text-[11px] text-slate-600">{item.time}</p></div>
          <button type="button" onClick={() => setDemoNotificationRead(item.id, !item.read)} className="shrink-0 self-center rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-slate-400 transition hover:border-indigo-200/20 hover:text-indigo-100">{item.read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}</button>
        </article>) : <div className="px-5 py-16 text-center"><h2 className="text-sm font-medium text-slate-300">Không có thông báo trong bộ lọc này</h2><p className="mt-1 text-xs text-slate-500">Khi có cập nhật mới, thông báo sẽ xuất hiện ở đây.</p></div>}
      </section>
    </div>
  </main>;
}

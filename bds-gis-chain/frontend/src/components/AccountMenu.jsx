import React, { useEffect, useState } from 'react';
import { AUTH_CHANGED_EVENT, clearAuthSession, fetchCurrentUser, getAuthToken } from '../lib/authSession.js';
import { DEMO_NOTIFICATIONS_CHANGED, loadDemoNotifications, markAllDemoNotificationsRead } from '../lib/demoNotifications.js';

function avatarLetters(username = '') {
  const words = username.trim().split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : username.slice(0, 2)).toUpperCase() || 'GC';
}

export default function AccountMenu() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(loadDemoNotifications);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      const token = getAuthToken();
      if (!token) { if (active) setUser(null); return; }
      try {
        const currentUser = await fetchCurrentUser(token);
        if (active) setUser(currentUser);
      } catch {
        clearAuthSession();
        if (active) setUser(null);
      }
    };
    const handleAuthChanged = (event) => {
      setUser(event.detail || null);
      setMenuOpen(false);
      setNotificationsOpen(false);
    };
    loadUser();
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => { active = false; window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged); };
  }, []);

  useEffect(() => {
    const syncNotifications = (event) => setNotifications(event.detail || loadDemoNotifications());
    window.addEventListener(DEMO_NOTIFICATIONS_CHANGED, syncNotifications);
    return () => window.removeEventListener(DEMO_NOTIFICATIONS_CHANGED, syncNotifications);
  }, []);

  if (!user) return <div className="flex items-center gap-2">
    <a href="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:text-white">Đăng nhập</a>
    <a href="/register" className="rounded-lg border border-indigo-300/30 bg-indigo-300/10 px-3 py-2 text-sm text-indigo-100 transition hover:bg-indigo-300/15">Đăng ký</a>
  </div>;

  function logout() {
    clearAuthSession();
    window.location.assign('/login');
  }

  return <div className="relative flex items-center gap-2">
    <div className="relative">
      <button type="button" aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setMenuOpen(false); }} className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border border-[#11141c] bg-indigo-300 px-1 text-[9px] font-semibold text-slate-950">{unreadCount}</span>}
      </button>
      {notificationsOpen && <div className="absolute right-0 z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#11141c] shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3"><h2 className="text-sm font-medium text-white">Thông báo</h2><button type="button" onClick={markAllDemoNotificationsRead} className="text-[10px] text-indigo-200 hover:text-white">Đọc tất cả</button></div>
        {notifications.slice(0, 3).map((item) => <article key={item.id} className={`border-b border-white/[0.05] px-4 py-3 last:border-0 ${item.read ? '' : 'bg-indigo-300/[0.025]'}`}><div className="flex items-start gap-2"><span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.read ? 'bg-slate-700' : 'bg-indigo-300'}`} /><div><h3 className="text-xs font-medium text-slate-200">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{item.body}</p><p className="mt-1.5 text-[10px] text-slate-600">{item.time}</p></div></div></article>)}
        <a href="/notifications" className="block border-t border-white/[0.06] px-4 py-3 text-center text-xs text-indigo-200 transition hover:bg-white/[0.03]">Xem tất cả thông báo</a>
      </div>}
    </div>

    <div className="relative">
      <button type="button" aria-expanded={menuOpen} onClick={() => { setMenuOpen((open) => !open); setNotificationsOpen(false); }} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1.5 pl-1.5 pr-3 transition hover:bg-white/[0.07]">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-300 text-[10px] font-bold text-slate-950">{avatarLetters(user.username)}</span>
        <span className="max-w-28 truncate text-xs font-medium text-slate-200">{user.username}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`h-3.5 w-3.5 text-slate-500 transition ${menuOpen ? 'rotate-180' : ''}`}><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {menuOpen && <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-white/[0.1] bg-[#11141c] p-1.5 shadow-2xl shadow-black/40">
        <div className="border-b border-white/[0.07] px-3 py-2.5"><p className="truncate text-xs font-medium text-white">{user.username}</p><p className="mt-1 text-[10px] text-slate-500">Vai trò: {user.role || 'User'}</p></div>
        <a href="/profile" className="mt-1 block rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white">Thông tin cá nhân</a>
        <button type="button" onClick={logout} className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-200 transition hover:bg-rose-300/[0.08]">Đăng xuất</button>
      </div>}
    </div>
  </div>;
}

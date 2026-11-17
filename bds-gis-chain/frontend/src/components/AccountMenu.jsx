import React, { useEffect, useState } from 'react';
import { AUTH_CHANGED_EVENT, clearAuthSession, fetchCurrentUser, getAuthToken } from '../lib/authSession.js';

function avatarLetters(username = '') {
  const words = username.trim().split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : username.slice(0, 2)).toUpperCase() || 'GC';
}

export default function AccountMenu() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  if (!user) return <div className="flex items-center gap-2">
    <a href="/login" className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:text-indigo-700">Đăng nhập</a>
    <a href="/register" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold !text-white shadow-md shadow-indigo-600/15 transition hover:bg-indigo-700">Đăng ký</a>
  </div>;

  function logout() {
    clearAuthSession();
    window.location.assign('/login');
  }

  return <div className="relative flex items-center gap-2">
    <div className="relative">
      <button type="button" aria-label="Thông báo" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setMenuOpen(false); }} className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-indigo-700">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
      </button>
      {notificationsOpen && <div className="absolute right-0 z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Thông báo</h2></div>
        <p className="px-4 py-5 text-xs leading-5 text-slate-600">Trung tâm thông báo đang được hoàn thiện. Khi tính năng được bật, cập nhật sẽ xuất hiện tại đây.</p>
        <a href="/notifications" className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-medium text-indigo-700 transition hover:bg-slate-50">Xem tất cả thông báo</a>
      </div>}
    </div>

    <div className="relative">
      <button type="button" aria-expanded={menuOpen} onClick={() => { setMenuOpen((open) => !open); setNotificationsOpen(false); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition hover:bg-slate-50">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-100 text-[10px] font-bold text-indigo-700">{avatarLetters(user.username)}</span>
        <span className="max-w-28 truncate text-xs font-semibold text-slate-700">{user.username}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`h-3.5 w-3.5 text-slate-500 transition ${menuOpen ? 'rotate-180' : ''}`}><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {menuOpen && <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
        <div className="border-b border-slate-100 px-3 py-2.5"><p className="truncate text-xs font-semibold text-slate-900">{user.username}</p><p className="mt-1 text-[10px] text-slate-500">Vai trò: {user.role || 'User'}</p></div>
        <a href="/profile" className="mt-1 block rounded-lg px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">Thông tin cá nhân</a>
        <button type="button" onClick={logout} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50">Đăng xuất</button>
      </div>}
    </div>
  </div>;
}

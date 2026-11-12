import React, { useEffect, useState } from 'react';
import MainNavigation from '../components/MainNavigation.jsx';
import { fetchCurrentUser, getAuthToken, saveAuthSession } from '../lib/authSession.js';

function initialLetters(username = '') {
  return username.slice(0, 2).toUpperCase() || 'GC';
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ username: '', email: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return undefined;
    }
    fetchCurrentUser(token)
      .then((user) => {
        if (!active) return;
        setProfile(user);
        setForm({ username: user.username || '', email: user.email || '' });
      })
      .catch((error) => {
        if (active) setMessage({ ok: false, text: error.message || 'Không tải được thông tin tài khoản.' });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAttempt]);

  async function saveProfile(event) {
    event.preventDefault();
    const token = getAuthToken();
    if (!token) {
      setMessage({ ok: false, text: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: form.username.trim(), email: form.email.trim() || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fallback = response.status === 404
          ? 'Backend hiện chưa có PATCH /api/auth/me. Giao diện đã sẵn sàng; Đạt cần bổ sung API cập nhật hồ sơ.'
          : `Không lưu được hồ sơ (HTTP ${response.status}).`;
        throw new Error(response.status === 404 ? fallback : (data?.message || data?.error?.message || fallback));
      }
      const nextUser = data?.data?.user || data?.user || { ...profile, username: form.username.trim(), email: form.email.trim() };
      setProfile(nextUser);
      setForm({ username: nextUser.username || '', email: nextUser.email || '' });
      saveAuthSession(token, nextUser);
      setEditing(false);
      setMessage({ ok: true, text: data?.message || 'Đã cập nhật hồ sơ.' });
    } catch (error) {
      setMessage({ ok: false, text: error.message || 'Không gọi được API cập nhật hồ sơ.' });
    } finally {
      setSaving(false);
    }
  }

  return <main className="min-h-screen bg-canvas text-slate-100">
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-7 lg:px-10">
      <MainNavigation />

      <section className="mt-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Cài đặt tài khoản</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Thông tin cá nhân</h1>
        <p className="mt-2 text-sm text-slate-400">Xem và chỉnh sửa thông tin gắn với tài khoản GIS-CHAIN.</p>
      </section>

      {loading ? <div className="mt-8 rounded-2xl border border-white/[0.08] bg-panel/70 p-8 text-sm text-slate-400">Đang tải thông tin tài khoản…</div>
        : !profile ? <section className="mt-8 rounded-2xl border border-white/[0.08] bg-panel/70 p-8">
          <h2 className="text-lg font-medium text-white">{getAuthToken() ? 'Không tải được hồ sơ' : 'Cần đăng nhập'}</h2>
          <p className="mt-2 text-sm text-slate-400">{getAuthToken() ? 'Không lấy được thông tin từ API. Kiểm tra backend hoặc phiên đăng nhập rồi thử lại.' : 'Đăng nhập để xem và chỉnh sửa thông tin tài khoản.'}</p>
          {message && <p role="alert" className="mt-3 text-xs text-amber-100/80">{message.text}</p>}
          {getAuthToken() ? <button type="button" onClick={() => { setLoading(true); setMessage(null); setLoadAttempt((attempt) => attempt + 1); }} className="mt-5 inline-flex rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-indigo-200">Thử tải lại</button> : <a href="/login" className="mt-5 inline-flex rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-indigo-200">Đăng nhập</a>}
        </section>
          : <section className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
            <div className="flex flex-wrap items-center gap-5 border-b border-white/[0.07] p-6 sm:p-8">
              <span className="grid h-20 w-20 place-items-center rounded-3xl border border-indigo-200/20 bg-indigo-300/10 text-2xl font-semibold text-indigo-100">{initialLetters(profile.username)}</span>
              <div><h2 className="text-xl font-medium text-white">{profile.username}</h2><p className="mt-1 text-sm text-slate-400">{profile.email || 'Chưa thêm email'}</p><span className="mt-3 inline-flex rounded-full border border-white/[0.1] px-2.5 py-1 text-[11px] text-slate-400">Vai trò: {profile.role || 'User'}</span></div>
              {!editing && <button type="button" onClick={() => { setForm({ username: profile.username || '', email: profile.email || '' }); setMessage(null); setEditing(true); }} className="ml-auto rounded-lg border border-white/[0.1] px-3.5 py-2.5 text-sm text-slate-200 transition hover:border-indigo-200/30 hover:text-white">Chỉnh sửa hồ sơ</button>}
            </div>

            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_0.75fr]">
              <div>
                <div className="flex items-center justify-between"><h3 className="text-sm font-medium text-white">Thông tin tài khoản</h3>{!editing && <span className="text-[11px] text-slate-600">ID: {profile.id ?? '—'}</span>}</div>
                {editing ? <form onSubmit={saveProfile} className="mt-5 space-y-4">
                  <label className="block text-xs text-slate-400">Tên đăng nhập<input required minLength={3} maxLength={50} value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 text-sm text-white outline-none focus:border-indigo-300/50" /></label>
                  <label className="block text-xs text-slate-400">Email (không bắt buộc)<input type="email" maxLength={254} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="ten@example.com" className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
                  <div className="flex flex-wrap gap-2 pt-1"><button disabled={saving} type="submit" className="rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-indigo-200 disabled:opacity-60">{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button><button type="button" onClick={() => { setEditing(false); setMessage(null); }} className="rounded-lg border border-white/[0.1] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]">Hủy</button></div>
                </form> : <dl className="mt-5 space-y-4">
                  <div className="border-b border-white/[0.06] pb-3"><dt className="text-xs text-slate-500">Tên đăng nhập</dt><dd className="mt-1.5 text-sm text-slate-200">{profile.username}</dd></div>
                  <div className="border-b border-white/[0.06] pb-3"><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1.5 text-sm text-slate-200">{profile.email || 'Chưa cập nhật'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Quyền truy cập</dt><dd className="mt-1.5 text-sm text-slate-200">{profile.role || 'User'}</dd></div>
                </dl>}
                {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-4 rounded-lg border px-3 py-2.5 text-xs leading-5 ${message.ok ? 'border-emerald-200/15 bg-emerald-200/[0.04] text-emerald-100/80' : 'border-amber-200/15 bg-amber-200/[0.04] text-amber-100/80'}`}>{message.text}</p>}
              </div>

              <aside className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between"><h3 className="text-sm font-medium text-white">Thông báo</h3><span className="rounded-full border border-amber-200/15 px-2 py-0.5 text-[10px] text-amber-100/70">Demo</span></div>
                <div className="mt-4 space-y-4">
                  <article className="border-b border-white/[0.06] pb-4"><p className="text-xs font-medium text-slate-200">Tài khoản đã đăng nhập</p><p className="mt-1 text-xs leading-5 text-slate-400">Phiên đăng nhập được xác nhận qua API `/api/auth/me`.</p></article>
                  <article><p className="text-xs font-medium text-slate-200">Khu vực thông báo</p><p className="mt-1 text-xs leading-5 text-slate-400">Thông báo hiện là dữ liệu minh họa; backend chưa có API thông báo.</p></article>
                </div>
              </aside>
            </div>
          </section>}
    </div>
  </main>;
}

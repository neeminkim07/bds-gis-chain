import React, { useCallback, useEffect, useState } from 'react';
import MainNavigation from '../components/MainNavigation.jsx';
import { getAuthToken, getCachedUser } from '../lib/authSession.js';

const PAGE_SIZE = 50;
const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' });
const emptyForm = { username: '', email: '', password: '', role: 'User', wallet_address: '' };

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : '—';
}

async function userApi(path, options = {}) {
  const token = getAuthToken();
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại bằng Admin.');
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || body?.message || `API trả về HTTP ${response.status}.`);
  return body;
}

export default function UsersPage() {
  const currentUser = getCachedUser();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [reloadKey, setReloadKey] = useState(0);

  const loadUsers = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (query.trim()) params.set('q', query.trim());
      const body = await userApi(`/api/users?${params}`, { signal });
      if (signal?.aborted) return;
      setUsers(Array.isArray(body.data) ? body.data : []);
      setPagination(body.pagination || { page, limit: PAGE_SIZE, total: 0, pages: 0 });
    } catch (fetchError) {
      if (!signal?.aborted) setError(fetchError.message || 'Không tải được danh sách người dùng.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadUsers(controller.signal), 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadUsers, reloadKey]);

  function openCreate() {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(user) {
    setEditingUser(user);
    setForm({ username: user.username || '', email: user.email || '', password: '', role: user.role || 'User', wallet_address: user.wallet_address || '' });
    setDialogOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      if (editingUser) {
        await userApi(`/api/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ username: form.username.trim(), email: form.email.trim() || null, role: form.role, wallet_address: form.wallet_address.trim() || null }),
        });
        setToast(`Đã cập nhật người dùng ${form.username.trim()}.`);
      } else {
        await userApi('/api/users', {
          method: 'POST',
          body: JSON.stringify({ username: form.username.trim(), email: form.email.trim() || null, password: form.password, role: form.role, wallet_address: form.wallet_address.trim() || null }),
        });
        setPage(1);
        setToast(`Đã tạo tài khoản ${form.username.trim()}.`);
      }
      setDialogOpen(false);
      setReloadKey((key) => key + 1);
    } catch (submitError) {
      setError(submitError.message || 'Không lưu được người dùng.');
    } finally {
      setWorking(false);
    }
  }

  async function toggleActive(user) {
    const nextState = !user.is_active;
    setWorking(true);
    setError('');
    try {
      await userApi(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: nextState }) });
      setToast(nextState ? `Đã mở khóa ${user.username}.` : `Đã khóa ${user.username}.`);
      setReloadKey((key) => key + 1);
    } catch (toggleError) {
      setError(toggleError.message || 'Không đổi được trạng thái người dùng.');
    } finally {
      setWorking(false);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Xóa vĩnh viễn tài khoản ${user.username}?`)) return;
    setWorking(true);
    setError('');
    try {
      await userApi(`/api/users/${user.id}`, { method: 'DELETE' });
      setToast(`Đã xóa tài khoản ${user.username}.`);
      setReloadKey((key) => key + 1);
    } catch (deleteError) {
      setError(deleteError.message || 'Không xóa được người dùng.');
    } finally {
      setWorking(false);
    }
  }

  if (currentUser?.role !== 'Admin') return <main className="min-h-screen bg-canvas text-slate-100"><div className="mx-auto max-w-7xl px-4 sm:px-7 lg:px-10"><MainNavigation /><section className="mx-auto mt-16 max-w-lg rounded-2xl border border-rose-200/15 bg-rose-200/[0.035] p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose-200/15 text-lg text-rose-200">403</span><h1 className="mt-4 text-xl font-medium text-white">Không có quyền truy cập</h1><p className="mt-2 text-sm leading-6 text-slate-400">Trang này và API quản lý người dùng chỉ dành cho Admin.</p><a href="/dashboard" className="mt-6 inline-flex rounded-lg border border-white/[0.1] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]">Về tổng quan</a></section></div></main>;

  return <main className="min-h-screen bg-canvas text-slate-100"><div className="mx-auto max-w-7xl px-4 pb-10 sm:px-7 lg:px-10">
    <MainNavigation />
    <section className="mt-9 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Quản trị hệ thống</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Người dùng</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Quản lý tài khoản trong PostgreSQL. Tài khoản đăng ký mới sẽ xuất hiện trong danh sách.</p></div><div className="flex gap-2"><button type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading || working} className="rounded-lg border border-white/[0.1] px-4 py-2.5 text-sm text-slate-200 hover:border-indigo-200/30 disabled:opacity-50">Làm mới</button><button type="button" onClick={openCreate} className="rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-indigo-200">Thêm người dùng</button></div></section>
    <div className="mt-6 rounded-xl border border-indigo-200/10 bg-indigo-200/[0.035] px-4 py-3 text-xs leading-5 text-indigo-100/75">Có thể tạo, sửa vai trò, gán ví, khóa/mở khóa hoặc xóa tài khoản. Tài khoản bị khóa mất quyền truy cập ngay; Admin cuối cùng không thể tự khóa, tự hạ quyền hoặc bị xóa.</div>
    {error && <div role="alert" className="mt-3 rounded-lg border border-rose-200/15 bg-rose-200/[0.04] px-4 py-3 text-xs text-rose-100/80">{error}</div>}
    {toast && <div role="status" className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200/15 bg-emerald-200/[0.04] px-4 py-3 text-xs text-emerald-100/80">{toast}<button type="button" onClick={() => setToast('')} className="ml-3 text-slate-400 hover:text-white">Đóng</button></div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="w-full max-w-md"><span className="sr-only">Tìm người dùng</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm username hoặc email…" className="w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/40" /></label><span className="text-xs text-slate-500">{pagination.total} tài khoản</span></div>
    <section className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.08] bg-panel/70"><table className="w-full min-w-[1050px] border-collapse text-left"><thead><tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.12em] text-slate-500"><th className="px-5 py-4 font-medium">Tên đăng nhập</th><th className="px-5 py-4 font-medium">Email</th><th className="px-5 py-4 font-medium">Vai trò</th><th className="px-5 py-4 font-medium">Ví được cấp quyền</th><th className="px-5 py-4 font-medium">Trạng thái</th><th className="px-5 py-4 font-medium">Ngày tạo</th><th className="px-5 py-4" /></tr></thead><tbody>
      {loading && <tr><td colSpan="7" className="px-5 py-10 text-center text-sm text-slate-500">Đang tải danh sách người dùng…</td></tr>}
      {!loading && users.map((user) => { const self = String(user.id) === String(currentUser?.id); return <tr key={user.id} className="border-b border-white/[0.05] last:border-0"><td className="px-5 py-4 text-sm text-slate-200">{user.username}{self && <span className="ml-2 text-[10px] text-indigo-200">Bạn</span>}</td><td className="px-5 py-4 text-sm text-slate-400">{user.email || '—'}</td><td className="px-5 py-4"><select disabled={self || working} value={user.role} onChange={async (event) => { try { setWorking(true); await userApi(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role: event.target.value }) }); setToast(`Đã đổi quyền ${user.username}.`); setReloadKey((key) => key + 1); } catch (roleError) { setError(roleError.message); } finally { setWorking(false); } }} className="rounded-lg border border-white/[0.09] bg-[#0b0e14] px-2.5 py-2 text-xs text-slate-300 disabled:opacity-50"><option>User</option><option>Admin</option></select></td><td className="px-5 py-4 font-mono text-xs text-slate-400" title={user.wallet_address || 'Chưa cấp'}>{user.wallet_address || 'Chưa cấp'}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] ${user.is_active ? 'border-emerald-200/15 text-emerald-100/75' : 'border-rose-200/15 text-rose-100/75'}`}>{user.is_active ? 'Hoạt động' : 'Đã khóa'}</span></td><td className="px-5 py-4 text-xs text-slate-500">{formatDate(user.created_at)}</td><td className="px-5 py-4 text-right"><div className="inline-flex gap-1"><button type="button" disabled={working} onClick={() => openEdit(user)} className="rounded-md px-2.5 py-1.5 text-xs text-indigo-200 hover:bg-indigo-300/[0.08] disabled:opacity-50">Sửa</button><button type="button" disabled={working || self} onClick={() => toggleActive(user)} className="rounded-md px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-300/[0.08] disabled:cursor-not-allowed disabled:opacity-40">{user.is_active ? 'Khóa' : 'Mở khóa'}</button><button type="button" disabled={working || self} onClick={() => deleteUser(user)} className="rounded-md px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-300/[0.08] disabled:cursor-not-allowed disabled:opacity-40">Xóa</button></div></td></tr>; })}
      {!loading && !error && !users.length && <tr><td colSpan="7" className="px-5 py-10 text-center text-sm text-slate-500">Không tìm thấy người dùng nào.</td></tr>}
    </tbody></table></section>
    {!error && pagination.pages > 1 && <nav aria-label="Phân trang người dùng" className="mt-4 flex items-center justify-end gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-slate-300 disabled:opacity-40">Trước</button><span className="px-2 text-xs text-slate-500">Trang {page} / {pagination.pages}</span><button type="button" disabled={page >= pagination.pages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-slate-300 disabled:opacity-40">Sau</button></nav>}
    {dialogOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(event) => event.target === event.currentTarget && setDialogOpen(false)}><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#11141c] p-6"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.14em] text-indigo-200/70">Quản lý tài khoản thật</p><h2 className="mt-2 text-lg font-medium text-white">{editingUser ? 'Sửa người dùng' : 'Thêm người dùng'}</h2></div><button type="button" onClick={() => setDialogOpen(false)} className="text-slate-500 hover:text-white">×</button></div>
      <label className="mt-5 block text-xs text-slate-400">Tên đăng nhập<input required minLength={3} maxLength={50} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2.5 text-sm text-white" /></label>
      <label className="mt-4 block text-xs text-slate-400">Email<input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Không bắt buộc" className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2.5 text-sm text-white" /></label>
      {!editingUser && <label className="mt-4 block text-xs text-slate-400">Mật khẩu ban đầu<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2.5 text-sm text-white" /><span className="mt-1 block text-[10px] text-slate-600">Tối thiểu 12 ký tự. Mật khẩu sẽ được băm trước khi lưu.</span></label>}
      <label className="mt-4 block text-xs text-slate-400">Vai trò<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2.5 text-sm text-white"><option>User</option><option>Admin</option></select></label>
      <label className="mt-4 block text-xs text-slate-400">Ví được cấp quyền<input value={form.wallet_address} onChange={(event) => setForm({ ...form, wallet_address: event.target.value })} maxLength={128} placeholder="0x… (không bắt buộc)" className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600" /></label>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-slate-300">Hủy</button><button type="submit" disabled={working} className="rounded-lg bg-indigo-300 px-4 py-2 text-xs font-medium text-slate-950 disabled:opacity-50">{working ? 'Đang lưu…' : editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></div>
    </form></div>}
  </div></main>;
}

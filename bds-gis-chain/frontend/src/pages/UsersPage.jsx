import React, { useState } from 'react';
import MainNavigation from '../components/MainNavigation.jsx';
import { getCachedUser } from '../lib/authSession.js';

const storageKey = 'bds-gis-chain-demo-users-v1';
const demoUsers = [
  { id: 'sample-admin', username: 'admin-demo', role: 'Admin', wallet: '', active: true, createdAt: 'Dữ liệu mẫu' },
  { id: 'sample-user', username: 'user-demo', role: 'User', wallet: '', active: true, createdAt: 'Dữ liệu mẫu' },
];

function readUsers() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return demoUsers;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : demoUsers;
  } catch {
    return demoUsers;
  }
}

function shortAddress(address) {
  if (!address) return 'Chưa cấp';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function UsersPage() {
  const currentUser = getCachedUser();
  const [users, setUsers] = useState(readUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ username: '', role: 'User', wallet: '' });
  const [toast, setToast] = useState('');
  const [storageWarning, setStorageWarning] = useState('');

  function persist(nextUsers) {
    setUsers(nextUsers);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextUsers));
      setStorageWarning('');
    } catch {
      setStorageWarning('Trình duyệt không lưu được thay đổi demo; dữ liệu có thể mất khi tải lại trang.');
    }
  }

  function openCreate() {
    setEditingUser(null);
    setForm({ username: '', role: 'User', wallet: '' });
    setDialogOpen(true);
  }

  function openEdit(user) {
    setEditingUser(user);
    setForm({ username: user.username, role: user.role, wallet: user.wallet || '' });
    setDialogOpen(true);
  }

  function submit(event) {
    event.preventDefault();
    if (!form.username.trim()) return;
    if (editingUser) {
      persist(users.map((user) => user.id === editingUser.id
        ? { ...user, ...(user.username === currentUser?.username ? {} : { username: form.username.trim() }), ...(user.username === currentUser?.username ? {} : { role: form.role }), wallet: form.wallet.trim() }
        : user));
      setToast(editingUser.username === currentUser?.username ? 'Không đổi tên hoặc hạ quyền tài khoản đang đăng nhập; địa chỉ ví demo đã cập nhật.' : 'Đã cập nhật tài khoản demo.');
    } else {
      if (users.some((user) => user.username.toLowerCase() === form.username.trim().toLowerCase())) {
        setToast('Tên đăng nhập đã có trong danh sách demo.');
        return;
      }
      persist([...users, { id: `demo-${Date.now()}`, username: form.username.trim(), role: form.role, wallet: form.wallet.trim(), active: true, createdAt: 'Dữ liệu mẫu' }]);
      setToast('Đã thêm tài khoản demo.');
    }
    setDialogOpen(false);
  }

  function toggleActive(user) {
    if (user.username === currentUser?.username) {
      setToast('Không thể tự khóa tài khoản đang đăng nhập.');
      return;
    }
    persist(users.map((item) => item.id === user.id ? { ...item, active: !item.active } : item));
    setToast(user.active ? 'Đã khóa tài khoản demo.' : 'Đã mở khóa tài khoản demo.');
  }

  if (currentUser?.role !== 'Admin') return <main className="min-h-screen bg-canvas text-slate-100"><div className="mx-auto max-w-7xl px-4 sm:px-7 lg:px-10"><MainNavigation /><section className="mx-auto mt-16 max-w-lg rounded-2xl border border-rose-200/15 bg-rose-200/[0.035] p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose-200/15 text-lg text-rose-200">403</span><h1 className="mt-4 text-xl font-medium text-white">Không có quyền truy cập</h1><p className="mt-2 text-sm leading-6 text-slate-400">Trang này chỉ dành cho Admin. Giao diện ẩn chức năng quản trị; backend cũng cần kiểm tra quyền trên API.</p><a href="/dashboard" className="mt-6 inline-flex rounded-lg border border-white/[0.1] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]">Về tổng quan</a></section></div></main>;

  return <main className="min-h-screen bg-canvas text-slate-100"><div className="mx-auto max-w-7xl px-4 pb-10 sm:px-7 lg:px-10">
    <MainNavigation />
    <section className="mt-9 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Quản trị hệ thống</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Người dùng</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Chỉ địa chỉ ví được cấp quyền trong Smart Contract mới ghi được hash. Đây là bảng minh họa; hiện chưa nối API quản lý tài khoản.</p></div><button type="button" onClick={openCreate} className="rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-indigo-200">Thêm người dùng</button></section>
    <div className="mt-6 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3 text-xs leading-5 text-amber-100/75">Dữ liệu tài khoản bên dưới chỉ là mẫu local. Đổi role/trạng thái tại đây không thay đổi users trong PostgreSQL hoặc quyền trên contract.</div>
    {storageWarning && <div role="alert" className="mt-3 rounded-lg border border-rose-200/15 bg-rose-200/[0.04] px-4 py-3 text-xs text-rose-100/80">{storageWarning}</div>}
    {toast && <div role="status" className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200/15 bg-emerald-200/[0.04] px-4 py-3 text-xs text-emerald-100/80">{toast}<button type="button" onClick={() => setToast('')} className="ml-3 text-slate-400 hover:text-white">Đóng</button></div>}
    <section className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.08] bg-panel/70"><table className="w-full min-w-[850px] border-collapse text-left"><thead><tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.12em] text-slate-500"><th className="px-5 py-4 font-medium">Tên đăng nhập</th><th className="px-5 py-4 font-medium">Vai trò</th><th className="px-5 py-4 font-medium">Ví được cấp quyền</th><th className="px-5 py-4 font-medium">Trạng thái</th><th className="px-5 py-4 font-medium">Ngày tạo</th><th className="px-5 py-4" /></tr></thead><tbody>{users.map((user) => { const self = user.username === currentUser?.username; return <tr key={user.id} className="border-b border-white/[0.05] last:border-0"><td className="px-5 py-4 text-sm text-slate-200">{user.username}{self && <span className="ml-2 text-[10px] text-indigo-200">Bạn</span>}</td><td className="px-5 py-4"><select disabled={self} value={user.role} onChange={(event) => persist(users.map((item) => item.id === user.id ? { ...item, role: event.target.value } : item))} className="rounded-lg border border-white/[0.09] bg-[#0b0e14] px-2.5 py-2 text-xs text-slate-300 disabled:opacity-50"><option>User</option><option>Admin</option></select></td><td className="px-5 py-4 font-mono text-xs text-slate-400" title={user.wallet || 'Chưa cấp'}>{shortAddress(user.wallet)}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] ${user.active ? 'border-emerald-200/15 text-emerald-100/75' : 'border-rose-200/15 text-rose-100/75'}`}>{user.active ? 'Hoạt động' : 'Đã khóa'}</span></td><td className="px-5 py-4 text-xs text-slate-500">{user.createdAt}</td><td className="px-5 py-4 text-right"><div className="inline-flex gap-2"><button type="button" onClick={() => openEdit(user)} className="rounded-md px-2.5 py-1.5 text-xs text-indigo-200 hover:bg-indigo-300/[0.08]">Sửa</button><button type="button" disabled={self} onClick={() => toggleActive(user)} className="rounded-md px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-300/[0.08] disabled:cursor-not-allowed disabled:opacity-40">{user.active ? 'Khóa' : 'Mở khóa'}</button></div></td></tr>; })}</tbody></table></section>
    {dialogOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(event) => event.target === event.currentTarget && setDialogOpen(false)}><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#11141c] p-6"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.14em] text-indigo-200/70">Tài khoản demo</p><h2 className="mt-2 text-lg font-medium text-white">{editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng'}</h2></div><button type="button" onClick={() => setDialogOpen(false)} className="text-slate-500 hover:text-white">×</button></div><label className="mt-5 block text-xs text-slate-400">Tên đăng nhập<input required minLength={3} maxLength={50} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} disabled={editingUser?.username === currentUser?.username} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2.5 text-sm text-white disabled:opacity-50" /></label><label className="mt-4 block text-xs text-slate-400">Vai trò<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} disabled={editingUser?.username === currentUser?.username} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2.5 text-sm text-white disabled:opacity-50"><option>User</option><option>Admin</option></select></label><label className="mt-4 block text-xs text-slate-400">Địa chỉ ví được cấp quyền<input value={form.wallet} onChange={(event) => setForm({ ...form, wallet: event.target.value })} placeholder="0x… (có thể để trống)" className="mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600" /></label><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-slate-300">Hủy</button><button type="submit" className="rounded-lg bg-indigo-300 px-4 py-2 text-xs font-medium text-slate-950">Lưu demo</button></div></form></div>}
  </div></main>;
}

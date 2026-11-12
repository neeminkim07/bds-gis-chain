import React, { useEffect, useState } from 'react';
import AccountMenu from '../components/AccountMenu.jsx';
import { clearAuthSession, fetchCurrentUser, getAuthToken, saveAuthSession } from '../lib/authSession.js';

const authApi = {
  login: { path: '/api/auth/login', title: 'Đăng nhập' },
  register: { path: '/api/auth/register', title: 'Tạo tài khoản' },
};

function readApiMessage(data, fallback) {
  return data?.message || data?.error || data?.detail || fallback;
}

export default function AuthPage({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [sessionUser, setSessionUser] = useState(null);
  const [sessionChecking, setSessionChecking] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const currentApi = authApi[mode];

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;
    let active = true;
    setSessionChecking(true);
    fetchCurrentUser(token)
      .then((user) => { if (active) setSessionUser(user); })
      .catch((error) => {
        if (!active) return;
        clearAuthSession();
        setSessionUser(null);
        setSessionError(error.message || 'Phiên đăng nhập không còn hợp lệ.');
      })
      .finally(() => { if (active) setSessionChecking(false); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setResult(null);

    if (mode === 'register' && password !== confirmPassword) {
      setResult({ ok: false, message: 'Mật khẩu xác nhận chưa khớp.' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(currentApi.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          ...(mode === 'register' && email.trim() ? { email: email.trim() } : {}),
        }),
      });
      const rawBody = await response.text();
      let data;
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        data = { responseText: rawBody };
      }

      const token = data?.token || data?.accessToken || data?.data?.token;
      if (response.ok && token) {
        setSessionError('');
        try {
          const apiUser = await fetchCurrentUser(token);
          const user = { ...apiUser, ...(data?.user || {}) };
          saveAuthSession(token, user);
          setSessionUser(user);
          if (mode === 'login') {
            window.location.assign('/dashboard');
            return;
          }
        } catch (error) {
          clearAuthSession();
          setSessionUser(null);
          setSessionError(`Đăng nhập thành công nhưng xác minh token thất bại: ${error.message}`);
        }
      }

      setResult({
        ok: response.ok,
        status: response.status,
        message: response.ok
          ? readApiMessage(data, `${currentApi.title} thành công.`)
          : readApiMessage(data, `API trả về HTTP ${response.status}.`),
        data,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: 'Không gọi được backend. Kiểm tra backend đang chạy ở cổng 4000 và route API đã được thêm.',
        error: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setResult(null);
    window.history.replaceState(null, '', nextMode === 'login' ? '/login' : '/register');
  }

  function logout() {
    clearAuthSession();
    setSessionUser(null);
    setSessionError('');
    setResult({ ok: true, message: 'Đã xóa token đăng nhập khỏi phiên trình duyệt.' });
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-4 py-10 text-slate-100 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(110,128,255,0.14),transparent_52%)]" />
      <div className="relative w-full max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 text-sm font-medium text-slate-300 transition hover:text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-sm font-semibold text-indigo-200">GC</span>
            GIS-CHAIN
          </a>
          <div className="flex items-center gap-3"><AccountMenu /><a href="/" className="text-sm text-slate-500 transition hover:text-slate-200">← Trang chủ</a></div>
        </header>

        <div className="grid overflow-hidden rounded-3xl border border-white/[0.09] bg-panel/90 shadow-2xl shadow-black/20 md:grid-cols-[0.9fr_1.1fr]">
          <section className="hidden flex-col justify-between border-r border-white/[0.07] bg-white/[0.02] p-9 md:flex lg:p-12">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/15 bg-indigo-200/[0.05] px-3 py-1.5 text-xs text-indigo-100/80">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" /> Kiểm thử tích hợp API
              </span>
              <h1 className="mt-8 text-3xl font-medium leading-tight tracking-tight text-white lg:text-4xl">
                Đăng nhập vào không gian GIS-CHAIN.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
                Form gửi trực tiếp JSON tới backend để nhóm kiểm tra luồng xác thực và phản hồi API.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {['Quản lý hồ sơ trên bản đồ', 'Phân tích dữ liệu không gian', 'Xác minh tính toàn vẹn bằng blockchain'].map((item) => <li key={item} className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center rounded-full border border-emerald-200/20 text-[10px] text-emerald-200">✓</span>{item}</li>)}
              </ul>
              <p className="mt-6 max-w-sm border-l-2 border-amber-200/30 pl-3 text-xs leading-5 text-amber-100/70">Hệ thống chỉ xác minh tính toàn vẹn dữ liệu, không xác minh quyền sở hữu pháp lý.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-[#0b0e14]/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Request hiện tại</p>
              <p className="mt-2 font-mono text-xs text-indigo-200">POST {currentApi.path}</p>
              <pre className="mt-3 overflow-x-auto text-xs leading-5 text-slate-400">{mode === 'register' ? `{
  "username": "...",
  "email": "... (tùy chọn)",
  "password": "..."
}` : `{
  "username": "... hoặc email",
  "password": "..."
}`}</pre>
            </div>
          </section>

          <section className="p-6 sm:p-9 lg:p-12">
            <div className="mb-7 flex rounded-xl border border-white/[0.08] bg-[#0b0e14] p-1" role="tablist" aria-label="Chọn đăng nhập hoặc đăng ký">
              {Object.entries(authApi).map(([key, value]) => (
                <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => switchMode(key)} className={`flex-1 rounded-lg px-3 py-2.5 text-sm transition ${mode === key ? 'bg-white/[0.1] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                  {value.title}
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Tài khoản</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight text-white">{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}</h2>
              <p className="mt-2 text-sm text-slate-400">{mode === 'login' ? 'Nhập thông tin để gửi yêu cầu đăng nhập.' : 'Tạo tài khoản thử nghiệm với API đăng ký.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-300">{mode === 'login' ? 'Tên đăng nhập hoặc email' : 'Tên đăng nhập'}</span>
                <input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder={mode === 'login' ? 'Username hoặc email' : 'Ví dụ: khiem'} className="w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10" />
              </label>
              {mode === 'register' && <label className="block"><span className="mb-2 block text-xs font-medium text-slate-300">Email <span className="text-slate-600">(không bắt buộc)</span></span><input autoComplete="email" type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" className="w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10" /></label>}
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-300">Mật khẩu</span>
                <span className="relative block"><input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} required minLength={mode === 'register' ? 12 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'Ít nhất 12 ký tự' : 'Nhập mật khẩu'} className="w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 pr-16 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10" /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:text-slate-200">{showPassword ? 'Ẩn' : 'Hiện'}</button></span>
              </label>
              {mode === 'register' && <label className="block"><span className="mb-2 block text-xs font-medium text-slate-300">Xác nhận mật khẩu</span><input autoComplete="new-password" type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" className="w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10" /></label>}
              <button disabled={submitting} type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-200 disabled:cursor-wait disabled:opacity-60">
                {submitting ? 'Đang gửi yêu cầu…' : currentApi.title}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            {(sessionChecking || sessionUser || sessionError) && <section className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4" aria-live="polite">
              {sessionChecking && <p className="text-sm text-slate-400">Đang xác minh phiên đăng nhập với <code className="text-indigo-200">GET /api/auth/me</code>…</p>}
              {sessionUser && <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-emerald-200">Token hợp lệ · GET /api/auth/me</p><p className="mt-1 text-sm font-medium text-white">{sessionUser.username}</p><p className="mt-0.5 text-xs text-slate-500">Vai trò: {sessionUser.role}</p></div><button type="button" onClick={logout} className="rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-slate-300 transition hover:border-rose-300/30 hover:text-rose-200">Đăng xuất</button></div>}
              {sessionError && <p className="text-xs leading-5 text-amber-100/80">{sessionError}</p>}
            </section>}

            {result && <div role={result.ok ? 'status' : 'alert'} className={`mt-5 rounded-xl border p-4 ${result.ok ? 'border-emerald-300/20 bg-emerald-300/[0.06]' : 'border-rose-300/20 bg-rose-300/[0.05]'}`}>
              <div className="flex items-center justify-between gap-3"><p className={`text-sm font-medium ${result.ok ? 'text-emerald-200' : 'text-rose-200'}`}>{result.message}</p>{result.status && <span className="font-mono text-xs text-slate-500">HTTP {result.status}</span>}</div>
              {result.data && <details className="mt-3"><summary className="cursor-pointer text-xs text-slate-400">Xem JSON phản hồi</summary><pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/20 p-3 text-[11px] leading-5 text-slate-300">{JSON.stringify(result.data, (key, value) => ['token', 'accessToken'].includes(key) ? '<đã ẩn; token lưu trong phiên>' : value, 2)}</pre></details>}
              {result.error && <p className="mt-2 text-xs text-slate-500">{result.error}</p>}
            </div>}

            <details className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-300">Hợp đồng API frontend đang dùng</summary>
              <div className="mt-3 space-y-3 text-xs leading-5 text-slate-400">
                <p><code className="text-indigo-200">POST /api/auth/login</code> và <code className="text-indigo-200">POST /api/auth/register</code></p>
                <p>Request: <code>{'{ username, password }'}</code>; đăng ký có thể gửi thêm email. Backend tự gán role mặc định.</p>
                <p>Đăng nhập nhận token, sau đó frontend gọi <code>GET /api/auth/me</code>. JSON được hiển thị để đối chiếu nhưng JWT được ẩn.</p>
                <p className="text-amber-100/70">Đây là hợp đồng frontend đề xuất để test; cần Đạt xác nhận tên endpoint và cấu trúc với backend.</p>
              </div>
            </details>
          </section>
        </div>
        <p className="mt-5 text-center text-[11px] text-slate-600">Mật khẩu chỉ được gửi tới backend khi bấm nút; giao diện không lưu mật khẩu trong trình duyệt.</p>
      </div>
    </main>
  );
}

import React, { useState } from 'react';

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const currentApi = authApi[mode];

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
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const rawBody = await response.text();
      let data;
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        data = { responseText: rawBody };
      }

      const token = data?.token || data?.accessToken;
      if (response.ok && token) sessionStorage.setItem('bdsAuthToken', token);

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

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-4 py-10 text-slate-100 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(110,128,255,0.14),transparent_52%)]" />
      <div className="relative w-full max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 text-sm font-medium text-slate-300 transition hover:text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-sm font-semibold text-indigo-200">GC</span>
            GIS-CHAIN
          </a>
          <a href="/" className="text-sm text-slate-500 transition hover:text-slate-200">← Trang chủ</a>
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
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-[#0b0e14]/70 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Request hiện tại</p>
              <p className="mt-2 font-mono text-xs text-indigo-200">POST {currentApi.path}</p>
              <pre className="mt-3 overflow-x-auto text-xs leading-5 text-slate-400">{`{
  "username": "...",
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
                <span className="mb-2 block text-xs font-medium text-slate-300">Tên đăng nhập</span>
                <input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Ví dụ: khiem" className="w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-300">Mật khẩu</span>
                <input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" className="w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10" />
              </label>
              {mode === 'register' && <label className="block"><span className="mb-2 block text-xs font-medium text-slate-300">Xác nhận mật khẩu</span><input autoComplete="new-password" type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" className="w-full rounded-xl border border-white/[0.1] bg-[#0b0e14] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10" /></label>}
              <button disabled={submitting} type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-indigo-200 disabled:cursor-wait disabled:opacity-60">
                {submitting ? 'Đang gửi yêu cầu…' : currentApi.title}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </form>

            {result && <div role={result.ok ? 'status' : 'alert'} className={`mt-5 rounded-xl border p-4 ${result.ok ? 'border-emerald-300/20 bg-emerald-300/[0.06]' : 'border-rose-300/20 bg-rose-300/[0.05]'}`}>
              <div className="flex items-center justify-between gap-3"><p className={`text-sm font-medium ${result.ok ? 'text-emerald-200' : 'text-rose-200'}`}>{result.message}</p>{result.status && <span className="font-mono text-xs text-slate-500">HTTP {result.status}</span>}</div>
              {result.data && <details className="mt-3"><summary className="cursor-pointer text-xs text-slate-400">Xem JSON phản hồi</summary><pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/20 p-3 text-[11px] leading-5 text-slate-300">{JSON.stringify(result.data, null, 2)}</pre></details>}
              {result.error && <p className="mt-2 text-xs text-slate-500">{result.error}</p>}
            </div>}

            <details className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-300">Hợp đồng API frontend đang dùng</summary>
              <div className="mt-3 space-y-3 text-xs leading-5 text-slate-400">
                <p><code className="text-indigo-200">POST /api/auth/login</code> và <code className="text-indigo-200">POST /api/auth/register</code></p>
                <p>Request: <code>{'{ username, password }'}</code>. Đăng ký không gửi role; backend tự gán quyền mặc định.</p>
                <p>Đề xuất phản hồi thành công: <code>{'{ message, token, user: { id, username, role } }'}</code>. Frontend chấp nhận token hoặc accessToken và hiển thị nguyên JSON để đối chiếu.</p>
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

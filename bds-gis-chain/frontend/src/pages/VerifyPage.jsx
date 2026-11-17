import React, { useEffect, useState } from 'react';
import MainNavigation from '../components/MainNavigation.jsx';
import PageGuide from '../components/PageGuide.jsx';
import { getAuthToken, getCachedUser } from '../lib/authSession.js';

const areaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const propertyTypes = { house: 'Nhà ở', apartment: 'Căn hộ', land: 'Đất nền', commercial: 'Thương mại' };

async function verifyApi(path, options = {}) {
  const token = getAuthToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `Lỗi máy chủ HTTP ${response.status}`);
  return data;
}

async function sha256(text) {
  if (!window.crypto?.subtle) throw new Error('Trình duyệt không hỗ trợ Web Crypto.');
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function statusStyle(status) {
  if (status === 'MATCH') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  if (status === 'MODIFIED') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
  if (status === 'NODE_OFFLINE') return 'border-slate-600 bg-slate-800/60 text-slate-200';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}

export default function VerifyPage() {
  const [properties, setProperties] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nodeStatus, setNodeStatus] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState('');
  const [trialText, setTrialText] = useState('BDS001 - Dien tich: 85.5m2');
  const [trialHash, setTrialHash] = useState('');
  const canRegister = getCachedUser()?.role === 'Admin';

  async function loadStatus() {
    try { setNodeStatus((await verifyApi('/api/verify/status')).data); }
    catch (err) { setNodeStatus({ connected: false, error: err.message }); }
  }

  async function loadList() {
    const result = await verifyApi('/api/verify/properties');
    const list = Array.isArray(result.data) ? result.data : [];
    setProperties(list);
    if (!selectedCode && list[0]) setSelectedCode(list[0].code);
  }

  async function loadDetail(code) {
    if (!code) return;
    setError('');
    try { setDetail((await verifyApi(`/api/verify/${encodeURIComponent(code)}`)).data); }
    catch (err) { setDetail(null); setError(err.message); }
  }

  useEffect(() => {
    Promise.all([loadList(), loadStatus()])
      .catch((err) => setError(err.message || 'Không thể tải dữ liệu xác minh.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDetail(selectedCode); }, [selectedCode]);

  useEffect(() => {
    let active = true;
    sha256(trialText).then((value) => active && setTrialHash(value)).catch(() => active && setTrialHash(''));
    return () => { active = false; };
  }, [trialText]);

  async function registerVersion() {
    if (!detail?.property?.id) return;
    setRegistering(true);
    setNotice('');
    try {
      const result = await verifyApi(`/api/verify/register/${detail.property.id}`, { method: 'POST' });
      setNotice(`Đăng ký thành công. TxHash: ${result.data?.txHash || 'đã xác nhận'}`);
      await Promise.all([loadDetail(selectedCode), loadList(), loadStatus()]);
    } catch (err) { setNotice(err.message || 'Giao dịch thất bại.'); }
    finally { setRegistering(false); }
  }

  const filtered = properties.filter((property) => {
    const text = `${property.code} ${property.address || ''} ${property.owner_name || ''}`.toLocaleLowerCase('vi');
    return text.includes(query.trim().toLocaleLowerCase('vi'));
  });

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-7 lg:px-10">
        <MainNavigation />
        <section className="mt-8 border-b border-white/[0.08] pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Blockchain · Xác minh dữ liệu</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Xác thực tính toàn vẹn hồ sơ BĐS</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Đối chiếu SHA-256 của dữ liệu PostgreSQL với hash bất biến trên Smart Contract.</p>
          <PageGuide steps={['Chọn một hồ sơ đã có trong PostgreSQL.', 'Đọc trạng thái khớp hoặc sai lệch giữa database và blockchain.', 'Admin có thể đăng ký phiên bản mới sau khi dữ liệu hợp lệ.']} note="Hệ thống chỉ xác minh tính toàn vẹn dữ liệu, không xác minh quyền sở hữu pháp lý." />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="h-fit overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/80">
            <div className="border-b border-white/[0.07] p-4">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Danh sách hồ sơ</h2><span className="text-xs text-slate-400">{filtered.length}</span></div>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã, địa chỉ..." className="mt-3 w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2 text-xs text-slate-200 outline-none" />
            </div>
            <div className="max-h-[600px] divide-y divide-white/[0.04] overflow-y-auto">
              {loading ? <p className="p-8 text-center text-xs text-slate-500">Đang tải...</p> : filtered.map((property) => (
                <button key={property.code} type="button" onClick={() => setSelectedCode(property.code)} className={`block w-full p-3.5 text-left ${selectedCode === property.code ? 'border-l-2 border-indigo-400 bg-indigo-600/20' : 'hover:bg-white/[0.03]'}`}>
                  <div className="flex justify-between gap-2"><span className="font-mono text-sm text-slate-200">{property.code}</span><span className="text-[10px] text-slate-500">{propertyTypes[property.type] || property.type}</span></div>
                  <p className="mt-1 truncate text-xs text-slate-400">{property.address || 'Chưa có địa chỉ'}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="space-y-5">
            {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
            {nodeStatus && <div className="text-xs text-slate-500">Blockchain: {nodeStatus.connected ? (nodeStatus.contractReady ? 'node và contract sẵn sàng' : 'node chạy, contract chưa sẵn sàng') : 'node chưa kết nối'}</div>}
            {detail ? <>
              <div className={`rounded-2xl border p-5 ${statusStyle(detail.status)}`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{detail.statusMessage}</h2><span className="font-mono text-xs">{detail.status}</span></div></div>
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-white/[0.08] bg-panel p-5"><p className="text-[11px] uppercase tracking-wider text-indigo-300">Hash hiện tại từ PostgreSQL</p><code className="mt-3 block break-all rounded-lg bg-[#0b0e14] p-3 font-mono text-xs text-indigo-200">{detail.currentHash}</code></article>
                <article className="rounded-2xl border border-white/[0.08] bg-panel p-5"><p className="text-[11px] uppercase tracking-wider text-sky-300">Hash mới nhất trên chain</p><code className="mt-3 block break-all rounded-lg bg-[#0b0e14] p-3 font-mono text-xs text-sky-200">{detail.blockchain?.latest?.dataHash || 'Chưa đăng ký'}</code></article>
              </div>
              <article className="rounded-2xl border border-white/[0.08] bg-panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-indigo-300">{detail.property.code}</p><p className="mt-1 text-sm text-slate-400">{detail.property.address}</p><p className="mt-1 text-xs text-slate-500">Diện tích: {areaFormat.format(detail.property.area)} m²</p></div>{canRegister && <button type="button" disabled={registering || !nodeStatus?.connected} onClick={registerVersion} className="rounded-lg bg-indigo-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{registering ? 'Đang gửi giao dịch...' : 'Đăng ký phiên bản'}</button>}</div>{notice && <p className="mt-4 text-xs text-amber-200">{notice}</p>}</article>
              <article className="rounded-2xl border border-white/[0.08] bg-panel p-5"><h2 className="text-sm font-semibold text-white">Lịch sử phiên bản</h2><div className="mt-3 space-y-2">{(detail.blockchain?.history || []).map((version) => <div key={`${version.versionNumber}-${version.timestamp}`} className="rounded-lg bg-white/[0.03] p-3 text-xs"><span className="font-semibold text-slate-200">v{version.versionNumber}</span><code className="ml-3 break-all text-slate-400">{version.dataHash}</code></div>)}{!detail.blockchain?.history?.length && <p className="text-xs text-slate-500">Chưa có lịch sử on-chain.</p>}</div></article>
            </> : <div className="grid min-h-[350px] place-items-center rounded-2xl border border-dashed border-white/[0.1] text-sm text-slate-500">Chọn một hồ sơ để bắt đầu xác minh.</div>}
            <article className="rounded-2xl border border-white/[0.08] bg-panel p-5"><h2 className="text-sm font-semibold text-white">Thử nghiệm Avalanche effect</h2><p className="mt-1 text-xs text-slate-500">Sửa một ký tự để thấy SHA-256 thay đổi hoàn toàn.</p><input value={trialText} onChange={(event) => setTrialText(event.target.value)} className="mt-3 w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2 font-mono text-xs text-slate-200" /><code className="mt-3 block break-all font-mono text-xs text-indigo-200">{trialHash || 'Đang tính...'}</code></article>
          </section>
        </div>
      </div>
    </main>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import MainNavigation from '../components/MainNavigation.jsx';
import { getAuthToken, getCachedUser } from '../lib/authSession.js';

const areaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const moneyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const propertyTypes = {
  house: 'Nhà ở',
  apartment: 'Căn hộ',
  land: 'Đất nền',
  commercial: 'Thương mại',
};

async function verifyApi(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Lỗi máy chủ HTTP ${response.status}`);
  }
  return data;
}

async function computeBrowserSha256(text) {
  if (!window.crypto?.subtle) return 'Web Crypto không được hỗ trợ';
  const bytes = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function VerifyPage() {
  const [properties, setProperties] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const [query, setQuery] = useState('');

  const [selectedCode, setSelectedCode] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [nodeStatus, setNodeStatus] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Thử nghiệm Avalanche effect
  const [trialText, setTrialText] = useState('BDS001 - Diện tích: 85.5m2');
  const [trialHash, setTrialHash] = useState('');

  const currentUser = getCachedUser();
  const canRegister = currentUser?.role === 'Admin';

  // 1. Kiểm tra trạng thái Blockchain Node & Contract
  async function checkNode() {
    try {
      const res = await verifyApi('/api/verify/status');
      setNodeStatus(res.data);
    } catch {
      setNodeStatus({ connected: false, error: 'Không thể kết nối API verify' });
    }
  }

  // 2. Tải danh sách hồ sơ từ backend
  async function loadPropertyList() {
    setLoadingList(true);
    setListError('');
    try {
      const res = await verifyApi('/api/verify/properties');
      const list = Array.isArray(res.data) ? res.data : [];
      setProperties(list);
      // Mặc định chọn hồ sơ đầu tiên nếu chưa chọn
      if (list.length > 0 && !selectedCode) {
        setSelectedCode(list[0].code);
      }
    } catch (err) {
      setListError(err.message || 'Không thể tải danh sách hồ sơ.');
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    checkNode();
    loadPropertyList();
  }, []);

  // 3. Tải chi tiết xác thực khi chọn một mã BĐS
  async function loadDetail(code) {
    if (!code) return;
    setLoadingDetail(true);
    setDetailError('');
    setActionNotice(null);
    setCopiedHash(false);
    try {
      const res = await verifyApi(`/api/verify/${encodeURIComponent(code)}`);
      setDetail(res.data);
    } catch (err) {
      setDetailError(err.message || 'Không tải được chi tiết xác thực.');
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    if (selectedCode) {
      loadDetail(selectedCode);
    }
  }, [selectedCode]);

  // 4. Hiệu ứng tuyết lở (Avalanche effect)
  useEffect(() => {
    let active = true;
    computeBrowserSha256(trialText).then((h) => {
      if (active) setTrialHash(h);
    });
    return () => {
      active = false;
    };
  }, [trialText]);

  // 5. Đăng ký phiên bản lên blockchain
  async function handleRegisterOnChain() {
    if (!detail?.property?.id) return;
    setRegistering(true);
    setActionNotice(null);
    try {
      const res = await verifyApi(`/api/verify/register/${detail.property.id}`, {
        method: 'POST',
      });
      setActionNotice({
        type: 'success',
        message: `Đăng ký thành công! TxHash: ${res.data.txHash ? res.data.txHash.slice(0, 18) + '…' : 'Chưa có'} (Phiên bản ${res.data.versionRecord?.version || 'mới'})`,
      });
      // Tải lại chi tiết và danh sách
      await Promise.all([loadDetail(selectedCode), loadPropertyList(), checkNode()]);
    } catch (err) {
      setActionNotice({
        type: 'error',
        message: err.message || 'Gửi giao dịch lên blockchain thất bại.',
      });
    } finally {
      setRegistering(false);
    }
  }

  const filteredProperties = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) => {
      const text = `${p.code} ${p.address || ''} ${p.owner_name || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [properties, query]);

  async function copyToClipboard(text) {
    if (!navigator.clipboard || !text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-7 lg:px-10">
        <MainNavigation />

        {/* Tiêu đề & Trạng thái Node */}
        <section className="mt-8 flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
              Môn Blockchain · Xác minh dữ liệu
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Xác thực tính toàn vẹn hồ sơ BĐS
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Đối chiếu mã băm SHA-256 của hồ sơ trong PostgreSQL với giá trị bất biến được lưu trên Smart Contract. Phát hiện ngay lập tức nếu dữ liệu bị sửa ngoài quy trình.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            {nodeStatus?.connected && nodeStatus?.contractReady ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Hardhat Node: Đang chạy (Block #{nodeStatus.blockNumber})
              </span>
            ) : nodeStatus?.connected && !nodeStatus?.contractReady ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Node RPC chạy nhưng chưa deploy contract
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Blockchain Node local chưa bật (port 8545)
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                checkNode();
                if (selectedCode) loadDetail(selectedCode);
              }}
              className="text-[11px] text-slate-400 hover:text-indigo-200"
            >
              Làm mới kết nối node ↻
            </button>
          </div>
        </section>

        {/* Bố cục 2 cột: Danh sách hồ sơ bên trái - Chi tiết đối chiếu bên phải */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Cột trái: Tìm kiếm và chọn hồ sơ */}
          <aside className="h-fit overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/80">
            <div className="border-b border-white/[0.07] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Danh sách hồ sơ BĐS</h2>
                <span className="text-xs text-slate-400">{filteredProperties.length} hồ sơ</span>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm mã, địa chỉ, chủ sở hữu..."
                className="mt-3 w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
            </div>

            <div className="max-h-[600px] divide-y divide-white/[0.04] overflow-y-auto">
              {loadingList ? (
                <div className="p-8 text-center text-xs text-slate-500">Đang tải hồ sơ từ PostgreSQL…</div>
              ) : listError ? (
                <div className="p-4 text-xs text-rose-300">{listError}</div>
              ) : filteredProperties.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">Không tìm thấy hồ sơ phù hợp.</div>
              ) : (
                filteredProperties.map((p) => {
                  const active = selectedCode === p.code;
                  const hasTx = !!p.latest_tx_hash;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setSelectedCode(p.code)}
                      className={`block w-full p-3.5 text-left transition ${
                        active ? 'bg-indigo-600/20 border-l-2 border-indigo-400' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-medium text-slate-200">{p.code}</span>
                        {hasTx ? (
                          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-300">
                            v{p.latest_db_version} · On-chain
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                            Chưa ghi chain
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-400">{p.address || 'Chưa có địa chỉ'}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{propertyTypes[p.type] || p.type}</span>
                        <span>{p.area ? `${areaFormat.format(p.area)} m²` : ''}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Cột phải: Chi tiết đối chiếu hash */}
          <section className="space-y-6">
            {loadingDetail ? (
              <div className="grid min-h-[400px] place-items-center rounded-2xl border border-white/[0.08] bg-panel/50">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                  <p className="mt-3 text-xs text-slate-400">Đang đối chiếu dữ liệu với Smart Contract…</p>
                </div>
              </div>
            ) : detailError ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300">
                {detailError}
              </div>
            ) : !detail ? (
              <div className="grid min-h-[350px] place-items-center rounded-2xl border border-dashed border-white/[0.1] bg-panel/30 p-8 text-center text-slate-500">
                Chọn một hồ sơ bất động sản từ danh sách bên trái để bắt đầu xác thực.
              </div>
            ) : (
              <>
                {/* 1. HỘP KẾT QUẢ XÁC THỰC LỚN (Status Banner) */}
                {detail.status === 'MATCH' && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.08] p-6 shadow-lg shadow-emerald-500/5">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-2xl text-emerald-400">
                        ✓
                      </span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-lg font-semibold text-emerald-200">
                            DỮ LIỆU TOÀN VẸN — TRÙNG KHỚP VỚI SMART CONTRACT
                          </h2>
                          <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-xs text-emerald-300">
                            Phiên bản on-chain: #{detail.blockchain?.latest?.versionNumber}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-emerald-100/80">
                          {detail.statusMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {detail.status === 'MODIFIED' && (
                  <div className="rounded-2xl border border-rose-500/50 bg-rose-500/[0.12] p-6 shadow-xl shadow-rose-500/10">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-500/20 text-2xl text-rose-400">
                        ⚠
                      </span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-lg font-bold text-rose-200">
                            CẢNH BÁO: PHÁT HIỆN HỒ SƠ ĐÃ BỊ CHỈNH SỬA BẤT HỢP PHÁP!
                          </h2>
                          <span className="rounded-full bg-rose-500/30 px-3 py-1 font-mono text-xs font-bold text-rose-200">
                            SAI LỆCH MÃ BĂM
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-rose-100">
                          {detail.statusMessage}
                        </p>
                        <p className="mt-2 text-[11px] text-rose-200/70">
                          Mục đích demo: Giảng viên có thể thấy khi ai đó can thiệp sửa trực tiếp dữ liệu trong PostgreSQL (như diện tích, giá, ranh giới), hệ thống lập tức phát hiện vì hash không còn khớp với bản lưu trên Blockchain.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {detail.status === 'NOT_REGISTERED' && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-6">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-2xl text-amber-300">
                        ℹ
                      </span>
                      <div className="flex-1">
                        <h2 className="text-base font-semibold text-amber-200">
                          HỒ SƠ CHƯA ĐĂNG KÝ TRÊN BLOCKCHAIN
                        </h2>
                        <p className="mt-1 text-xs text-amber-100/80">{detail.statusMessage}</p>
                      </div>
                    </div>
                  </div>
                )}

                {detail.status === 'NODE_OFFLINE' && (
                  <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-700 text-2xl text-slate-300">
                        ⚡
                      </span>
                      <div className="flex-1">
                        <h2 className="text-base font-semibold text-slate-200">NODE BLOCKCHAIN LOCAL CHƯA BẬT</h2>
                        <p className="mt-1 text-xs text-slate-400">{detail.statusMessage}</p>
                        <p className="mt-2 font-mono text-[11px] text-indigo-300">
                          terminal &gt; cd contracts &amp;&amp; npx hardhat node
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {actionNotice && (
                  <div
                    className={`rounded-xl border p-4 text-xs ${
                      actionNotice.type === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                    }`}
                  >
                    {actionNotice.message}
                  </div>
                )}

                {/* 2. ĐỐI CHIẾU HASH (Current DB Hash vs Smart Contract Hash) */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Cột trái: Hash tính từ DB hiện tại */}
                  <div className="rounded-2xl border border-white/[0.08] bg-panel p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                        Hash SHA-256 từ PostgreSQL hiện tại
                      </p>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(detail.currentHash)}
                        className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/5"
                      >
                        {copiedHash ? 'Đã chép' : 'Sao chép'}
                      </button>
                    </div>
                    <code className="mt-3 block break-all rounded-lg bg-[#0b0e14] p-3 font-mono text-xs leading-5 text-indigo-200">
                      {detail.currentHash}
                    </code>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Được tính theo chuẩn Canonical JSON từ các trường: mã, địa chỉ, diện tích, loại, giá, ranh giới.
                    </p>
                  </div>

                  {/* Cột phải: Hash lưu trên Blockchain */}
                  <div className="rounded-2xl border border-white/[0.08] bg-panel p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                        Hash lưu trên Smart Contract
                      </p>
                      {detail.blockchain?.latest && (
                        <span className="text-[10px] text-slate-400">
                          Block timestamp:{' '}
                          {new Date(detail.blockchain.latest.timestamp * 1000).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>
                    {detail.blockchain?.latest?.dataHash ? (
                      <code
                        className={`mt-3 block break-all rounded-lg p-3 font-mono text-xs leading-5 ${
                          detail.status === 'MATCH'
                            ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/30'
                            : 'bg-rose-950/40 text-rose-200 border border-rose-500/30'
                        }`}
                      >
                        {detail.blockchain.latest.dataHash}
                      </code>
                    ) : (
                      <div className="mt-3 rounded-lg bg-[#0b0e14] p-3 text-xs italic text-slate-500">
                        Chưa có bản ghi trên chain
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-slate-500">
                      {detail.blockchain?.latest?.registeredBy
                        ? `Người ghi: ${detail.blockchain.latest.registeredBy.slice(0, 10)}…${detail.blockchain.latest.registeredBy.slice(-8)}`
                        : 'Không có dữ liệu người ghi'}
                    </p>
                  </div>
                </div>

                {/* 3. THÔNG TIN HỒ SƠ & NÚT ĐĂNG KÝ BLOCKCHAIN */}
                <article className="rounded-2xl border border-white/[0.08] bg-panel p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-indigo-300">Thông tin hồ sơ</p>
                      <h3 className="mt-1 text-2xl font-semibold text-white">{detail.property.code}</h3>
                      <p className="mt-1 text-xs text-slate-400">{detail.property.address}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/properties/${encodeURIComponent(detail.property.code)}`}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                      >
                        Mở hồ sơ chi tiết ↗
                      </a>
                      {canRegister && (
                        <button
                          type="button"
                          disabled={registering || !nodeStatus?.connected}
                          onClick={handleRegisterOnChain}
                          className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                        >
                          {registering
                            ? 'Đang gửi giao dịch…'
                            : detail.status === 'MATCH'
                            ? 'Ghi đè phiên bản mới lên Chain'
                            : 'Đăng ký phiên bản lên Blockchain'}
                        </button>
                      )}
                    </div>
                  </div>

                  <dl className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <dt className="text-[11px] text-slate-500">Chủ hồ sơ</dt>
                      <dd className="mt-1 text-xs font-medium text-slate-200">
                        {detail.property.owner_name || 'Chưa cập nhật'}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <dt className="text-[11px] text-slate-500">Diện tích</dt>
                      <dd className="mt-1 text-xs font-medium text-slate-200">
                        {areaFormat.format(detail.property.area)} m²
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <dt className="text-[11px] text-slate-500">Loại hình</dt>
                      <dd className="mt-1 text-xs font-medium text-slate-200">
                        {propertyTypes[detail.property.type] || detail.property.type}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <dt className="text-[11px] text-slate-500">Giá tham khảo</dt>
                      <dd className="mt-1 text-xs font-medium text-slate-200">
                        {detail.property.price ? `${moneyFormat.format(detail.property.price)} ₫` : 'Chưa có'}
                      </dd>
                    </div>
                  </dl>

                  {/* Chi tiết dữ liệu chuẩn hóa Canonical JSON */}
                  <details className="mt-4 rounded-xl border border-white/[0.07] bg-[#0b0e14] p-3">
                    <summary className="cursor-pointer text-xs font-medium text-slate-300">
                      Xem dữ liệu chuẩn hóa (Canonical JSON) dùng để tạo SHA-256
                    </summary>
                    <pre className="mt-3 max-h-48 overflow-auto font-mono text-[11px] leading-5 text-indigo-200">
                      {detail.canonicalJson}
                    </pre>
                  </details>
                </article>

                {/* 4. LỊCH SỬ CÁC PHIÊN BẢN (VERSION HISTORY) */}
                <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-panel">
                  <div className="border-b border-white/[0.07] p-5">
                    <h3 className="text-sm font-semibold text-white">Lịch sử các phiên bản hồ sơ</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Lịch sử ghi vết trong database PostgreSQL và các bản ghi on-chain trên Smart Contract.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    {detail.database?.history?.length > 0 ? (
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-slate-500">
                            <th className="px-5 py-3">Phiên bản</th>
                            <th className="px-5 py-3">Mã Hash (SHA-256)</th>
                            <th className="px-5 py-3">Giao dịch Blockchain (TxHash)</th>
                            <th className="px-5 py-3">Thời gian</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {detail.database.history.map((ver) => (
                            <tr key={ver.id || ver.version} className="hover:bg-white/[0.02]">
                              <td className="px-5 py-3 font-semibold text-indigo-300">v{ver.version}</td>
                              <td className="px-5 py-3 font-mono text-[11px] text-slate-300">
                                {ver.data_hash.slice(0, 16)}…{ver.data_hash.slice(-10)}
                              </td>
                              <td className="px-5 py-3 font-mono text-[11px]">
                                {ver.tx_hash ? (
                                  <span className="text-emerald-400">
                                    {ver.tx_hash.slice(0, 14)}…{ver.tx_hash.slice(-8)}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic">Chưa ghi on-chain</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-slate-400">
                                {new Date(ver.created_at).toLocaleString('vi-VN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-500">
                        Chưa có lịch sử phiên bản nào được ghi vết.
                      </div>
                    )}
                  </div>
                </article>

                {/* 5. THỬ NGHIỆM HIỆU ỨNG TUYẾT LỞ (Avalanche Effect) */}
                <article className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                        Giải thích lý thuyết Blockchain
                      </span>
                      <h3 className="mt-1 text-sm font-semibold text-white">
                        Thử nghiệm Hiệu ứng tuyết lở của SHA-256 (Avalanche Effect)
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Hãy thử thay đổi 1 ký tự duy nhất bên dưới (ví dụ sửa số diện tích 85.5 thành 85.6) để thấy toàn bộ 64 ký tự của mã băm SHA-256 bị xáo trộn hoàn toàn.
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-300">
                      Tính toán trực tiếp
                    </span>
                  </div>

                  <input
                    value={trialText}
                    onChange={(e) => setTrialText(e.target.value)}
                    className="mt-4 w-full rounded-lg border border-white/[0.1] bg-[#0b0e14] px-3 py-2 font-mono text-xs text-white focus:border-indigo-400 focus:outline-none"
                  />

                  <div className="mt-3 rounded-lg bg-[#0b0e14] p-3">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Mã băm SHA-256:</span>
                    <code className="mt-1 block break-all font-mono text-xs text-indigo-300">{trialHash}</code>
                  </div>
                </article>
              </>
            )}
          </section>
        </div>

        <footer className="mt-12 border-t border-white/[0.08] pt-6 text-center text-xs text-slate-500">
          Chỉ xác minh tính toàn vẹn dữ liệu, không xác minh quyền sở hữu pháp lý.
        </footer>
      </div>
    </main>
  );
}

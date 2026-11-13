import React, { useEffect, useMemo, useState } from 'react';
import MainNavigation from '../components/MainNavigation.jsx';
import { DEMO_PROPERTIES_CHANGED, loadDemoProperties } from '../lib/demoProperties.js';

const areaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const propertyTypes = { house: 'Nhà ở', apartment: 'Căn hộ', land: 'Đất nền', commercial: 'Thương mại' };

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

async function previewHash(feature) {
  if (!window.crypto?.subtle) throw new Error('Trình duyệt hiện tại không hỗ trợ Web Crypto.');
  const payload = stableValue({ properties: feature.properties, geometry: feature.geometry });
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashText(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function VerifyPage() {
  const [properties, setProperties] = useState(loadDemoProperties);
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [hash, setHash] = useState('');
  const [hashing, setHashing] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [trialText, setTrialText] = useState('BDS001');
  const [trialHash, setTrialHash] = useState('');
  const [trialError, setTrialError] = useState('');

  useEffect(() => {
    const sync = (event) => setProperties(Array.isArray(event.detail) ? event.detail : loadDemoProperties());
    window.addEventListener(DEMO_PROPERTIES_CHANGED, sync);
    return () => window.removeEventListener(DEMO_PROPERTIES_CHANGED, sync);
  }, []);

  const features = useMemo(() => properties
    .filter((property) => property.geometry)
    .map(({ geometry, ...property }) => ({ type: 'Feature', geometry, properties: property })), [properties]);

  const filtered = useMemo(() => features.filter((feature) => {
    const p = feature.properties;
    const text = `${p.code} ${p.address} ${p.owner_name}`.toLocaleLowerCase('vi');
    return text.includes(query.trim().toLocaleLowerCase('vi'));
  }), [query]);
  const selected = features.find((feature) => feature.properties.code === selectedCode);

  useEffect(() => {
    let active = true;
    if (!window.crypto?.subtle) {
      setTrialError('Trình duyệt hiện tại không hỗ trợ Web Crypto.');
      return () => { active = false; };
    }
    hashText(trialText)
      .then((value) => { if (active) { setTrialHash(value); setTrialError(''); } })
      .catch(() => { if (active) setTrialError('Không tính được hash cho chuỗi thử nghiệm.'); });
    return () => { active = false; };
  }, [trialText]);

  function selectFeature(feature) {
    setSelectedCode(feature.properties.code);
    setHash('');
    setNotice('');
    setCopied(false);
  }

  async function handlePreviewHash() {
    if (!selected) return;
    setHashing(true);
    setNotice('');
    setCopied(false);
    try {
      setHash(await previewHash(selected));
      setNotice('Hash SHA-256 được tính cục bộ từ GeoJSON mẫu; chưa được ghi hoặc đối chiếu trên blockchain.');
    } catch (error) {
      setNotice(error.message || 'Không tạo được hash xem trước.');
    } finally {
      setHashing(false);
    }
  }

  async function copyHash() {
    if (!hash || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
    } catch {
      setNotice('Trình duyệt không cho phép sao chép tự động.');
    }
  }

  return <main className="min-h-screen bg-canvas text-slate-100">
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-7 lg:px-10">
      <MainNavigation />

      <section className="mt-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Toàn vẹn dữ liệu</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-4xl">Xác thực hồ sơ</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Tra cứu hồ sơ mẫu và tạo hash xem trước để chuẩn bị đối chiếu với blockchain.</p></div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[0.04] px-3 py-1.5 text-xs text-amber-100/80"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />Chế độ giao diện demo</span>
      </section>

      <div className="mt-7 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
          <div className="border-b border-white/[0.07] p-4"><h2 className="text-sm font-medium text-white">Chọn hồ sơ</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} hồ sơ mẫu</p><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã, địa chỉ, chủ hồ sơ..." aria-label="Tìm hồ sơ để xác thực" className="mt-4 w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/40" /></div>
          <div className="max-h-[65vh] divide-y divide-white/[0.05] overflow-y-auto">
            {filtered.map((feature) => { const p = feature.properties; const active = selectedCode === p.code; return <button type="button" key={p.code} onClick={() => selectFeature(feature)} className={`block w-full px-4 py-3.5 text-left transition ${active ? 'bg-indigo-300/[0.09]' : 'hover:bg-white/[0.025]'}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-200">{p.code}</span><span className="text-[10px] text-slate-500">{propertyTypes[p.type] || p.type}</span></div><p className="mt-1.5 truncate text-xs text-slate-400">{p.address}</p></button>; })}
            {!filtered.length && <p className="px-4 py-12 text-center text-sm text-slate-500">Không tìm thấy hồ sơ phù hợp.</p>}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {!selected ? <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-panel/40 p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-xl text-slate-500">⌕</span><h2 className="mt-4 text-lg font-medium text-white">Chọn hồ sơ để bắt đầu</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Chọn một hồ sơ trong danh sách để xem thông tin và tạo hash SHA-256 mẫu.</p></div></div>
            : <>
              <article className="rounded-2xl border border-white/[0.08] bg-panel/70 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.14em] text-indigo-200/70">Hồ sơ được chọn</p><h2 className="mt-2 text-xl font-medium text-white">{selected.properties.code}</h2><p className="mt-1 text-sm text-slate-400">{selected.properties.address}</p></div><span className="rounded-full border border-white/[0.09] px-3 py-1 text-xs text-slate-400">{propertyTypes[selected.properties.type] || selected.properties.type}</span></div>
                <dl className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><dt className="text-[11px] text-slate-500">Chủ hồ sơ</dt><dd className="mt-1.5 text-sm text-slate-200">{selected.properties.owner_name || 'Chưa cập nhật'}</dd></div><div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><dt className="text-[11px] text-slate-500">Diện tích</dt><dd className="mt-1.5 text-sm text-slate-200">{areaFormat.format(selected.properties.area)} m²</dd></div><div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><dt className="text-[11px] text-slate-500">Geometry</dt><dd className="mt-1.5 text-sm text-slate-200">{selected.geometry.type}</dd></div></dl>
                <a href={`/properties/${encodeURIComponent(selected.properties.code)}`} className="mt-4 inline-flex rounded-lg border border-white/[0.1] px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-300/[0.06]">Mở hồ sơ chi tiết ↗</a>
              </article>

              <article className="rounded-2xl border border-amber-200/15 bg-amber-200/[0.035] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.14em] text-amber-100/65">Trạng thái đăng ký</p><h2 className="mt-2 text-lg font-medium text-amber-50">Chưa đăng ký blockchain</h2><p className="mt-1 text-sm text-slate-400">Hồ sơ mẫu này chưa có phiên bản hoặc hash lưu trên chain.</p></div><span className="rounded-lg border border-amber-100/15 px-3 py-2 text-xs text-amber-100/75">Node/contract chưa kết nối</span></div>
                <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={hashing} onClick={handlePreviewHash} className="rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-indigo-200 disabled:opacity-60">{hashing ? 'Đang tính hash…' : hash ? 'Tính lại hash xem trước' : 'Tạo hash xem trước'}</button><span className="text-xs text-slate-500">Hash cục bộ không chứng minh hồ sơ đã ghi lên chain.</span></div>
                {hash && <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-xl border border-white/[0.07] bg-[#0b0e14] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Hash tính lại từ dữ liệu mẫu</p><button type="button" onClick={copyHash} className="rounded-md border border-white/[0.1] px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.04]">{copied ? 'Đã sao chép' : 'Sao chép'}</button></div><code className="mt-3 block break-all font-mono text-xs leading-6 text-indigo-100">{hash}</code></div><div className="rounded-xl border border-white/[0.07] bg-[#0b0e14] p-4"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Hash lưu trên blockchain</p><p className="mt-3 font-mono text-xs text-slate-500">Chưa có — hồ sơ chưa đăng ký</p></div></div>}
                {notice && <p role="status" className="mt-3 text-xs leading-5 text-amber-100/80">{notice}</p>}
                {hash && <details className="mt-4 rounded-xl border border-white/[0.07] bg-[#0b0e14] p-4"><summary className="cursor-pointer text-xs font-medium text-slate-300">Dữ liệu chuẩn hóa dùng để tính hash</summary><pre className="mt-3 max-h-64 overflow-auto text-[11px] leading-5 text-slate-400">{JSON.stringify(stableValue({ properties: selected.properties, geometry: selected.geometry }), null, 2)}</pre></details>}
              </article>

              <article className="rounded-2xl border border-white/[0.08] bg-panel/70 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.14em] text-indigo-200/70">Thử nghiệm SHA-256</p><h2 className="mt-2 text-base font-medium text-white">Sửa một ký tự, quan sát hash đổi</h2><p className="mt-1 text-xs leading-5 text-slate-500">Ví dụ minh họa hiệu ứng băm; không dùng để xác minh hồ sơ hay blockchain.</p></div><span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-slate-500">Chạy ngay trên trình duyệt</span></div><label className="mt-4 block"><span className="sr-only">Chuỗi thử nghiệm</span><input value={trialText} onChange={(event) => setTrialText(event.target.value)} className="w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 font-mono text-sm text-slate-200 outline-none focus:border-indigo-300/40" /></label>{trialError ? <p role="alert" className="mt-3 text-xs text-rose-200">{trialError}</p> : <code className="mt-3 block break-all font-mono text-[11px] leading-5 text-indigo-100">{trialHash || 'Đang tính…'}</code>}</article>

              <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
                <div className="border-b border-white/[0.07] px-5 py-4"><h2 className="text-sm font-medium text-white">Lịch sử xác thực</h2><p className="mt-1 text-xs text-slate-500">Phiên bản, hash đã ghi và transaction blockchain</p></div>
                <div className="grid min-h-36 place-items-center p-6 text-center"><div><p className="text-sm text-slate-300">Chưa có lịch sử on-chain</p><p className="mt-1 text-xs text-slate-500">Dữ liệu lịch sử sẽ hiện tại đây khi backend/contract được tích hợp.</p></div></div>
              </article>
            </>}
        </section>
      </div>
      <footer className="mx-auto max-w-7xl px-4 pb-6 sm:px-7 lg:px-10"><p className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-center text-xs leading-5 text-slate-400">Chỉ xác minh tính toàn vẹn dữ liệu, không xác minh quyền sở hữu pháp lý.</p></footer>
    </div>
  </main>;
}

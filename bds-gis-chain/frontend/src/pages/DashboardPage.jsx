import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MainNavigation from '../components/MainNavigation.jsx';
import PageGuide from '../components/PageGuide.jsx';
import { getAuthToken } from '../lib/authSession.js';

const labels = { house: 'Nhà ở', apartment: 'Căn hộ', land: 'Đất nền', commercial: 'Thương mại' };
const colors = { house: '#fb7185', apartment: '#38bdf8', land: '#4ade80', commercial: '#fbbf24' };
const areaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const moneyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

async function dashboardApi(path, signal) {
  const token = getAuthToken();
  if (!token) throw new Error('Vui lòng đăng nhập để xem số liệu hồ sơ.');
  const response = await fetch(path, { signal, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || body?.message || `API trả về HTTP ${response.status}.`);
  return body;
}

async function loadDashboardProperties(signal) {
  const all = [];
  let page = 1;
  let pages = 1;
  do {
    const params = new URLSearchParams({ page: String(page), limit: '100' });
    const body = await dashboardApi(`/api/properties?${params}`, signal);
    all.push(...(Array.isArray(body.data) ? body.data : []));
    pages = Number(body.pagination?.pages) || 1;
    page += 1;
  } while (page <= pages && !signal?.aborted);
  return all.map((property) => ({
    ...property,
    area: Number(property.area) || 0,
    geometry: property.boundary || property.location || null,
  }));
}

function StatCard({ label, value, note, tone = 'indigo', href }) {
  const tones = {
    indigo: 'border-indigo-200/10 bg-indigo-200/[0.035] text-indigo-100',
    green: 'border-emerald-200/10 bg-emerald-200/[0.035] text-emerald-100',
    red: 'border-rose-200/10 bg-rose-200/[0.035] text-rose-100',
    gray: 'border-white/[0.08] bg-white/[0.025] text-slate-100',
  };
  const content = <><p className="text-xs text-slate-500">{label}</p><p className={`mt-3 text-2xl font-medium tracking-tight ${tones[tone].split(' ').at(-1)}`}>{value}</p><p className="mt-1.5 text-xs leading-5 text-slate-500">{note}</p></>;
  return href ? <a href={href} className={`block rounded-2xl border p-4 transition hover:border-white/20 sm:p-5 ${tones[tone]}`}>{content}</a> : <div className={`rounded-2xl border p-4 sm:p-5 ${tones[tone]}`}>{content}</div>;
}

function MiniMap({ features }) {
  const node = useRef(null);
  useEffect(() => {
    if (!node.current) return undefined;
    const map = L.map(node.current, { zoomControl: false, attributionControl: true, preferCanvas: true });
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Tiles &copy; Esri, HERE, Garmin, USGS, &copy; OpenStreetMap contributors',
    }).addTo(map);
    map.setView([21.0285, 105.8542], 6);
    const bounds = L.latLngBounds();
    features.forEach((feature) => {
      const geometry = L.geoJSON(feature);
      const center = geometry.getBounds().getCenter();
      bounds.extend(center);
      const p = feature.properties;
      L.circleMarker(center, { radius: 4, color: '#fff', weight: 1, fillColor: colors[p.type] || '#a5b4fc', fillOpacity: 1 })
        .bindTooltip(`${p.code} · ${p.address}`)
        .addTo(map);
    });
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.08), { maxZoom: 14 });
    return () => map.remove();
  }, [features]);

  return <div ref={node} className="h-72 w-full bg-[#171b24]" aria-label="Bản đồ thu nhỏ vị trí hồ sơ từ database" />;
}

export default function DashboardPage() {
  const [properties, setProperties] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      loadDashboardProperties(controller.signal),
      dashboardApi('/api/gis/statistics', controller.signal),
    ])
      .then(([items, statsBody]) => {
        if (controller.signal.aborted) return;
        setProperties(items);
        setStatistics(statsBody.data || null);
      })
      .catch((loadError) => { if (!controller.signal.aborted) setError(loadError.message || 'Không tải được dữ liệu tổng quan.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reloadKey]);

  const features = useMemo(() => properties
    .filter((property) => property.geometry)
    .map(({ geometry, ...property }) => ({ type: 'Feature', geometry, properties: property })), [properties]);
  const total = Number(statistics?.summary?.total) || 0;
  const totalArea = Number(statistics?.summary?.total_area_m2) || 0;
  const averagePrice = Number(statistics?.summary?.average_price) || 0;
  const typeCounts = Object.keys(labels).map((type) => ({
    type,
    count: Number(statistics?.by_type?.find((item) => item.type === type)?.count) || 0,
  }));
  const maxCount = Math.max(...typeCounts.map((item) => item.count), 1);

  return <main className="min-h-screen bg-canvas text-slate-100">
    <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-7 lg:px-10">
      <MainNavigation />
      <section className="flex flex-wrap items-end justify-between gap-4 pt-8"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Không gian làm việc</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Tổng quan</h1><p className="mt-2 text-sm text-slate-400">Nắm nhanh quy mô hồ sơ và vị trí bất động sản của bạn.</p></div><span className="inline-flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-50 px-3 py-1.5 text-xs text-amber-800"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Đối chiếu blockchain chưa khả dụng</span></section>
      <PageGuide steps={['Xem nhanh số hồ sơ, diện tích và giá tham khảo.', 'Chọn một chỉ số hoặc “Mở bản đồ” để xem dữ liệu chi tiết.', 'Dùng thanh điều hướng bên trái để mở các chức năng khác.']} note="Số liệu trên trang lấy từ hồ sơ đã lưu. Đối chiếu blockchain sẽ được bật sau khi kết nối." />

      {error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/15 bg-rose-200/[0.04] px-4 py-3 text-sm text-rose-100/85"><span>{error}</span><div className="flex gap-2"><a href="/login" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.05]">Đăng nhập</a><button type="button" onClick={() => setReloadKey((key) => key + 1)} className="rounded-lg bg-rose-200/10 px-3 py-2 text-xs text-rose-100 hover:bg-rose-200/15">Thử lại</button></div></div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Chỉ số tổng quan">
        <StatCard label="Tổng hồ sơ" value={loading ? '…' : error ? '—' : total} note="Hồ sơ đang được quản lý" href="/properties" />
        <StatCard label="Tổng diện tích" value={loading ? '…' : error ? '—' : `${areaFormat.format(totalArea)} m²`} note="Cộng diện tích các hồ sơ" tone="green" />
        <StatCard label="Giá tham khảo trung bình" value={loading ? '…' : error ? '—' : `${moneyFormat.format(averagePrice)} ₫`} note="Từ hồ sơ đã có giá" tone="gray" />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5"><div><h2 className="text-sm font-medium text-white">Vị trí hồ sơ</h2><p className="mt-1 text-xs text-slate-500">{loading ? 'Đang tải…' : `${features.length} hồ sơ có vị trí`}</p></div><a href="/gis" className="text-xs text-indigo-200 hover:text-white">Mở bản đồ ↗</a></div>
          {loading && !features.length ? <div className="grid h-72 place-items-center text-sm text-slate-500">Đang tải vị trí từ PostGIS…</div> : error && !features.length ? <div className="grid h-72 place-items-center px-6 text-center text-sm text-slate-500">Không tải được vị trí hồ sơ.</div> : !loading && !features.length ? <div className="grid h-72 place-items-center px-6 text-center text-sm text-slate-500">Database chưa có hồ sơ có geometry.</div> : <MiniMap features={features} />}
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-2xl border border-white/[0.08] bg-panel/70 p-5"><h2 className="text-sm font-medium text-white">Bất động sản theo loại</h2><p className="mt-1 text-xs text-slate-500">Phân bố các hồ sơ hiện có</p><div className="mt-5 space-y-4">{typeCounts.map(({ type, count }) => <div key={type}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-300">{labels[type]}</span><span className="tabular-nums text-slate-500">{loading ? '…' : error ? '—' : count}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full transition-[width]" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: colors[type] }} /></div></div>)}</div></article>
          <article className="rounded-2xl border border-amber-200/50 bg-amber-50 p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">◇</span><div><h2 className="text-sm font-medium text-amber-950">Đối chiếu dữ liệu</h2><p className="mt-2 text-sm leading-6 text-amber-900">Tính năng xác thực blockchain chưa được kết nối. Hiện tại hệ thống chưa thể xác nhận hồ sơ đã được ghi nhận hoặc có thay đổi.</p><a href="/verify" className="mt-3 inline-flex text-xs font-semibold text-amber-900 hover:underline">Tìm hiểu về kiểm tra hồ sơ ↗</a></div></div></article>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-white/[0.08] bg-panel/70">
        <div className="border-b border-white/[0.07] px-5 py-4"><h2 className="text-sm font-medium text-white">Hoạt động gần đây</h2><p className="mt-1 text-xs text-slate-500">Cập nhật hồ sơ và thao tác tài khoản</p></div>
        <div className="grid min-h-36 place-items-center p-6 text-center"><div><p className="text-sm text-slate-300">Chưa có hoạt động để hiển thị</p><p className="mt-1 text-xs text-slate-500">Nhật ký hoạt động sẽ xuất hiện khi tính năng này được bật.</p></div></div>
      </section>

      <p className="mt-6 text-center text-xs text-slate-600">Thông tin hồ sơ không thay thế giấy tờ pháp lý và không xác nhận quyền sở hữu.</p>
    </div>
  </main>;
}

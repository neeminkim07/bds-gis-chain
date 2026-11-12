import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MainNavigation from '../components/MainNavigation.jsx';
import { DEMO_PROPERTIES_CHANGED, loadDemoProperties } from '../lib/demoProperties.js';

const labels = { house: 'Nhà ở', apartment: 'Căn hộ', land: 'Đất nền', commercial: 'Thương mại' };
const colors = { house: '#fb7185', apartment: '#38bdf8', land: '#4ade80', commercial: '#fbbf24' };
const areaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

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

  return <div ref={node} className="h-72 w-full bg-[#171b24]" aria-label="Bản đồ thu nhỏ vị trí bất động sản mẫu" />;
}

export default function DashboardPage() {
  const [properties, setProperties] = useState(loadDemoProperties);
  useEffect(() => {
    const sync = (event) => setProperties(Array.isArray(event.detail) ? event.detail : loadDemoProperties());
    window.addEventListener(DEMO_PROPERTIES_CHANGED, sync);
    return () => window.removeEventListener(DEMO_PROPERTIES_CHANGED, sync);
  }, []);
  const features = useMemo(() => properties
    .filter((property) => property.geometry)
    .map(({ geometry, ...property }) => ({ type: 'Feature', geometry, properties: property })), [properties]);
  const totalArea = useMemo(() => properties.reduce((sum, property) => sum + (Number(property.area) || 0), 0), [properties]);
  const typeCounts = useMemo(() => Object.keys(labels).map((type) => ({ type, count: properties.filter((property) => property.type === type).length })), [properties]);
  const maxCount = Math.max(...typeCounts.map((item) => item.count), 1);

  return <main className="min-h-screen bg-canvas text-slate-100">
    <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-7 lg:px-10">
      <MainNavigation rightSlot={<span className="hidden rounded-full border border-amber-200/10 bg-amber-200/[0.04] px-3 py-1.5 text-[11px] text-amber-100/70 sm:inline-flex">Dữ liệu mẫu</span>} />
      <section className="flex flex-wrap items-end justify-between gap-4 pt-8"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Không gian làm việc</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Tổng quan</h1><p className="mt-2 text-sm text-slate-400">Tổng hợp hồ sơ mẫu, dữ liệu GIS và trạng thái blockchain.</p></div><div className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-200/[0.04] px-3 py-1.5 text-xs text-amber-100/75"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />Node blockchain chưa kết nối</div></section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số tổng quan">
        <StatCard label="Tổng bất động sản" value={features.length} note="Hồ sơ GeoJSON mẫu" href="/properties" />
        <StatCard label="Tổng diện tích" value={`${areaFormat.format(totalArea)} m²`} note="Cộng diện tích nhập trong hồ sơ" tone="green" />
        <StatCard label="Đã ghi lên blockchain" value="0" note="Chưa có dữ liệu transaction on-chain" tone="gray" href="/verify" />
        <StatCard label="Cảnh báo chỉnh sửa" value="—" note="Chưa thể so sánh khi chưa có hash trên chain" tone="red" href="/verify" />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5"><div><h2 className="text-sm font-medium text-white">Vị trí hồ sơ mẫu</h2><p className="mt-1 text-xs text-slate-500">{features.length} marker · ArcGIS</p></div><a href="/gis" className="text-xs text-indigo-200 hover:text-white">Mở bản đồ ↗</a></div>
          <MiniMap features={features} />
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-2xl border border-white/[0.08] bg-panel/70 p-5"><h2 className="text-sm font-medium text-white">Bất động sản theo loại</h2><p className="mt-1 text-xs text-slate-500">Phân bố từ GeoJSON mẫu</p><div className="mt-5 space-y-4">{typeCounts.map(({ type, count }) => <div key={type}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-300">{labels[type]}</span><span className="tabular-nums text-slate-500">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: colors[type] }} /></div></div>)}</div></article>
          <article className="rounded-2xl border border-white/[0.08] bg-panel/70 p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-medium text-white">Trạng thái xác minh</h2><p className="mt-1 text-xs text-slate-500">Chưa có dữ liệu on-chain</p></div><span className="rounded-full border border-slate-300/10 px-2.5 py-1 text-[10px] text-slate-400">Chưa đăng ký</span></div><div className="mt-5 flex items-center gap-4"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-full" style={{ background: 'conic-gradient(#64748b 0 100%)' }}><div className="grid h-14 w-14 place-items-center rounded-full bg-panel text-sm font-medium text-white">0%</div></div><div><p className="text-sm text-slate-200">{features.length} hồ sơ chưa có hash chain</p><p className="mt-1 text-xs leading-5 text-slate-500">Chưa thể kết luận hồ sơ khớp hay bị chỉnh sửa khi chưa ghi phiên bản.</p></div></div></article>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-white/[0.08] bg-panel/70">
        <div className="border-b border-white/[0.07] px-5 py-4"><h2 className="text-sm font-medium text-white">Hoạt động gần đây</h2><p className="mt-1 text-xs text-slate-500">Giao dịch và cập nhật hồ sơ</p></div>
        <div className="grid min-h-36 place-items-center p-6 text-center"><div><p className="text-sm text-slate-300">Chưa có hoạt động</p><p className="mt-1 text-xs text-slate-500">Backend và blockchain chưa cung cấp lịch sử hoạt động.</p></div></div>
      </section>

      <p className="mt-6 text-center text-xs text-slate-600">Dữ liệu hồ sơ là mẫu. Hệ thống chỉ hướng tới xác minh tính toàn vẹn dữ liệu, không xác minh quyền sở hữu pháp lý.</p>
    </div>
  </main>;
}

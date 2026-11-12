import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import MainNavigation from '../components/MainNavigation.jsx';
import { getCachedUser } from '../lib/authSession.js';
import { DEMO_PROPERTIES_CHANGED, initialDemoProperties, loadDemoProperties, saveDemoProperties } from '../lib/demoProperties.js';

const typeLabels = {
  house: 'Nhà ở',
  apartment: 'Căn hộ',
  land: 'Đất nền',
  commercial: 'Thương mại',
};

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const areaNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

function formatPrice(value) {
  if (!value) return 'Chưa có giá';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  return `${money.format(value)} ₫`;
}

function Icon({ name, className = 'h-4 w-4' }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    area: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v4H4m16 3h-4v-4m-7 13v-4H4m12 4v-4h4" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}

function Metric({ label, value, hint, icon }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="text-slate-400"><Icon name={icon} /></span>
      </div>
      <div className="mt-3 text-2xl font-medium tracking-tight text-slate-100">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function BoundaryEditor({ geometry, onChange }) {
  const mapNode = React.useRef(null);
  const mapRef = React.useRef(null);
  const layerRef = React.useRef(null);
  const onChangeRef = React.useRef(onChange);
  const [points, setPoints] = useState(() => geometry?.type === 'Polygon'
    ? (geometry.coordinates?.[0] || []).slice(0, -1).map(([lng, lat]) => [lat, lng])
    : []);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined;
    const map = L.map(mapNode.current, { zoomControl: false, preferCanvas: true }).setView([21.0285, 105.8542], 15);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, &copy; OpenStreetMap contributors',
    }).addTo(map);
    const layers = L.featureGroup().addTo(map);
    map.on('click', (event) => setPoints((current) => [...current, [event.latlng.lat, event.latlng.lng]]));
    mapRef.current = map;
    layerRef.current = layers;
    if (points.length >= 3) {
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.25), { maxZoom: 17 });
    }
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const layers = layerRef.current;
    if (!layers) return;
    layers.clearLayers();
    if (points.length >= 3) {
      L.polygon(points, { color: '#a5b4fc', weight: 3, fillColor: '#818cf8', fillOpacity: 0.22 }).addTo(layers);
    } else {
      points.forEach((point, index) => L.circleMarker(point, { radius: 5, color: '#0b0e14', weight: 2, fillColor: '#c4b5fd', fillOpacity: 1 }).bindTooltip(`Điểm ${index + 1}`).addTo(layers));
      if (points.length > 1) L.polyline(points, { color: '#a5b4fc', dashArray: '5 5' }).addTo(layers);
    }
    const coordinates = points.map(([lat, lng]) => [lng, lat]);
    if (coordinates.length >= 3) coordinates.push(coordinates[0]);
    const nextGeometry = coordinates.length >= 4
      ? { type: 'Polygon', coordinates: [coordinates] }
      : null;
    onChangeRef.current(nextGeometry);
  }, [points]);

  return <div className="sm:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-medium text-slate-300">Ranh giới thửa</p><p className="mt-1 text-[11px] text-slate-500">Bấm bản đồ để thêm đỉnh polygon. Cần ít nhất 3 điểm.</p></div><div className="flex gap-2"><button type="button" disabled={!points.length} onClick={() => setPoints((current) => current.slice(0, -1))} className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-slate-300 disabled:opacity-40">Hoàn tác</button><button type="button" disabled={!points.length} onClick={() => setPoints([])} className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-slate-300 disabled:opacity-40">Xóa ranh giới</button></div></div>
    <div ref={mapNode} className="mt-3 h-64 overflow-hidden rounded-xl border border-white/[0.1] bg-[#171b24]" aria-label="Bản đồ vẽ ranh giới hồ sơ" />
    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>{points.length} điểm đã chọn</span><span>EPSG:4326 · Esri</span></div>
  </div>;
}

function PropertyModal({ mode, property, existingCodes, canManage, onClose, onEdit, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(() => mode === 'edit'
    ? { ...property, area: String(property.area ?? ''), price: String(property.price ?? '') }
    : { code: '', owner_name: '', address: '', area: '', price: '', type: 'house', description: '', document_status: 'Chưa cung cấp' });
  const [geometry, setGeometry] = useState(() => mode === 'edit' ? property.geometry : null);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  function submit(event) {
    event.preventDefault();
    const code = mode === 'edit' ? property.code : form.code.trim() || `DEMO-${Date.now().toString().slice(-5)}`;
    if (mode === 'create' && existingCodes.includes(code)) {
      setFormError(`Mã ${code} đã tồn tại. Hãy chọn mã khác.`);
      return;
    }
    const ring = geometry?.type === 'Polygon' ? geometry.coordinates?.[0] : null;
    if (!ring || ring.length < 4) {
      setFormError('Vẽ ranh giới thửa bằng ít nhất 3 điểm trước khi lưu.');
      return;
    }
    const nextProperty = { ...property, ...form, code, area: Number(form.area), price: Number(form.price) || 0, geometry };
    if (mode === 'edit') onUpdate(property.code, nextProperty);
    else onCreate(nextProperty);
    setSaved(true);
    window.setTimeout(onClose, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="property-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-[#11141c] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-indigo-200">{mode === 'detail' ? 'Thông tin hồ sơ' : 'Dữ liệu demo'}</p>
            <h2 id="property-dialog-title" className="mt-2 text-xl font-medium text-white">{mode === 'detail' ? property.code : mode === 'edit' ? `Sửa hồ sơ ${property.code}` : 'Thêm hồ sơ bất động sản'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Đóng"><Icon name="close" /></button>
        </div>

        {mode === 'detail' ? (
          <>
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Chủ hồ sơ', property.owner_name || 'Chưa cập nhật'],
              ['Loại hình', typeLabels[property.type] || property.type],
              ['Địa chỉ', property.address || 'Chưa cập nhật'],
              ['Diện tích', `${areaNumber.format(property.area)} m²`],
              ['Giá tham khảo', formatPrice(property.price)],
              ['Geometry', property.geometry?.type || 'Chưa có'],
              ['Tình trạng giấy tờ', property.document_status || 'Chưa cập nhật'],
              ['Tọa độ tâm ước tính', property.geometry ? (() => { const point = L.geoJSON(property.geometry).getBounds().getCenter(); return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`; })() : 'Chưa có'],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-sm text-slate-200">{value}</dd></div>)}
          </dl>
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-xs text-slate-500">Mô tả</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{property.description || 'Chưa có mô tả.'}</p></div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {!canManage ? <p className="text-xs text-slate-500">Chỉ tài khoản Admin được sửa hoặc xóa hồ sơ.</p> : confirmDelete ? <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-3"><p className="text-sm text-rose-100/80">Xóa {property.code} khỏi dữ liệu demo đã lưu trên trình duyệt?</p><div className="flex gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Hủy</button><button type="button" onClick={() => onDelete(property.code)} className="rounded-lg bg-rose-400 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-rose-300">Xác nhận xóa</button></div></div> : <><p className="text-xs text-slate-500">Thay đổi được lưu trong trình duyệt này, chưa gửi lên backend.</p><div className="flex gap-2"><button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-rose-300/20 px-3 py-2 text-sm text-rose-200 hover:bg-rose-300/[0.08]">Xóa</button><button type="button" onClick={onEdit} className="rounded-lg bg-indigo-300 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-indigo-200">Sửa hồ sơ</button></div></>}
          </div>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            {mode === 'edit' ? <div className="text-xs text-slate-400">Mã hồ sơ<input value={property.code} readOnly className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-500 outline-none" /></div> : <label className="text-xs text-slate-400">Mã hồ sơ <span className="text-slate-600">(để trống sẽ tự tạo)</span><input name="code" value={form.code} onChange={update} placeholder="VD: DEMO-001" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>}
            <label className="text-xs text-slate-400">Chủ hồ sơ<input name="owner_name" value={form.owner_name} onChange={update} required placeholder="Tên chủ hồ sơ" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            <label className="text-xs text-slate-400 sm:col-span-2">Địa chỉ<input name="address" value={form.address} onChange={update} required placeholder="Địa chỉ bất động sản" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            <label className="text-xs text-slate-400">Loại hình<select name="type" value={form.type} onChange={update} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-300/50">{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-xs text-slate-400">Diện tích (m²)<input name="area" value={form.area} onChange={update} type="number" min="0.1" step="0.1" required placeholder="120" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            <label className="text-xs text-slate-400 sm:col-span-2">Giá tham khảo (VND)<input name="price" value={form.price} onChange={update} type="number" min="0" step="1000000" placeholder="Để trống nếu chưa có" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            <label className="text-xs text-slate-400">Tình trạng giấy tờ<select name="document_status" value={form.document_status || 'Chưa cung cấp'} onChange={update} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none"><option>Chưa cung cấp</option><option>Đã tiếp nhận</option><option>Cần bổ sung</option></select></label>
            <label className="text-xs text-slate-400 sm:col-span-2">Mô tả<textarea name="description" value={form.description || ''} onChange={update} rows="3" maxLength="1000" placeholder="Thông tin mô tả thêm về hồ sơ…" className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            <BoundaryEditor key={`${mode}-${property?.code ?? 'new'}`} geometry={geometry} onChange={setGeometry} />
            {formError && <p role="alert" className="text-xs text-rose-300 sm:col-span-2">{formError}</p>}
            <div className="flex items-center justify-between gap-4 pt-2 sm:col-span-2"><p className="text-xs leading-5 text-slate-500">Lưu trong trình duyệt này; chưa đồng bộ lên backend hoặc thiết bị khác.</p><button type="submit" className="shrink-0 rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-indigo-200">{saved ? (mode === 'edit' ? 'Đã cập nhật' : 'Đã thêm') : (mode === 'edit' ? 'Lưu thay đổi' : 'Thêm hồ sơ')}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

export default function PropertyManagementPage({ detailCode = '' }) {
  const [properties, setProperties] = useState(loadDemoProperties);
  const [storageError, setStorageError] = useState('');
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState([]);
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [verifyStatus, setVerifyStatus] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [sortKey, setSortKey] = useState('code');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const requestedProperty = detailCode ? properties.find((property) => property.code === detailCode) : undefined;
  const [dialogProperty, setDialogProperty] = useState(() => requestedProperty);
  const [dialogMode, setDialogMode] = useState(() => detailCode ? 'detail' : undefined);
  const currentUser = getCachedUser();
  const canManage = currentUser?.role === 'Admin';
  const pageSize = 10;

  const filtered = useMemo(() => properties.filter((property) => {
    const matchesType = types.length === 0 || types.includes(property.type);
    const text = `${property.code} ${property.owner_name} ${property.address}`.toLocaleLowerCase('vi');
    const area = Number(property.area) || 0;
    const matchesMinArea = minArea === '' || area >= Number(minArea);
    const matchesMaxArea = maxArea === '' || area <= Number(maxArea);
    const matchesVerify = verifyStatus === 'all' || verifyStatus === 'unregistered';
    return matchesType && matchesMinArea && matchesMaxArea && matchesVerify && text.includes(query.trim().toLocaleLowerCase('vi'));
  }), [properties, query, types, minArea, maxArea, verifyStatus]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const comparison = typeof left === 'number' || typeof right === 'number'
      ? (Number(left) || 0) - (Number(right) || 0)
      : String(left ?? '').localeCompare(String(right ?? ''), 'vi', { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [filtered, sortKey, sortDirection]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);
  const totalValue = properties.reduce((sum, property) => sum + (Number(property.price) || 0), 0);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    const saved = saveDemoProperties(properties);
    setStorageError(saved ? '' : 'Trình duyệt không cho phép lưu dữ liệu demo; thay đổi có thể mất khi tải lại trang.');
  }, [properties]);

  useEffect(() => {
    const sync = (event) => setProperties(Array.isArray(event.detail) ? event.detail : loadDemoProperties());
    window.addEventListener(DEMO_PROPERTIES_CHANGED, sync);
    return () => window.removeEventListener(DEMO_PROPERTIES_CHANGED, sync);
  }, []);

  function changeFilter(update) {
    update();
    setPage(1);
  }

  function addProperty(property) {
    setProperties((current) => [property, ...current]);
    setPage(1);
  }

  function updateProperty(code, updated) {
    setProperties((current) => current.map((property) => property.code === code ? updated : property));
    setDialogProperty(updated);
  }

  function deleteProperty(code) {
    const nextProperties = properties.filter((property) => property.code !== code);
    setProperties(nextProperties);
    saveDemoProperties(nextProperties);
    setDialogProperty(undefined);
    setDialogMode(undefined);
  }

  function closeDialog() {
    setDialogProperty(undefined);
    setDialogMode(undefined);
  }

  function restoreSampleData() {
    if (!window.confirm('Khôi phục 100 hồ sơ mẫu? Thao tác này sẽ thay dữ liệu demo đã lưu trong trình duyệt.')) return;
    setProperties(initialDemoProperties);
    setPage(1);
    setQuery('');
    setTypes([]);
    setMinArea('');
    setMaxArea('');
    setVerifyStatus('all');
  }

  function toggleType(typeKey) {
    changeFilter(() => setTypes((current) => current.includes(typeKey) ? current.filter((item) => item !== typeKey) : [...current, typeKey]));
  }

  function clearFilters() {
    setQuery('');
    setTypes([]);
    setMinArea('');
    setMaxArea('');
    setVerifyStatus('all');
    setPage(1);
  }

  function sortBy(key) {
    if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  }

  if (detailCode) {
    const property = requestedProperty;
    const center = property?.geometry ? L.geoJSON(property.geometry).getBounds().getCenter() : null;
    return <main className="min-h-screen bg-canvas text-slate-100"><div className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:px-8 lg:px-12"><MainNavigation rightSlot={<span className="rounded-full border border-amber-200/10 bg-amber-200/[0.04] px-3 py-1.5 text-xs text-amber-100/70">Dữ liệu demo</span>} /><a href="/properties" className="mt-7 inline-flex items-center gap-2 text-sm text-indigo-200 hover:text-white">← Quay lại danh sách hồ sơ</a>{property ? <><section className="mt-7 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Chi tiết hồ sơ · {typeLabels[property.type] || property.type}</p><h1 className="mt-2 text-3xl font-medium text-white">{property.code}</h1><p className="mt-2 text-sm text-slate-400">{property.address || 'Chưa cập nhật địa chỉ'}</p></div><span className="rounded-full border border-slate-300/10 px-3 py-1.5 text-xs text-slate-400">Chưa đăng ký blockchain</span></section><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[['Chủ hồ sơ', property.owner_name || 'Chưa cập nhật'], ['Loại hình', typeLabels[property.type] || property.type], ['Diện tích', `${areaNumber.format(property.area)} m²`], ['Giá tham khảo', formatPrice(property.price)], ['Tình trạng giấy tờ', property.document_status || 'Chưa cung cấp'], ['Tâm ranh giới ước tính', center ? `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}` : 'Chưa có tọa độ']].map(([label, value]) => <article key={label} className="rounded-xl border border-white/[0.08] bg-panel p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-200">{value}</p></article>)}</div><section className="mt-4 rounded-xl border border-white/[0.08] bg-panel p-5"><h2 className="text-sm font-medium text-white">Mô tả hồ sơ</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{property.description || 'Chưa có mô tả.'}</p></section><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/10 bg-amber-200/[0.035] p-4"><p className="max-w-2xl text-xs leading-5 text-slate-400">Thông tin này lấy từ dữ liệu mẫu trong trình duyệt. Trạng thái giấy tờ chỉ là nội dung demo; hệ thống chưa xác minh quyền sở hữu pháp lý hoặc blockchain.</p><div className="flex gap-2">{center && <a href={`/gis?property=${encodeURIComponent(property.code)}`} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-sm text-slate-200 hover:bg-white/[0.04]">Xem trên bản đồ</a>}{canManage && <><button type="button" onClick={() => { if (window.confirm(`Xóa hồ sơ ${property.code} khỏi dữ liệu demo?`)) { deleteProperty(property.code); window.location.href = '/properties'; } }} className="rounded-lg border border-rose-300/20 px-3 py-2.5 text-sm text-rose-200 hover:bg-rose-300/[0.06]">Xóa</button><button type="button" onClick={() => { setDialogProperty(property); setDialogMode('edit'); }} className="rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-indigo-200">Chỉnh sửa hồ sơ</button></>}</div></div></> : <section className="mt-8 rounded-2xl border border-white/[0.08] bg-panel p-8"><h1 className="text-xl font-medium text-white">Không tìm thấy hồ sơ</h1><p className="mt-2 text-sm text-slate-400">Mã hồ sơ này không có trong dữ liệu demo đang lưu trên trình duyệt.</p></section>}</div>{dialogMode === 'edit' && property && <PropertyModal key={`edit-${property.code}`} mode="edit" property={property} existingCodes={properties.map((item) => item.code)} canManage={canManage} onClose={closeDialog} onEdit={() => {}} onCreate={addProperty} onUpdate={updateProperty} onDelete={deleteProperty} />}</main>;
  }

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-6 sm:px-8 lg:px-12">
        <MainNavigation rightSlot={<span className="hidden rounded-full border border-amber-200/10 bg-amber-200/[0.04] px-3 py-1.5 text-xs text-amber-100/70 sm:inline-flex"><span className="mr-2 h-1.5 w-1.5 rounded-full bg-amber-300" />Demo · lưu trên trình duyệt</span>} />

        <section className="mt-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Danh mục tài sản</p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight text-white sm:text-4xl">Hồ sơ bất động sản</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Tra cứu, thêm, sửa và xóa hồ sơ mẫu. Thay đổi được lưu trên trình duyệt này và chưa đồng bộ với backend.</p>
          </div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={restoreSampleData} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-sm text-slate-300 transition hover:border-white/20 hover:text-white">Khôi phục dữ liệu mẫu</button>{canManage && <button type="button" onClick={() => { setDialogProperty(null); setDialogMode('create'); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-indigo-200"><Icon name="plus" />Thêm hồ sơ</button>}</div>
        </section>

        {storageError && <p role="status" className="mt-4 rounded-lg border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3 text-xs leading-5 text-amber-100/80">{storageError}</p>}

        <section aria-label="Tổng quan hồ sơ" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Tổng hồ sơ" value={money.format(properties.length)} hint="Đang hiển thị trong dữ liệu demo" icon="home" />
          <Metric label="Loại hình" value={money.format(new Set(properties.map((item) => item.type)).size)} hint="Nhà ở, căn hộ, đất, thương mại" icon="area" />
          <Metric label="Tổng diện tích" value={`${areaNumber.format(properties.reduce((sum, item) => sum + (Number(item.area) || 0), 0))} m²`} hint="Theo diện tích hồ sơ hiện có" icon="area" />
          <Metric label="Tổng giá tham khảo" value={`${(totalValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`} hint="Cộng từ dữ liệu demo hiện tại" icon="pin" />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
          <div className="border-b border-white/[0.07] p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-medium text-slate-100">Danh sách hồ sơ</h2><p className="mt-1 text-xs text-slate-500">{money.format(filtered.length)} kết quả · lưu local trên thiết bị này</p></div><div className="inline-flex rounded-lg border border-white/[0.1] bg-[#0b0e14] p-0.5" role="group" aria-label="Chế độ hiển thị">{[['table', 'Bảng'], ['cards', 'Thẻ']].map(([key, label]) => <button key={key} type="button" aria-pressed={viewMode === key} onClick={() => setViewMode(key)} className={`rounded-md px-3 py-1.5 text-xs ${viewMode === key ? 'bg-white/[0.12] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{label}</button>)}</div></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <label className="relative block"><span className="sr-only">Tìm kiếm hồ sơ</span><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => changeFilter(() => setQuery(event.target.value))} placeholder="Tìm mã, chủ hồ sơ, địa chỉ..." className="w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/40" /></label>
              <details className="relative rounded-lg border border-white/[0.09] bg-[#0b0e14] text-sm text-slate-300"><summary className="cursor-pointer list-none px-3 py-2.5">Loại hình{types.length ? ` · ${types.length} chọn` : ' · Tất cả'}</summary><div className="grid gap-2 border-t border-white/[0.07] p-3">{Object.entries(typeLabels).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={types.includes(key)} onChange={() => toggleType(key)} className="accent-indigo-300" />{label}</label>)}</div></details>
              <div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Diện tích từ mét vuông</span><input type="number" min="0" value={minArea} onChange={(event) => changeFilter(() => setMinArea(event.target.value))} placeholder="m² từ" className="w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/40" /></label><label className="min-w-0 flex-1"><span className="sr-only">Diện tích đến mét vuông</span><input type="number" min="0" value={maxArea} onChange={(event) => changeFilter(() => setMaxArea(event.target.value))} placeholder="m² đến" className="w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/40" /></label></div>
              <label><span className="sr-only">Lọc trạng thái xác minh</span><select value={verifyStatus} onChange={(event) => changeFilter(() => setVerifyStatus(event.target.value))} className="w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-300/40"><option value="all">Mọi trạng thái</option><option value="unregistered">Chưa đăng ký blockchain</option><option value="registered">Đã đăng ký</option><option value="modified">Cảnh báo chỉnh sửa</option></select></label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-xs text-slate-500">Sắp xếp<select value={`${sortKey}:${sortDirection}`} onChange={(event) => { const [key, direction] = event.target.value.split(':'); setSortKey(key); setSortDirection(direction); }} className="rounded-md border border-white/[0.09] bg-[#0b0e14] px-2 py-1.5 text-xs text-slate-300"><option value="code:asc">Mã A–Z</option><option value="area:desc">Diện tích lớn trước</option><option value="area:asc">Diện tích nhỏ trước</option><option value="price:desc">Giá cao trước</option><option value="price:asc">Giá thấp trước</option></select></label><button type="button" onClick={clearFilters} className="rounded-md px-2 py-1.5 text-xs text-indigo-200 hover:bg-indigo-300/[0.08]">Xóa bộ lọc</button></div>
          </div>

          {visible.length && viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead><tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-slate-500"><th className="px-5 py-3.5 font-medium"><button onClick={() => sortBy('code')}>Mã / Loại hình</button></th><th className="px-5 py-3.5 font-medium"><button onClick={() => sortBy('address')}>Địa chỉ</button></th><th className="px-5 py-3.5 font-medium"><button onClick={() => sortBy('owner_name')}>Chủ hồ sơ</button></th><th className="px-5 py-3.5 text-right font-medium"><button onClick={() => sortBy('area')}>Diện tích</button></th><th className="px-5 py-3.5 text-right font-medium"><button onClick={() => sortBy('price')}>Giá tham khảo</button></th><th className="px-5 py-3.5 font-medium">Xác minh</th><th className="px-5 py-3.5" /></tr></thead>
                <tbody>{visible.map((property) => <tr key={property.code} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]"><td className="px-5 py-4"><div className="text-sm font-medium text-slate-200">{property.code}</div><div className="mt-1 text-xs text-slate-500">{typeLabels[property.type] || property.type}</div></td><td className="max-w-xs px-5 py-4 text-sm text-slate-300"><span className="line-clamp-2">{property.address || 'Chưa cập nhật'}</span></td><td className="px-5 py-4 text-sm text-slate-400">{property.owner_name || 'Chưa cập nhật'}</td><td className="px-5 py-4 text-right text-sm tabular-nums text-slate-300">{areaNumber.format(property.area)} m²</td><td className="px-5 py-4 text-right text-sm tabular-nums text-slate-300">{formatPrice(property.price)}</td><td className="px-5 py-4"><span className="rounded-full border border-slate-300/10 px-2 py-1 text-[10px] text-slate-400">Chưa đăng ký</span></td><td className="px-5 py-4 text-right"><a href={`/properties/${encodeURIComponent(property.code)}`} aria-label={`Xem ${property.code}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-indigo-200 hover:bg-indigo-300/10">Chi tiết <Icon name="arrow" className="h-3.5 w-3.5" /></a></td></tr>)}</tbody>
              </table>
            </div>
          ) : visible.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((property) => <article key={property.code} className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b0e14]"><div className="grid h-32 place-items-center bg-gradient-to-br from-slate-800 to-slate-950 text-xs text-slate-500">Chưa có ảnh hồ sơ</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-white">{property.code}</h3><p className="mt-1 text-xs text-slate-500">{typeLabels[property.type] || property.type}</p></div><span className="rounded-full border border-slate-300/10 px-2 py-1 text-[10px] text-slate-400">Chưa đăng ký</span></div><p className="mt-3 line-clamp-2 text-xs text-slate-400">{property.address || 'Chưa cập nhật'}</p><div className="mt-3 flex items-center justify-between text-xs"><span className="text-slate-400">{areaNumber.format(property.area)} m²</span><span className="text-slate-300">{formatPrice(property.price)}</span></div><a href={`/properties/${encodeURIComponent(property.code)}`} className="mt-4 block w-full rounded-lg border border-white/[0.09] px-3 py-2 text-center text-xs text-indigo-200 hover:bg-indigo-300/[0.08]">Xem chi tiết</a></div></article>)}</div> : <div className="px-5 py-16 text-center"><p className="text-sm text-slate-300">Không có hồ sơ phù hợp</p><p className="mt-1 text-xs text-slate-500">Thử đổi bộ lọc hoặc chọn trạng thái chưa đăng ký.</p></div>}

          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>Trang {page} / {pageCount} · Mỗi trang {pageSize} hồ sơ</span>
            <div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-white/[0.09] px-3 py-1.5 text-slate-300 enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Trước</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-white/[0.09] px-3 py-1.5 text-slate-300 enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Sau</button></div>
          </div>
        </section>
      </div>

      {dialogMode && <PropertyModal key={`${dialogMode}-${dialogProperty?.code ?? 'new'}`} mode={dialogMode} property={dialogProperty} existingCodes={properties.map((item) => item.code)} canManage={canManage} onClose={closeDialog} onEdit={() => setDialogMode('edit')} onCreate={addProperty} onUpdate={updateProperty} onDelete={deleteProperty} />}
    </main>
  );
}

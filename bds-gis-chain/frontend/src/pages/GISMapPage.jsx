import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MainNavigation from '../components/MainNavigation.jsx';
import PageGuide from '../components/PageGuide.jsx';
import { getAuthToken } from '../lib/authSession.js';

const typeLabels = { house: 'Nhà ở', apartment: 'Căn hộ', land: 'Đất nền', commercial: 'Thương mại' };
const typeColors = { house: '#f43f5e', apartment: '#0ea5e9', land: '#22c55e', commercial: '#f59e0b' };
const areaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const distanceFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const vietnameseIslandLabels = [
  { name: 'Quần đảo Hoàng Sa', position: [16.5, 112.0] },
  { name: 'Quần đảo Trường Sa', position: [9.5, 114.0] },
];

function makePopup(properties) {
  const root = document.createElement('div');
  root.className = 'gis-popup';
  const title = document.createElement('strong');
  title.textContent = properties.code || 'Hồ sơ bất động sản';
  root.append(title);
  const fields = [
    ['Địa chỉ', properties.address || 'Chưa cập nhật'],
    ['Chủ hồ sơ', properties.owner_name || 'Chưa cập nhật'],
    ['Loại hình', typeLabels[properties.type] || properties.type || 'Chưa cập nhật'],
    ['Diện tích', properties.area ? `${areaFormat.format(properties.area)} m²` : 'Chưa cập nhật'],
  ];
  fields.forEach(([label, value]) => {
    const row = document.createElement('div');
    const caption = document.createElement('span');
    const text = document.createElement('span');
    caption.textContent = `${label}: `;
    text.textContent = value;
    row.append(caption, text);
    root.append(row);
  });
  const details = document.createElement('a');
  details.href = `/properties/${encodeURIComponent(properties.code || '')}`;
  details.textContent = 'Mở chi tiết hồ sơ';
  details.className = 'gis-popup-link';
  root.append(details);
  return root;
}

function featureCenter(feature) {
  const layer = L.geoJSON(feature);
  return layer.getBounds().getCenter();
}

async function gisApi(path, signal, options = {}) {
  const token = getAuthToken();
  if (!token) throw new Error('Vui lòng đăng nhập để xem bản đồ và dữ liệu hồ sơ.');
  const response = await fetch(path, {
    ...options,
    signal,
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

function FeatureBadge({ type }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-2 py-1 text-[11px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: typeColors[type] || '#94a3b8' }} />{typeLabels[type] || type}</span>;
}

export default function GISMapPage() {
  return <ArcGISMapPage />;
}

function ArcGISMapPage() {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const layerGroup = useRef(null);
  const analysisGroup = useRef(null);
  const basemapLayer = useRef(null);
  const [basemapMode, setBasemapMode] = useState('default');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState(() => new URLSearchParams(window.location.search).get('property') || '');
  const [radiusKm, setRadiusKm] = useState(2);
  const [analysisMode, setAnalysisMode] = useState(false);
  const [intersectsMode, setIntersectsMode] = useState(false);
  const [analysisCenter, setAnalysisCenter] = useState(null);
  const analysisModeRef = useRef(analysisMode);
  const intersectsModeRef = useRef(intersectsMode);
  const [intersectsPoints, setIntersectsPoints] = useState([]);
  const [intersectsPolygon, setIntersectsPolygon] = useState(null);
  const [intersectsMatches, setIntersectsMatches] = useState(null);
  const [intersectsLoading, setIntersectsLoading] = useState(false);
  const [intersectsError, setIntersectsError] = useState('');
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [radiusMatches, setRadiusMatches] = useState(null);
  const [radiusDistances, setRadiusDistances] = useState(new Map());
  const [radiusLoading, setRadiusLoading] = useState(false);
  const [radiusError, setRadiusError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setApiError('');
    (async () => {
      try {
        const all = [];
        let page = 1;
        let pages = 1;
        do {
          const params = new URLSearchParams({ page: String(page), limit: '100' });
          const body = await gisApi(`/api/properties?${params}`, controller.signal);
          all.push(...(Array.isArray(body.data) ? body.data : []));
          pages = Number(body.pagination?.pages) || 1;
          page += 1;
        } while (page <= pages && !controller.signal.aborted);
        if (!controller.signal.aborted) setProperties(all.map((property) => ({
          ...property,
          area: Number(property.area) || 0,
          price: Number(property.price) || 0,
          geometry: property.boundary || property.location || null,
        })));
      } catch (error) {
        if (!controller.signal.aborted) setApiError(error.message || 'Không tải được hồ sơ GIS.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [reloadKey]);

  const features = useMemo(() => properties
    .filter((property) => property.geometry)
    .map(({ geometry, ...property }) => ({ type: 'Feature', geometry, properties: property })), [properties]);

  const filtered = useMemo(() => features.filter((feature) => {
    const p = feature.properties;
    const matchesType = type === 'all' || p.type === type;
    const searchable = `${p.code} ${p.address} ${p.owner_name}`.toLocaleLowerCase('vi');
    const matchesSpatial = analysisCenter
      ? radiusMatches === null || radiusMatches.has(p.code)
      : intersectsPolygon ? intersectsMatches === null || intersectsMatches.has(p.code) : true;
    return matchesType && matchesSpatial && searchable.includes(query.trim().toLocaleLowerCase('vi'));
  }), [features, type, query, analysisCenter, radiusMatches, intersectsPolygon, intersectsMatches]);

  useEffect(() => {
    if (!analysisCenter) {
      setRadiusMatches(null);
      setRadiusDistances(new Map());
      setRadiusError('');
      setRadiusLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      lon: String(analysisCenter.lng),
      lat: String(analysisCenter.lat),
      radius_m: String(radiusKm * 1000),
    });
    setRadiusLoading(true);
    setRadiusError('');
    setRadiusMatches(new Set());
    setRadiusDistances(new Map());
    gisApi(`/api/gis/radius?${params}`, controller.signal)
      .then((body) => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(body.data) ? body.data : [];
        setRadiusMatches(new Set(rows.map((row) => row.code)));
        setRadiusDistances(new Map(rows.map((row) => [row.code, Number(row.distance_m)])));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setRadiusMatches(new Set());
        setRadiusDistances(new Map());
        setRadiusError(error.message || 'Không truy vấn được vùng lân cận.');
      })
      .finally(() => { if (!controller.signal.aborted) setRadiusLoading(false); });
    return () => controller.abort();
  }, [analysisCenter, radiusKm]);

  useEffect(() => {
    if (!intersectsPolygon) {
      setIntersectsMatches(null);
      setIntersectsError('');
      setIntersectsLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setIntersectsLoading(true);
    setIntersectsError('');
    setIntersectsMatches(new Set());
    gisApi('/api/gis/intersects', controller.signal, {
      method: 'POST',
      body: JSON.stringify({ geometry: intersectsPolygon }),
    })
      .then((body) => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(body.data) ? body.data : [];
        setIntersectsMatches(new Set(rows.map((row) => row.code)));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setIntersectsMatches(new Set());
        setIntersectsError(error.message || 'Không truy vấn được vùng giao cắt.');
      })
      .finally(() => { if (!controller.signal.aborted) setIntersectsLoading(false); });
    return () => controller.abort();
  }, [intersectsPolygon]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined;
    const map = L.map(mapNode.current, { zoomControl: false, preferCanvas: true });
    L.control.zoom({ position: 'topright' }).addTo(map);
    map.createPane('vietnameseIslandLabels');
    map.getPane('vietnameseIslandLabels').style.zIndex = '620';
    map.getPane('vietnameseIslandLabels').style.pointerEvents = 'none';
    vietnameseIslandLabels.forEach(({ name, position }) => {
      L.marker(position, {
        pane: 'vietnameseIslandLabels',
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'archipelago-label-marker',
          html: `<span>${name}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      }).addTo(map);
    });
    mapRef.current = map;
    layerGroup.current = L.featureGroup().addTo(map);
    analysisGroup.current = L.featureGroup().addTo(map);
    map.on('click', (event) => {
      if (analysisModeRef.current) setAnalysisCenter(event.latlng);
      if (intersectsModeRef.current) {
        setIntersectsPoints((points) => [...points, [event.latlng.lat, event.latlng.lng]]);
        setIntersectsPolygon(null);
      }
    });

    map.setView([21.0285, 105.8542], 6);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroup.current = null;
      analysisGroup.current = null;
    };
  }, []);

  useEffect(() => { analysisModeRef.current = analysisMode; }, [analysisMode]);
  useEffect(() => { intersectsModeRef.current = intersectsMode; }, [intersectsMode]);

  useEffect(() => {
    const group = analysisGroup.current;
    if (!group) return;
    group.clearLayers();
    if (analysisCenter) {
      L.circle(analysisCenter, { radius: radiusKm * 1000, color: '#a5b4fc', weight: 2, dashArray: '6 6', fillColor: '#818cf8', fillOpacity: 0.08 }).addTo(group);
      L.circleMarker(analysisCenter, { radius: 6, color: '#0b0e14', weight: 2, fillColor: '#c4b5fd', fillOpacity: 1 }).bindTooltip('Tâm vùng phân tích').addTo(group);
    }
    if (intersectsPoints.length >= 2) {
      const line = [...intersectsPoints, ...(intersectsPoints.length >= 3 ? [intersectsPoints[0]] : [])];
      L.polyline(line, { color: '#fb7185', weight: 2, dashArray: '6 5' }).addTo(group);
      intersectsPoints.forEach((point, index) => L.circleMarker(point, { radius: 4, color: '#0b0e14', weight: 1.5, fillColor: '#fda4af', fillOpacity: 1 }).bindTooltip(`Điểm ${index + 1}`).addTo(group));
      if (intersectsPoints.length >= 3) L.polygon(intersectsPoints, { color: '#fb7185', weight: 2, fillColor: '#fb7185', fillOpacity: 0.12 }).addTo(group);
    }
  }, [analysisCenter, radiusKm, intersectsPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    basemapLayer.current?.remove();
    const service = basemapMode === 'satellite' ? 'World_Imagery' : 'World_Topo_Map';
    const attribution = basemapMode === 'satellite'
      ? 'Tiles &copy; Esri'
      : 'Tiles &copy; Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, &copy; OpenStreetMap contributors';
    basemapLayer.current = L.tileLayer(
      `https://services.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
      { maxZoom: 19, attribution },
    ).addTo(map);
    return () => basemapLayer.current?.remove();
  }, [basemapMode]);

  useEffect(() => {
    const group = layerGroup.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();

    filtered.forEach((feature) => {
      const p = feature.properties;
      const active = p.code === selectedCode;
      const color = typeColors[p.type] || '#a5b4fc';
      const popup = makePopup(p);
      const casing = L.geoJSON(feature, {
        interactive: false,
        style: { color: active ? '#fff7cc' : '#ffffff', weight: active ? 9 : 7, opacity: 0.96, fillOpacity: 0 },
      });
      casing.addTo(group);
      const polygon = L.geoJSON(feature, {
        bubblingMouseEvents: false,
        style: {
          color: active ? '#facc15' : '#111827',
          weight: active ? 5 : 3,
          opacity: 1,
          fillColor: color,
          fillOpacity: active ? 0.68 : 0.5,
        },
        onEachFeature: (_item, layer) => {
          layer.bindPopup(popup);
          layer.on('click', () => setSelectedCode(p.code));
          layer.bindTooltip(p.code, {
            permanent: map.getZoom() >= 17,
            direction: 'center',
            className: 'property-code-tooltip',
          });
        },
      });
      polygon.addTo(group);
      const center = featureCenter(feature);
      L.circleMarker(center, {
        radius: active ? 9 : 7,
        color: '#ffffff',
        weight: 2.5,
        fillColor: color,
        fillOpacity: 1,
        bubblingMouseEvents: false,
      }).bindPopup(popup).addTo(group);
    });

    const syncParcelLabels = () => {
      const showLabels = map.getZoom() >= 17;
      group.eachLayer((collection) => {
        if (!collection.eachLayer) return;
        collection.eachLayer((shape) => {
          if (!shape.getTooltip?.()) return;
          if (showLabels) shape.openTooltip();
          else shape.closeTooltip();
        });
      });
    };
    map.on('zoomend', syncParcelLabels);
    syncParcelLabels();

    if (filtered.length) {
      const visibleBounds = group.getBounds();
      if (visibleBounds.isValid() && !selectedCode) map.fitBounds(visibleBounds.pad(0.12), { maxZoom: 17 });
    }

    return () => map.off('zoomend', syncParcelLabels);
  }, [filtered, selectedCode]);

  useEffect(() => {
    const feature = filtered.find((item) => item.properties.code === selectedCode);
    if (feature) {
      const center = featureCenter(feature);
      mapRef.current?.flyTo(center, Math.max(mapRef.current.getZoom(), 17), { duration: 0.55 });
    } else if (selectedCode && !loading) {
      setSelectedCode('');
    }
  }, [filtered, selectedCode, loading]);

  function selectFeature(feature) {
    const center = featureCenter(feature);
    setSelectedCode(feature.properties.code);
    const map = mapRef.current;
    if (map) map.flyTo(center, Math.max(map.getZoom(), 17), { duration: 0.55 });
  }

  function showArchipelagoRegion() {
    setAnalysisMode(false);
    setAnalysisCenter(null);
    setIntersectsMode(false);
    setIntersectsPoints([]);
    setIntersectsPolygon(null);
    setSelectedCode('');
    mapRef.current?.flyTo([13.2, 112.8], 5, { duration: 0.7 });
  }

  function showPropertyRegion() {
    setAnalysisMode(false);
    setAnalysisCenter(null);
    setIntersectsMode(false);
    setIntersectsPoints([]);
    setIntersectsPolygon(null);
    setSelectedCode('');
    const bounds = L.geoJSON({ type: 'FeatureCollection', features }).getBounds();
    if (bounds.isValid()) mapRef.current?.fitBounds(bounds.pad(0.12), { maxZoom: 17, animate: true });
  }

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <div className="mx-auto max-w-[1500px] px-4 pb-8 pt-5 sm:px-7 lg:px-10">
        <MainNavigation rightSlot={<span className="hidden rounded-full border border-emerald-200/40 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 sm:inline-flex">{features.length} thửa có vị trí</span>} />

        <section className="mb-5 mt-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Không gian địa lý</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Bản đồ bất động sản</h1><p className="mt-2 text-sm text-slate-400">Khám phá vị trí và ranh giới từng thửa; chọn một thửa để xem hồ sơ hoặc tìm quanh một khu vực.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={showArchipelagoRegion} className="rounded-lg border border-amber-200/20 bg-amber-200/[0.04] px-3 py-2.5 text-sm text-amber-100 transition hover:bg-amber-200/[0.1]">Hoàng Sa · Trường Sa</button>
            <button type="button" onClick={showPropertyRegion} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-sm text-slate-300 transition hover:border-indigo-300/30 hover:text-white">Vùng hồ sơ</button>
            <a href="/properties" className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] px-3 py-2.5 text-sm text-slate-300 transition hover:border-indigo-300/30 hover:text-white">Danh sách hồ sơ <span aria-hidden="true">↗</span></a>
          </div>
        </section>

        <PageGuide steps={['Tìm theo mã, địa chỉ hoặc chủ hồ sơ rồi chọn kết quả để xem vị trí.', 'Chọn “Tìm theo bán kính” và bấm bản đồ, hoặc vẽ vùng khép kín để lọc các thửa bên trong.', 'Đổi giữa bản đồ đường phố và ảnh vệ tinh; chọn “Vùng hồ sơ” để quay lại nơi có dữ liệu.']} note="Bản đồ hiển thị dữ liệu hồ sơ đã lưu. Nếu chưa thấy thửa, hãy thử tải lại hoặc kiểm tra bộ lọc." />

        {apiError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/15 bg-rose-200/[0.04] px-4 py-3 text-sm text-rose-100/85"><span>{apiError}</span><div className="flex gap-2"><a href="/login" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.05]">Đăng nhập</a><button type="button" onClick={() => setReloadKey((key) => key + 1)} className="rounded-lg bg-rose-200/10 px-3 py-2 text-xs text-rose-100 hover:bg-rose-200/15">Thử lại</button></div></div>}

        <section className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="order-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70 lg:order-1">
            <div className="border-b border-white/[0.07] p-4">
              <div className="flex items-center justify-between"><div><h2 className="text-sm font-medium">Thửa đất</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} kết quả trên bản đồ</p></div><span className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-slate-500">EPSG:4326</span></div>
              <div className="mt-3 rounded-lg border border-indigo-300/10 bg-indigo-300/[0.035] p-3">
                <p className="text-xs font-medium text-slate-200">Truy vấn không gian</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={analysisMode} onClick={() => { const next = !analysisMode; setAnalysisMode(next); setIntersectsMode(false); setAnalysisCenter(null); setIntersectsPoints([]); setIntersectsPolygon(null); setIntersectsMatches(null); }} className={`rounded-md px-2 py-2 text-[11px] ${analysisMode ? 'bg-indigo-300 text-slate-950' : 'border border-white/10 text-slate-300 hover:text-white'}`}>{analysisMode ? 'Chọn tâm trên bản đồ…' : 'Tìm theo bán kính'}</button>
                  <button type="button" aria-pressed={intersectsMode} onClick={() => { const next = !intersectsMode; setIntersectsMode(next); setAnalysisMode(false); setAnalysisCenter(null); setIntersectsPoints([]); setIntersectsPolygon(null); setIntersectsMatches(null); setIntersectsError(''); }} className={`rounded-md px-2 py-2 text-[11px] ${intersectsMode ? 'bg-cyan-200 text-slate-950' : 'border border-white/10 text-slate-300 hover:text-white'}`}>{intersectsMode ? 'Đang vẽ vùng…' : 'Vẽ vùng tìm thửa'}</button>
                </div>
                {analysisMode && <label className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">Bán kính<select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} className="rounded-md border border-white/[0.09] bg-[#0b0e14] px-2 py-1.5 text-xs text-slate-200"><option value={0.5}>500 m</option><option value={1}>1 km</option><option value={2}>2 km</option><option value={5}>5 km</option><option value={10}>10 km</option></select></label>}
                {analysisMode && (analysisCenter ? <p className="mt-2 text-[10px] leading-4 text-slate-500">{radiusLoading ? 'Đang truy vấn PostGIS…' : radiusError || `${radiusMatches?.size || 0} hồ sơ trong bán kính ${distanceFormat.format(radiusKm)} km từ PostGIS; ${filtered.length} hồ sơ khớp bộ lọc.`}</p> : <p className="mt-2 text-[10px] leading-4 text-slate-500">Bấm lên bản đồ để chọn tâm tìm kiếm.</p>)}
                {intersectsMode && <><p className="mt-2 text-[10px] leading-4 text-slate-500">Bấm ít nhất 3 điểm để vẽ polygon, sau đó tìm các thửa giao với vùng đó ({intersectsPoints.length} điểm).</p><div className="mt-2 flex gap-2"><button type="button" disabled={!intersectsPoints.length || intersectsPolygon} onClick={() => setIntersectsPoints((points) => points.slice(0, -1))} className="rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-slate-300 disabled:opacity-40">Lùi 1 điểm</button><button type="button" disabled={intersectsPoints.length === 0} onClick={() => { setIntersectsPoints([]); setIntersectsPolygon(null); setIntersectsMatches(null); setIntersectsError(''); }} className="rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-slate-300 disabled:opacity-40">Xóa vùng</button><button type="button" disabled={intersectsPoints.length < 3 || intersectsLoading} onClick={() => { const ring = intersectsPoints.map(([lat, lng]) => [lng, lat]); ring.push(ring[0]); setIntersectsPolygon({ type: 'Polygon', coordinates: [ring] }); setSelectedCode(''); }} className="ml-auto rounded-md bg-cyan-200 px-2 py-1.5 text-[10px] font-medium text-slate-950 disabled:opacity-40">{intersectsLoading ? 'Đang tìm…' : 'Tìm thửa giao vùng'}</button></div>{intersectsPolygon && <p className="mt-2 text-[10px] leading-4 text-slate-500">{intersectsLoading ? 'Đang truy vấn PostGIS…' : intersectsError || `${intersectsMatches?.size || 0} thửa giao với vùng; ${filtered.length} thửa khớp bộ lọc.`}</p>}</>}
              </div>
              <input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedCode(''); }} placeholder="Tìm mã, địa chỉ, chủ hồ sơ..." className="mt-4 w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/40" aria-label="Tìm thửa đất" />
              <select value={type} onChange={(event) => { setType(event.target.value); setSelectedCode(''); }} className="mt-2 w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-300/40" aria-label="Lọc loại bất động sản"><option value="all">Tất cả loại hình</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            </div>
            <div className="max-h-[360px] divide-y divide-white/[0.05] overflow-y-auto lg:max-h-[calc(100vh-350px)]">
              {loading ? <div className="px-4 py-12 text-center text-sm text-slate-500">Đang tải ranh giới từ PostGIS…</div> : filtered.map((feature) => {
                const p = feature.properties;
                const selected = p.code === selectedCode;
                const distance = analysisCenter ? radiusDistances.get(p.code) : null;
                return <button type="button" key={p.code} onClick={() => selectFeature(feature)} className={`block w-full px-4 py-3.5 text-left transition ${selected ? 'bg-indigo-300/[0.09]' : 'hover:bg-white/[0.025]'}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-200">{p.code}</span><FeatureBadge type={p.type} /></div><p className="mt-1.5 truncate text-xs text-slate-400">{p.address}</p><p className="mt-1 text-[11px] text-slate-600">{areaFormat.format(p.area)} m² · {p.owner_name}{distance !== null && distance !== undefined && <span className="text-indigo-200"> · {distanceFormat.format(distance / 1000)} km</span>}</p></button>;
              })}
              {!loading && !filtered.length && <div className="px-4 py-12 text-center text-sm text-slate-500">{analysisCenter && radiusLoading || intersectsPolygon && intersectsLoading ? 'Đang truy vấn khu vực…' : analysisCenter && radiusError || intersectsPolygon && intersectsError ? 'Không tải được kết quả truy vấn.' : 'Không tìm thấy thửa phù hợp.'}</div>}
            </div>
            <div className="border-t border-white/[0.07] px-4 py-3 text-[11px] leading-5 text-slate-500">Phóng to để đọc mã thửa. Nhãn Hoàng Sa và Trường Sa được hiển thị bằng tiếng Việt.</div>
          </aside>

          <div className="order-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e14] lg:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3"><div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-indigo-300" />Ranh giới thửa <span className="mx-1 text-slate-700">·</span><span className="h-2 w-2 rounded-full border border-slate-950 bg-cyan-200" />Tâm ước tính <span className="mx-1 text-slate-700">·</span><span className="rounded-full border border-amber-200/30 px-2 py-0.5 text-[10px] text-amber-100">Mã thửa hiện khi phóng to</span></div><div className="flex flex-wrap items-center gap-3"><div role="group" aria-label="Chế độ bản đồ" className="inline-flex rounded-lg border border-white/[0.1] bg-[#0b0e14] p-0.5"><button type="button" aria-pressed={basemapMode === 'default'} onClick={() => setBasemapMode('default')} className={`rounded-md px-3 py-1.5 text-xs transition ${basemapMode === 'default' ? 'bg-white/[0.12] text-white' : 'text-slate-500 hover:text-slate-300'}`}>Mặc định</button><button type="button" aria-pressed={basemapMode === 'satellite'} onClick={() => setBasemapMode('satellite')} className={`rounded-md px-3 py-1.5 text-xs transition ${basemapMode === 'satellite' ? 'bg-white/[0.12] text-white' : 'text-slate-500 hover:text-slate-300'}`}>Vệ tinh</button></div><span className="text-[11px] text-slate-600">Bấm polygon hoặc điểm để xem popup</span></div></div>
            <div ref={mapNode} className={`h-[55vh] min-h-[420px] w-full bg-[#171b24] sm:h-[62vh] lg:h-[calc(100vh-250px)] lg:min-h-[560px] ${analysisMode || intersectsMode ? 'cursor-crosshair' : ''}`} aria-label="Bản đồ GIS các bất động sản" />
          </div>
        </section>
      </div>
    </main>
  );
}

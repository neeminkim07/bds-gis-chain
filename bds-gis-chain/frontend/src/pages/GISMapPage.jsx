import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import sampleGeoJson from '../../../data/properties.sample.geojson?raw';

const geoJson = JSON.parse(sampleGeoJson);
const features = geoJson.features;
const typeLabels = { house: 'Nhà ở', apartment: 'Căn hộ', land: 'Đất nền', commercial: 'Thương mại' };
const typeColors = { house: '#f43f5e', apartment: '#0ea5e9', land: '#22c55e', commercial: '#f59e0b' };
const areaFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
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
    ['Chủ sở hữu', properties.owner_name || 'Chưa cập nhật'],
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
  return root;
}

function featureCenter(feature) {
  const layer = L.geoJSON(feature);
  return layer.getBounds().getCenter();
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
  const basemapLayer = useRef(null);
  const [basemapMode, setBasemapMode] = useState('default');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState('');

  const filtered = useMemo(() => features.filter((feature) => {
    const p = feature.properties;
    const matchesType = type === 'all' || p.type === type;
    const searchable = `${p.code} ${p.address} ${p.owner_name}`.toLocaleLowerCase('vi');
    return matchesType && searchable.includes(query.trim().toLocaleLowerCase('vi'));
  }), [type, query]);

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

    const bounds = L.geoJSON(geoJson).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 17 });

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroup.current = null;
    };
  }, []);

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
        style: {
          color: active ? '#facc15' : '#111827',
          weight: active ? 5 : 3,
          opacity: 1,
          fillColor: color,
          fillOpacity: active ? 0.68 : 0.5,
        },
        onEachFeature: (_item, layer) => {
          layer.bindPopup(popup);
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

  function selectFeature(feature) {
    const center = featureCenter(feature);
    setSelectedCode(feature.properties.code);
    const map = mapRef.current;
    if (map) map.flyTo(center, Math.max(map.getZoom(), 17), { duration: 0.55 });
  }

  function showArchipelagoRegion() {
    setSelectedCode('');
    mapRef.current?.flyTo([13.2, 112.8], 5, { duration: 0.7 });
  }

  function showPropertyRegion() {
    setSelectedCode('');
    const bounds = L.geoJSON(geoJson).getBounds();
    if (bounds.isValid()) mapRef.current?.fitBounds(bounds.pad(0.12), { maxZoom: 17, animate: true });
  }

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <div className="mx-auto max-w-[1500px] px-4 pb-8 pt-5 sm:px-7 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <a href="/" className="flex items-center gap-3 text-sm font-medium text-slate-300 transition hover:text-white"><span className="grid h-9 w-9 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-xs font-semibold text-indigo-200">GC</span><span>GIS-CHAIN <span className="ml-1 text-slate-600">/</span> <span className="text-slate-400">Bản đồ GIS</span></span></a>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/10 bg-amber-200/[0.04] px-3 py-1.5 text-xs text-amber-100/70"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />{basemapMode === 'satellite' ? 'Ảnh vệ tinh Esri' : 'Bản đồ địa hình Esri'} · {features.length} thửa mẫu</span>
        </header>

        <section className="mb-5 mt-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Không gian địa lý</p><h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Bản đồ bất động sản</h1><p className="mt-2 text-sm text-slate-400">Chọn một thửa để xem thông tin. Điểm đánh dấu là tâm ước tính từ ranh giới mẫu.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={showArchipelagoRegion} className="rounded-lg border border-amber-200/20 bg-amber-200/[0.04] px-3 py-2.5 text-sm text-amber-100 transition hover:bg-amber-200/[0.1]">Hoàng Sa · Trường Sa</button>
            <button type="button" onClick={showPropertyRegion} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-sm text-slate-300 transition hover:border-indigo-300/30 hover:text-white">Vùng hồ sơ</button>
            <a href="/properties" className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] px-3 py-2.5 text-sm text-slate-300 transition hover:border-indigo-300/30 hover:text-white">Danh sách hồ sơ <span aria-hidden="true">↗</span></a>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="order-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70 lg:order-1">
            <div className="border-b border-white/[0.07] p-4">
              <div className="flex items-center justify-between"><div><h2 className="text-sm font-medium">Thửa đất</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} kết quả trên bản đồ</p></div><span className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-slate-500">EPSG:4326</span></div>
              <input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedCode(''); }} placeholder="Tìm mã, địa chỉ, chủ sở hữu..." className="mt-4 w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/40" aria-label="Tìm thửa đất" />
              <select value={type} onChange={(event) => { setType(event.target.value); setSelectedCode(''); }} className="mt-2 w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-300/40" aria-label="Lọc loại bất động sản"><option value="all">Tất cả loại hình</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            </div>
            <div className="max-h-[360px] divide-y divide-white/[0.05] overflow-y-auto lg:max-h-[calc(100vh-350px)]">
              {filtered.map((feature) => {
                const p = feature.properties;
                const selected = p.code === selectedCode;
                return <button type="button" key={p.code} onClick={() => selectFeature(feature)} className={`block w-full px-4 py-3.5 text-left transition ${selected ? 'bg-indigo-300/[0.09]' : 'hover:bg-white/[0.025]'}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-200">{p.code}</span><FeatureBadge type={p.type} /></div><p className="mt-1.5 truncate text-xs text-slate-400">{p.address}</p><p className="mt-1 text-[11px] text-slate-600">{areaFormat.format(p.area)} m² · {p.owner_name}</p></button>;
              })}
              {!filtered.length && <div className="px-4 py-12 text-center text-sm text-slate-500">Không tìm thấy thửa phù hợp.</div>}
            </div>
            <div className="border-t border-white/[0.07] px-4 py-3 text-[11px] leading-5 text-slate-500">Ranh giới và mã thửa lấy từ GeoJSON mẫu. Mã hiện trực tiếp khi phóng to; quần đảo được gắn nhãn tiếng Việt trong ứng dụng.</div>
          </aside>

          <div className="order-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0e14] lg:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3"><div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-indigo-300" />Ranh giới thửa <span className="mx-1 text-slate-700">·</span><span className="h-2 w-2 rounded-full border border-slate-950 bg-cyan-200" />Tâm ước tính <span className="mx-1 text-slate-700">·</span><span className="rounded-full border border-amber-200/30 px-2 py-0.5 text-[10px] text-amber-100">Mã thửa hiện khi phóng to</span></div><div className="flex flex-wrap items-center gap-3"><div role="group" aria-label="Chế độ bản đồ" className="inline-flex rounded-lg border border-white/[0.1] bg-[#0b0e14] p-0.5"><button type="button" aria-pressed={basemapMode === 'default'} onClick={() => setBasemapMode('default')} className={`rounded-md px-3 py-1.5 text-xs transition ${basemapMode === 'default' ? 'bg-white/[0.12] text-white' : 'text-slate-500 hover:text-slate-300'}`}>Mặc định</button><button type="button" aria-pressed={basemapMode === 'satellite'} onClick={() => setBasemapMode('satellite')} className={`rounded-md px-3 py-1.5 text-xs transition ${basemapMode === 'satellite' ? 'bg-white/[0.12] text-white' : 'text-slate-500 hover:text-slate-300'}`}>Vệ tinh</button></div><span className="text-[11px] text-slate-600">Bấm polygon hoặc điểm để xem popup</span></div></div>
            <div ref={mapNode} className="h-[55vh] min-h-[420px] w-full bg-[#171b24] sm:h-[62vh] lg:h-[calc(100vh-250px)] lg:min-h-[560px]" aria-label="Bản đồ GIS các bất động sản mẫu" />
          </div>
        </section>
      </div>
    </main>
  );
}

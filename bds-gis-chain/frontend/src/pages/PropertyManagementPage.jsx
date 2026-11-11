import React, { useEffect, useMemo, useState } from 'react';
import sampleGeoJson from '../../../data/properties.sample.geojson?raw';

const typeLabels = {
  house: 'Nhà ở',
  apartment: 'Căn hộ',
  land: 'Đất nền',
  commercial: 'Thương mại',
};

const initialProperties = JSON.parse(sampleGeoJson).features.map((feature) => ({
  ...feature.properties,
  geometry: feature.geometry,
}));

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

function PropertyModal({ mode, property, existingCodes, onClose, onEdit, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(() => mode === 'edit'
    ? { ...property, area: String(property.area ?? ''), price: String(property.price ?? '') }
    : { code: '', owner_name: '', address: '', area: '', price: '', type: 'house' });
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
    const nextProperty = { ...property, ...form, code, area: Number(form.area), price: Number(form.price) || 0 };
    if (mode === 'edit') onUpdate(property.code, nextProperty);
    else onCreate(nextProperty);
    setSaved(true);
    window.setTimeout(onClose, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="property-dialog-title" className="w-full max-w-xl rounded-2xl border border-line bg-[#11141c] p-5 shadow-2xl sm:p-7">
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
              ['Chủ sở hữu', property.owner_name || 'Chưa cập nhật'],
              ['Loại hình', typeLabels[property.type] || property.type],
              ['Địa chỉ', property.address || 'Chưa cập nhật'],
              ['Diện tích', `${areaNumber.format(property.area)} m²`],
              ['Giá tham khảo', formatPrice(property.price)],
              ['Geometry', property.geometry?.type || 'Chưa có'],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-sm text-slate-200">{value}</dd></div>)}
          </dl>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {confirmDelete ? <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-3"><p className="text-sm text-rose-100/80">Xóa {property.code} khỏi dữ liệu demo?</p><div className="flex gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Hủy</button><button type="button" onClick={() => onDelete(property.code)} className="rounded-lg bg-rose-400 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-rose-300">Xác nhận xóa</button></div></div> : <><p className="text-xs text-slate-500">Chỉnh sửa chỉ áp dụng cho phiên demo hiện tại.</p><div className="flex gap-2"><button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-rose-300/20 px-3 py-2 text-sm text-rose-200 hover:bg-rose-300/[0.08]">Xóa</button><button type="button" onClick={onEdit} className="rounded-lg bg-indigo-300 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-indigo-200">Sửa hồ sơ</button></div></>}
          </div>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            {mode === 'edit' ? <div className="text-xs text-slate-400">Mã hồ sơ<input value={property.code} readOnly className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-500 outline-none" /></div> : <label className="text-xs text-slate-400">Mã hồ sơ <span className="text-slate-600">(để trống sẽ tự tạo)</span><input name="code" value={form.code} onChange={update} placeholder="VD: DEMO-001" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>}
            <label className="text-xs text-slate-400">Chủ sở hữu<input name="owner_name" value={form.owner_name} onChange={update} required placeholder="Tên chủ sở hữu" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            <label className="text-xs text-slate-400 sm:col-span-2">Địa chỉ<input name="address" value={form.address} onChange={update} required placeholder="Địa chỉ bất động sản" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            <label className="text-xs text-slate-400">Loại hình<select name="type" value={form.type} onChange={update} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-300/50">{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-xs text-slate-400">Diện tích (m²)<input name="area" value={form.area} onChange={update} type="number" min="0.1" step="0.1" required placeholder="120" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            <label className="text-xs text-slate-400 sm:col-span-2">Giá tham khảo (VND)<input name="price" value={form.price} onChange={update} type="number" min="0" step="1000000" placeholder="Để trống nếu chưa có" className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/50" /></label>
            {formError && <p role="alert" className="text-xs text-rose-300 sm:col-span-2">{formError}</p>}
            <div className="flex items-center justify-between gap-4 pt-2 sm:col-span-2"><p className="text-xs leading-5 text-slate-500">Thay đổi chỉ nằm trong bộ nhớ trang demo, chưa gửi lên backend.</p><button type="submit" className="shrink-0 rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-indigo-200">{saved ? (mode === 'edit' ? 'Đã cập nhật' : 'Đã thêm') : (mode === 'edit' ? 'Lưu thay đổi' : 'Thêm hồ sơ')}</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

export default function PropertyManagementPage() {
  const [properties, setProperties] = useState(initialProperties);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogProperty, setDialogProperty] = useState(undefined);
  const [dialogMode, setDialogMode] = useState(undefined);
  const pageSize = 8;

  const filtered = useMemo(() => properties.filter((property) => {
    const matchesType = type === 'all' || property.type === type;
    const text = `${property.code} ${property.owner_name} ${property.address}`.toLocaleLowerCase('vi');
    return matchesType && text.includes(query.trim().toLocaleLowerCase('vi'));
  }), [properties, query, type]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalValue = properties.reduce((sum, property) => sum + (Number(property.price) || 0), 0);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

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
    setProperties((current) => current.filter((property) => property.code !== code));
    setDialogProperty(undefined);
    setDialogMode(undefined);
  }

  function closeDialog() {
    setDialogProperty(undefined);
    setDialogMode(undefined);
  }

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-6 sm:px-8 lg:px-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
          <a href="/" className="flex items-center gap-3 text-sm font-medium text-slate-300 transition hover:text-white"><span className="grid h-9 w-9 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-xs font-semibold text-indigo-200">GC</span><span>GIS-CHAIN <span className="ml-1 text-slate-600">/</span> <span className="text-slate-400">Hồ sơ BĐS</span></span></a>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/10 bg-amber-200/[0.04] px-3 py-1.5 text-xs text-amber-100/70"><span className="h-1.5 w-1.5 rounded-full bg-amber-300" />Dữ liệu demo · GeoJSON ban đầu</span>
        </header>

        <section className="mt-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-200/75">Danh mục tài sản</p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight text-white sm:text-4xl">Hồ sơ bất động sản</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Tra cứu và quản lý thông tin các bất động sản. Thay đổi trên trang này hiện chỉ nằm trong phiên demo.</p>
          </div>
          <button type="button" onClick={() => { setDialogProperty(null); setDialogMode('create'); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-indigo-200"><Icon name="plus" />Thêm hồ sơ</button>
        </section>

        <section aria-label="Tổng quan hồ sơ" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Tổng hồ sơ" value={money.format(properties.length)} hint="Đang hiển thị trong dữ liệu demo" icon="home" />
          <Metric label="Loại hình" value={money.format(new Set(properties.map((item) => item.type)).size)} hint="Nhà ở, căn hộ, đất, thương mại" icon="area" />
          <Metric label="Tổng diện tích" value={`${areaNumber.format(properties.reduce((sum, item) => sum + (Number(item.area) || 0), 0))} m²`} hint="Theo diện tích hồ sơ hiện có" icon="area" />
          <Metric label="Tổng giá tham khảo" value={`${(totalValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`} hint="Cộng từ dữ liệu demo hiện tại" icon="pin" />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/70">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div><h2 className="text-sm font-medium text-slate-100">Danh sách hồ sơ</h2><p className="mt-1 text-xs text-slate-500">{money.format(filtered.length)} kết quả</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block"><span className="sr-only">Tìm kiếm hồ sơ</span><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => changeFilter(() => setQuery(event.target.value))} placeholder="Tìm mã, chủ sở hữu, địa chỉ..." className="w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/40 sm:w-72" /></label>
              <label><span className="sr-only">Lọc loại hình</span><select value={type} onChange={(event) => changeFilter(() => setType(event.target.value))} className="w-full rounded-lg border border-white/[0.09] bg-[#0b0e14] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-300/40 sm:w-40"><option value="all">Tất cả loại hình</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            </div>
          </div>

          {visible.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead><tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-slate-500"><th className="px-5 py-3.5 font-medium">Mã / Loại hình</th><th className="px-5 py-3.5 font-medium">Địa chỉ</th><th className="px-5 py-3.5 font-medium">Chủ sở hữu</th><th className="px-5 py-3.5 text-right font-medium">Diện tích</th><th className="px-5 py-3.5 text-right font-medium">Giá tham khảo</th><th className="px-5 py-3.5" /></tr></thead>
                <tbody>{visible.map((property) => <tr key={property.code} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]"><td className="px-5 py-4"><div className="text-sm font-medium text-slate-200">{property.code}</div><div className="mt-1 text-xs text-slate-500">{typeLabels[property.type] || property.type}</div></td><td className="max-w-xs px-5 py-4 text-sm text-slate-300"><span className="line-clamp-2">{property.address || 'Chưa cập nhật'}</span></td><td className="px-5 py-4 text-sm text-slate-400">{property.owner_name || 'Chưa cập nhật'}</td><td className="px-5 py-4 text-right text-sm tabular-nums text-slate-300">{areaNumber.format(property.area)} m²</td><td className="px-5 py-4 text-right text-sm tabular-nums text-slate-300">{formatPrice(property.price)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => { setDialogProperty(property); setDialogMode('detail'); }} aria-label={`Xem ${property.code}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-indigo-200 hover:bg-indigo-300/10">Chi tiết <Icon name="arrow" className="h-3.5 w-3.5" /></button></td></tr>)}</tbody>
              </table>
            </div>
          ) : <div className="px-5 py-16 text-center"><p className="text-sm text-slate-300">Không tìm thấy hồ sơ phù hợp</p><p className="mt-1 text-xs text-slate-500">Thử đổi từ khóa hoặc bộ lọc loại hình.</p></div>}

          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>Trang {page} / {pageCount} · Mỗi trang {pageSize} hồ sơ</span>
            <div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-white/[0.09] px-3 py-1.5 text-slate-300 enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Trước</button><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-white/[0.09] px-3 py-1.5 text-slate-300 enabled:hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Sau</button></div>
          </div>
        </section>
      </div>

      {dialogMode && <PropertyModal key={`${dialogMode}-${dialogProperty?.code ?? 'new'}`} mode={dialogMode} property={dialogProperty} existingCodes={properties.map((item) => item.code)} onClose={closeDialog} onEdit={() => setDialogMode('edit')} onCreate={addProperty} onUpdate={updateProperty} onDelete={deleteProperty} />}
    </main>
  );
}

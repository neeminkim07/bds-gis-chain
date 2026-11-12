import React from 'react';
import AccountMenu from './AccountMenu.jsx';
import { getCachedUser } from '../lib/authSession.js';

const links = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/properties', label: 'Bất động sản' },
  { href: '/gis', label: 'Bản đồ GIS' },
  { href: '/verify', label: 'Xác minh' },
  { href: '/api-docs', label: 'API Docs' },
];

export default function MainNavigation({ rightSlot = null }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const navigationLinks = getCachedUser()?.role === 'Admin'
    ? [...links, { href: '/users', label: 'Người dùng' }]
    : links;
  const renderLinks = (compact = false) => navigationLinks.map(({ href, label }) => {
    const active = path === href;
    return <a key={href} href={href} aria-current={active ? 'page' : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-xs transition ${active ? 'bg-indigo-300/[0.1] text-indigo-100' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'} ${compact ? '' : ''}`}>{label}</a>;
  });

  return <header className="border-b border-white/[0.08]">
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">
      <a href="/" className="flex shrink-0 items-center gap-3 text-sm font-medium text-slate-300 transition hover:text-white" aria-label="GIS-CHAIN, trang chủ">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-xs font-semibold text-indigo-200">GC</span>
        <span>GIS-CHAIN</span>
      </a>
      <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">{renderLinks()}</nav>
      <div className="ml-auto flex items-center gap-3">{rightSlot}<AccountMenu /></div>
    </div>
    <nav aria-label="Điều hướng chính" className="flex gap-1 overflow-x-auto pb-3 lg:hidden">{renderLinks(true)}</nav>
  </header>;
}

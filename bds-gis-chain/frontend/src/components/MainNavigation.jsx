import React from 'react';
import AccountMenu from './AccountMenu.jsx';
import { getCachedUser } from '../lib/authSession.js';

const links = [
  { href: '/dashboard', label: 'Tổng quan', icon: '◫', group: 'KHÔNG GIAN LÀM VIỆC' },
  { href: '/properties', label: 'Hồ sơ bất động sản', icon: '▤' },
  { href: '/gis', label: 'Bản đồ', icon: '⌖' },
  { href: '/verify', label: 'Kiểm tra hồ sơ', icon: '◇' },
  { href: '/users', label: 'Quản lý người dùng', icon: '♙', admin: true, group: 'QUẢN TRỊ' },
  { href: '/api-docs', label: 'Tài liệu API', icon: '⌘', group: 'TRỢ GIÚP' },
];

export default function MainNavigation({ rightSlot = null, mode = 'app' }) {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const user = getCachedUser();
  if (mode === 'landing') return <header className="landing-nav"><a href="/" className="brand-lockup"><span className="brand-mark">G</span><span>ĐỊA ỐC<span className="brand-dot">.</span>KHÔNG GIAN<small>THÔNG TIN BẤT ĐỘNG SẢN</small></span></a><nav>{[{href:'/gis',label:'Bản đồ'}, {href:'/properties',label:'Hồ sơ'}, {href:'/api-docs',label:'Tài liệu'}].map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav><div className="landing-account">{rightSlot}<AccountMenu /></div></header>;
  const visible = links.filter((item) => !item.admin || user?.role === 'Admin');
  return <>
    <aside className="app-sidebar" aria-label="Điều hướng chính">
      <a href="/" className="brand-lockup"><span className="brand-mark">G</span><span>ĐỊA ỐC<span className="brand-dot">.</span>KHÔNG GIAN<small>HỆ THỐNG HỒ SƠ SỐ</small></span></a>
      <div className="sidebar-workspace"><span className="workspace-dot"/><span>Không gian làm việc</span><span className="workspace-caret">⌄</span></div>
      <nav className="sidebar-links">{visible.map((item, i) => <React.Fragment key={item.href}>{item.group && <p className="nav-section-label">{item.group}</p>}<a href={item.href} aria-current={path === item.href || (item.href === '/properties' && path.startsWith('/properties/')) ? 'page' : undefined} className={`sidebar-link ${path === item.href || (item.href === '/properties' && path.startsWith('/properties/')) ? 'is-active' : ''}`}><span className="nav-icon">{item.icon}</span>{item.label}{item.href === '/gis' && <span className="nav-link-hint">↗</span>}</a></React.Fragment>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><span className="help-spark">✳</span><div><strong>Cần hỗ trợ?</strong><small>Xem hướng dẫn sử dụng</small></div><a href="/api-docs" aria-label="Mở tài liệu">↗</a></div><AccountMenu /></div>
    </aside>
    <header className="mobile-app-header"><a href="/" className="brand-lockup"><span className="brand-mark">G</span><span>ĐỊA ỐC<span className="brand-dot">.</span>KHÔNG GIAN</span></a><AccountMenu /></header>
    <div className="app-context-bar"><div><span className="context-label">GIS-CHAIN</span><span className="context-slash">/</span><span>{visible.find((item) => path === item.href || (item.href === '/properties' && path.startsWith('/properties/')))?.label || 'Không gian làm việc'}</span></div>{rightSlot && <div className="context-meta">{rightSlot}</div>}</div>
    <nav className="mobile-nav" aria-label="Điều hướng nhanh">{visible.slice(0, 4).map((item) => <a key={item.href} href={item.href} aria-current={path === item.href ? 'page' : undefined}><span>{item.icon}</span>{item.label.replace('Hồ sơ bất động sản','Hồ sơ').replace('Kiểm tra hồ sơ','Kiểm tra')}</a>)}</nav>
  </>;
}

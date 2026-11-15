import React from 'react';

export default function PageGuide({ title = 'Cách dùng nhanh', steps = [], note }) {
  return <details className="page-guide">
    <summary><span className="guide-icon">i</span><span><strong>{title}</strong><small>Mở hướng dẫn ngắn cho trang này</small></span><span className="guide-toggle">⌄</span></summary>
    <div className="guide-content">
      {steps.length > 0 && <ol>{steps.map((step, index) => <li key={`${index}-${step}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol>}
      {note && <p className="guide-note">{note}</p>}
    </div>
  </details>;
}

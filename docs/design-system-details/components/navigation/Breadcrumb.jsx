import React from 'react';

export function Breadcrumb({ items = ['Főoldal', 'Videóim', 'Esküvő 2024'] }) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm-size)' }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <span style={{ color: i === items.length - 1 ? 'var(--brand-900)' : 'var(--color-text-secondary)', fontWeight: i === items.length - 1 ? 700 : 500 }}>{item}</span>
          {i < items.length - 1 && <i className="ph-bold ph-caret-right" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }} />}
        </React.Fragment>
      ))}
    </nav>
  );
}
export default Breadcrumb;

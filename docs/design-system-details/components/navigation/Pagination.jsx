import React from 'react';

export function Pagination({ page = 2, total = 6, onChange }) {
  const btn = (active) => ({ width: 36, height: 36, borderRadius: 'var(--radius-full)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: active ? 'var(--accent-purple)' : 'transparent', color: active ? 'var(--color-text-inverse)' : 'var(--brand-900)' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button style={btn(false)} onClick={() => onChange?.(page - 1)}><i className="ph-bold ph-caret-left" /></button>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} style={btn(i + 1 === page)} onClick={() => onChange?.(i + 1)}>{i + 1}</button>
      ))}
      <button style={btn(false)} onClick={() => onChange?.(page + 1)}><i className="ph-bold ph-caret-right" /></button>
    </div>
  );
}
export default Pagination;

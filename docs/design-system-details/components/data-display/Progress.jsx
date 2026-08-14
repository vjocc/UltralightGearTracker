import React from 'react';

export function Progress({ value = 50, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)', width: '100%' }}>
      {label && <span style={{ fontSize: 'var(--text-body-sm-size)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</span>}
      <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--surface-beige)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, value))}%`, borderRadius: 'var(--radius-full)', background: 'var(--accent-purple)', transition: 'width 0.2s ease' }} />
      </div>
    </div>
  );
}
export default Progress;

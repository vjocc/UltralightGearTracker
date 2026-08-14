import React from 'react';

export function Switch({ label, checked = false, onChange, disabled = false }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-size)', color: 'var(--color-text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <span onClick={() => !disabled && onChange?.(!checked)} style={{ width: 44, height: 26, borderRadius: 'var(--radius-full)', background: checked ? 'var(--accent-purple)' : 'var(--surface-beige)', position: 'relative', flexShrink: 0, transition: 'background 0.15s ease' }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface-white)', boxShadow: 'var(--shadow-sm)', transition: 'left 0.15s ease' }} />
      </span>
      {label}
    </label>
  );
}
export default Switch;

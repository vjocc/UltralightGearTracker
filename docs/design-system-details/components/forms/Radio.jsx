import React from 'react';

export function Radio({ label, checked = false, onChange, disabled = false }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-size)', color: 'var(--color-text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <span onClick={() => !disabled && onChange?.(true)} style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${checked ? 'var(--accent-purple)' : 'var(--color-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {checked && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-purple)' }} />}
      </span>
      {label}
    </label>
  );
}
export default Radio;

import React from 'react';

export function Checkbox({ label, checked = false, onChange, disabled = false }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-size)', color: 'var(--color-text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <span onClick={() => !disabled && onChange?.(!checked)} style={{ width: 20, height: 20, borderRadius: 'var(--radius-xs)', border: `1.5px solid ${checked ? 'var(--accent-purple)' : 'var(--color-border)'}`, background: checked ? 'var(--accent-purple)' : 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {checked && <i className="ph-bold ph-check" style={{ fontSize: 13, color: 'var(--surface-white)' }} />}
      </span>
      {label}
    </label>
  );
}
export default Checkbox;

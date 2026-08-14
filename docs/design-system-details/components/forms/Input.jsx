import React from 'react';

export function Input({ label, placeholder = 'Írj ide...', helpText, error, icon = null, disabled = false, id, ...rest }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)' }}>
      {label && <label htmlFor={inputId} style={{ fontSize: 'var(--text-body-sm-size)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 48, borderRadius: 'var(--radius-sm)', background: 'var(--surface-white)', border: `1.5px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`, opacity: disabled ? 0.5 : 1 }}>
        {icon}
        <input id={inputId} placeholder={placeholder} disabled={disabled} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-size)', color: 'var(--color-text-primary)' }} {...rest} />
      </div>
      {(helpText || error) && <span style={{ fontSize: 'var(--text-caption-size)', color: error ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>{error || helpText}</span>}
    </div>
  );
}
export default Input;

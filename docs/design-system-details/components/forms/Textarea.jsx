import React from 'react';

export function Textarea({ label, placeholder = 'Írj ide...', helpText, rows = 4, disabled = false, id }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)' }}>
      {label && <label htmlFor={id} style={{ fontSize: 'var(--text-body-sm-size)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</label>}
      <textarea id={id} rows={rows} placeholder={placeholder} disabled={disabled} style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', background: 'var(--surface-white)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-size)', color: 'var(--color-text-primary)', resize: 'vertical', opacity: disabled ? 0.5 : 1 }} />
      {helpText && <span style={{ fontSize: 'var(--text-caption-size)', color: 'var(--color-text-secondary)' }}>{helpText}</span>}
    </div>
  );
}
export default Textarea;

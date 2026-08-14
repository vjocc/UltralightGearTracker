import React, { useState } from 'react';

export function Select({ label, options = ['Válassz...'], value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value || options[0]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)', position: 'relative', width: 260 }}>
      {label && <label style={{ fontSize: 'var(--text-body-sm-size)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</label>}
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, padding: '0 16px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', background: 'var(--surface-white)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-size)', color: 'var(--color-text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        {selected}
        <i className="ph-duotone ph-caret-down" style={{ fontSize: 18 }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface-white)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', zIndex: 10 }}>
          {options.map((opt, i) => (
            <div key={i} onClick={() => { setSelected(opt); setOpen(false); onChange?.(opt); }} style={{ padding: '10px 16px', fontSize: 'var(--text-body-size)', color: 'var(--color-text-primary)', cursor: 'pointer', background: opt === selected ? 'var(--surface-beige)' : 'transparent' }}>{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}
export default Select;

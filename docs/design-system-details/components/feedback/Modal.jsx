import React from 'react';

export function Modal({ open = true, title, children, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: 'var(--surface-white)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 40, width: 420, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-body)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--text-h4-size)', color: 'var(--brand-900)' }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-secondary)' }}><i className="ph-bold ph-x" /></button>
        </div>
        <div style={{ fontSize: 'var(--text-body-size)', color: 'var(--color-text-secondary)' }}>{children}</div>
      </div>
    </div>
  );
}
export default Modal;

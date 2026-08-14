import React from 'react';

const tones = {
  info: { background: 'var(--surface-blue-pale)', color: 'var(--brand-900)', icon: 'ph-info' },
  success: { background: 'color-mix(in oklab, var(--accent-teal) 20%, white)', color: '#0a6b4f', icon: 'ph-check-circle' },
  warning: { background: 'var(--surface-peach-pale)', color: '#8a5a1f', icon: 'ph-warning' },
  danger: { background: 'color-mix(in oklab, var(--color-danger) 15%, white)', color: 'var(--color-danger)', icon: 'ph-x-circle' },
};

export function Alert({ tone = 'info', title, children }) {
  const t = tones[tone] ?? tones.info;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '16px 20px', borderRadius: 'var(--radius-md)', background: t.background, color: t.color, fontFamily: 'var(--font-body)' }}>
      <i className={`ph-duotone ${t.icon}`} style={{ fontSize: 22, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {title && <strong style={{ fontSize: 'var(--text-body-sm-size)' }}>{title}</strong>}
        <span style={{ fontSize: 'var(--text-body-sm-size)', opacity: 0.9 }}>{children}</span>
      </div>
    </div>
  );
}
export default Alert;

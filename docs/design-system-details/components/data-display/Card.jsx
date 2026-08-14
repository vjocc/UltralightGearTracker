import React from 'react';

const paddings = { sm: 24, md: 40, lg: 64 };
const tones = {
  light: { background: 'var(--surface-peach)', color: 'var(--color-text-primary)' },
  white: { background: 'var(--surface-white)', color: 'var(--color-text-primary)' },
  dark: { background: 'var(--brand-900)', color: 'var(--color-text-inverse)' },
};

export function Card({ tone = 'light', padding = 'md', radius = 'md', shadow = 'none', children, style }) {
  const t = tones[tone] ?? tones.light;
  const shadows = { none: 'none', sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', xl: 'var(--shadow-xl)' };
  return (
    <div style={{
      background: t.background, color: t.color,
      padding: paddings[padding] ?? 40,
      borderRadius: `var(--radius-${radius})`,
      boxShadow: shadows[shadow] ?? 'none',
      display: 'flex', flexDirection: 'column', gap: 16,
      fontFamily: 'var(--font-body)',
      ...style,
    }}>
      {children}
    </div>
  );
}
export default Card;

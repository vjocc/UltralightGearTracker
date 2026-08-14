import React from 'react';

const tones = {
  neutral: { background: 'var(--surface-beige)', color: 'var(--brand-900)' },
  purple: { background: 'color-mix(in oklab, var(--accent-purple) 15%, white)', color: 'var(--accent-purple)' },
  orange: { background: 'color-mix(in oklab, var(--accent-orange) 18%, white)', color: 'var(--accent-orange)' },
  teal: { background: 'color-mix(in oklab, var(--accent-teal) 20%, white)', color: '#0a8a68' },
};

export function Badge({ tone = 'neutral', children = 'Badge' }) {
  const t = tones[tone] ?? tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 12px', borderRadius: 'var(--radius-full)',
      fontFamily: 'var(--font-body)', fontWeight: 700,
      fontSize: 'var(--text-overline-size)', letterSpacing: 'var(--tracking-overline)',
      textTransform: 'uppercase',
      ...t,
    }}>{children}</span>
  );
}
export default Badge;

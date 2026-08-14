import React from 'react';

const sizes = { sm: 32, md: 44, lg: 64 };

export function Avatar({ src, initials = 'MF', size = 'md' }) {
  const s = sizes[size] ?? 44;
  return src ? (
    <img src={src} alt={initials} style={{ width: s, height: s, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: s, height: s, borderRadius: '50%', background: 'var(--brand-900)', color: 'var(--color-text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: s * 0.36, flexShrink: 0 }}>{initials}</div>
  );
}
export default Avatar;

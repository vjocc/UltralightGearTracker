import React from 'react';

const sizes = {
  sm: { height: 40, padding: '8px 24px', fontSize: 'var(--text-body-sm-size)', lineHeight: 'var(--text-body-sm-lh)' },
  md: { height: 48, padding: '12px 36px', fontSize: 'var(--text-body-size)', lineHeight: 'var(--text-body-lh)' },
  lg: { height: 56, padding: '16px 36px', fontSize: 'var(--text-body-size)', lineHeight: 'var(--text-body-lh)' },
};

const variants = {
  primary: { background: 'var(--accent-purple)', color: 'var(--color-text-inverse)', boxShadow: 'none' },
  secondary: { background: 'var(--accent-orange)', color: 'var(--color-text-inverse)', boxShadow: 'none' }, // intentional addition
  outline: { background: 'transparent', color: 'var(--brand-900)', boxShadow: 'var(--shadow-inset-border)' },
  ghost: { background: 'transparent', color: 'var(--brand-900)', boxShadow: 'none' }, // intentional addition
};

export function Button({ variant = 'primary', size = 'md', disabled = false, icon = null, children = 'Button', style, ...rest }) {
  const s = sizes[size] ?? sizes.md;
  const v = variants[variant] ?? variants.primary;
  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: s.height,
        padding: s.padding,
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.15s ease, transform 0.1s ease',
        ...v,
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
export default Button;

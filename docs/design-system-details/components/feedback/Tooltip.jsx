import React, { useState } from 'react';

export function Tooltip({ label, children }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{ position: 'absolute', bottom: '125%', left: '50%', transform: 'translateX(-50%)', background: 'var(--brand-900)', color: 'var(--color-text-inverse)', padding: '6px 12px', borderRadius: 'var(--radius-xs)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-caption-size)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)', zIndex: 20 }}>
          {label}
        </span>
      )}
    </span>
  );
}
export default Tooltip;

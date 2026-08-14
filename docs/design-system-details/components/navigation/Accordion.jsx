import React, { useState } from 'react';

export function Accordion({ items = [{ title: 'Kérdés', body: 'Válasz szöveg.' }], defaultOpen = 0 }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-body)' }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: 'var(--surface-white)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-h6-size)', color: 'var(--brand-900)' }}>
            {item.title}
            <i className="ph-bold ph-caret-down" style={{ transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
          </button>
          {open === i && <div style={{ padding: '0 20px 16px', fontSize: 'var(--text-body-size)', color: 'var(--color-text-secondary)' }}>{item.body}</div>}
        </div>
      ))}
    </div>
  );
}
export default Accordion;

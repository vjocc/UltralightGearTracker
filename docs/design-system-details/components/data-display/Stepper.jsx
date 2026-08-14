import React from 'react';

export function Stepper({ steps = ['Rendeld meg', 'Töltsd fel', 'Ünnepelj'], current = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', fontFamily: 'var(--font-body)', width: '100%' }}>
      {steps.map((step, i) => {
        const done = i < current, active = i === current;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done || active ? 'var(--accent-purple)' : 'var(--surface-beige)', color: done || active ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)', fontWeight: 700, fontSize: 14 }}>
                {done ? <i className="ph-bold ph-check" /> : i + 1}
              </div>
              <span style={{ fontSize: 'var(--text-caption-size)', fontWeight: 600, color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', textAlign: 'center' }}>{step}</span>
            </div>
            {i < steps.length - 1 && <div style={{ height: 2, flex: 1, marginTop: 16, background: i < current ? 'var(--accent-purple)' : 'var(--surface-beige)' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
export default Stepper;

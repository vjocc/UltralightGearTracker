import React from 'react';

export function Table({ columns = ['Név', 'Videó', 'Állapot'], rows = [['Kata B.', 'Esküvő 2024', 'Kész'], ['Marci S.', 'Túra vlog', 'Szerkesztés']] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', background: 'var(--surface-white)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 'var(--text-overline-size)', letterSpacing: 'var(--tracking-overline)', textTransform: 'uppercase', color: 'var(--color-text-secondary)', borderBottom: '1.5px solid var(--color-border)' }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} style={{ padding: '16px 20px', fontSize: 'var(--text-body-size)', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)' }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export default Table;

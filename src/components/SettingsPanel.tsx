import React from 'react'
import Toggle from 'react-toggle'

export default function Component(props: { items: { [label: string]: boolean }; onClick: any }) {
  const listItems = Object.keys(props.items).map(label => (
    <li key={label}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', marginBottom: '0.25rem' }}>
        <Toggle
          checked={props.items[label]}
          icons={false}
          id={label}
          onChange={() => props.onClick(label)}
        />
        <label style={{ margin: 'auto 0 auto 0.5rem', textAlign: 'left' }}>{label}</label>
      </div>
    </li>
  ))

  return (
    <div style={{ padding: '0rem 0.25rem' }}>
      <h4
        style={{
          textAlign: 'left',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          marginBottom: '0.5rem',
          color: 'white',
        }}
      >
        Ein-/Ausblenden
      </h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{listItems}</ul>
    </div>
  )
}

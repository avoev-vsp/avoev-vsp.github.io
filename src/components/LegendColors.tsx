import { LegendItem } from '@/Globals'
import React from 'react'

export default function Component(props: {
  title: string
  description?: string
  values: number[]
  items: LegendItem[]
}) {
  const listItems = props.items.map(item => (
    <li key={item.value + item.value[0]}>
      <div
        style={{
          width: '100%',
          height: `${Math.max(2, 3.0 * (1 * item.value - 1) + 3)}px`,
          backgroundColor: `rgb(${item.color})`,
        }}
      ></div>
      <div style={{ marginBottom: '0.5rem' }}>{item.value}</div>
    </li>
  ))

  return (
    <div style={{ padding: '0rem 0.25rem' }}>
      <h4 style={{ textAlign: 'left', fontWeight: 'bold', marginBottom: '0.5rem' }}>
        {props.title}
      </h4>
      <p>{props.description}</p>
      <ul>{listItems}</ul>
    </div>
  )
}

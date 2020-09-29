import React, { useState, useMemo, useEffect } from 'react'
import { StaticMap } from 'react-map-gl'
import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core'
import DeckGL from '@deck.gl/react'
import DrtRequestLayer from './DrtRequestLayer'

import MovingIconLayer from '@/layers/moving-icons/moving-icon-layer'
import PathTraceLayer from '@/layers/path-trace/path-trace'

const ICON_MAPPING = {
  marker: { x: 0, y: 0, width: 128, height: 128, mask: true },
  info: { x: 128, y: 0, width: 128, height: 128, mask: true },
  vehicle: { x: 128, y: 128, width: 128, height: 128, mask: false },
  diamond: { x: 0, y: 128, width: 128, height: 128, mask: false },
}

// Set your mapbox token here
const MAPBOX_TOKEN =
  'pk.eyJ1IjoidnNwLXR1LWJlcmxpbiIsImEiOiJjamNpemh1bmEzNmF0MndudHI5aGFmeXpoIn0.u9f04rjFo7ZbWiSceTTXyA'
// process.env.MapboxAccessToken // eslint-disable-line

const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0,
})

const pointLight = new PointLight({
  color: [255, 255, 255],
  intensity: 2.0,
  position: [-74.05, 40.7, 8000],
})

const lightingEffect = new LightingEffect({ ambientLight, pointLight })

const DEFAULT_THEME = {
  vehicleColor: [200, 130, 250],
  trailColor0: [235, 235, 25],
  trailColor1: [23, 184, 190],
  effects: [lightingEffect],
}

const INITIAL_VIEW_STATE = {
  latitude: 51.57,
  longitude: 6.98,
  zoom: 12,
  pitch: 0,
  minZoom: 2,
  maxZoom: 22,
}

const DRT_REQUEST = {
  time: 0,
  fromX: 1,
  fromY: 2,
  toX: 3,
  toY: 4,
  arrival: 5,
}

function renderTooltip({ hoverInfo }: any) {
  const { object, x, y } = hoverInfo

  if (!object) {
    return null
  }

  return (
    <div
      className="tooltip"
      style={{
        backgroundColor: '#000000d4  ',
        borderLeft: '6px solid white',
        boxShadow: '2.5px 2px 4px rgba(0,0,0,0.25)',
        color: '#ddd',
        padding: '1rem 1rem',
        position: 'absolute',
        left: x + 40,
        top: y - 30,
      }}
    >
      <big>Taxi: {object.veh}</big>
      <div>Passagiere: {object.occ} </div>
    </div>
  )
}

export default function Component(props: {
  simulationTime: number
  paths: any
  drtRequests: any[]
  traces: any
  colors: any
}) {
  const mapStyle = 'mapbox://styles/vsp-tu-berlin/ckek59op0011219pbwfar1rex'
  // const mapStyle = 'mapbox://styles/vsp-tu-berlin/ckeetelh218ef19ob5nzw5vbh'
  // mapStyle = "mapbox://styles/mapbox/dark-v10",

  const { simulationTime, paths, traces, drtRequests } = props

  const theme = DEFAULT_THEME

  const arcWidth = 2
  const [hoverInfo, setHoverInfo] = useState({})

  const layers = [
    //@ts-ignore:
    new PathTraceLayer({
      id: 'traces',
      data: traces,
      currentTime: props.simulationTime,
      getSourcePosition: (d: any) => d.p0,
      getTargetPosition: (d: any) => d.p1,
      getTimeStart: (d: any) => d.t0,
      getTimeEnd: (d: any) => d.t1,
      getColor: (d: any) => props.colors[d.occ],
      getWidth: (d: any) => 3.0 * (d.occ + 1) - 1,
      opacity: 0.9,
      widthMinPixels: 2,
      rounded: false,
      shadowEnabled: false,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 0, 255],
      onHover: setHoverInfo,
    }),
    //@ts-ignore
    new MovingIconLayer({
      id: 'sprites',
      data: paths,
      getPath: (d: any) => d.path,
      getTimestamps: (d: any) => d.timestamps,
      getIcon: (d: any) => 'vehicle',
      iconMoving: 'vehicle',
      iconStill: 'diamond',
      getSize: 48,
      getColor: theme.vehicleColor,
      opacity: 1.0,
      currentTime: props.simulationTime,
      shadowEnabled: false,
      noAlloc: true,
      iconAtlas: '/icon-atlas.png',
      iconMapping: ICON_MAPPING,
      sizeScale: 1,
      billboard: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 0, 255],
    }),
    //@ts-ignore:
    new DrtRequestLayer({
      id: 'drtRequests',
      data: drtRequests,
      currentTime: props.simulationTime,
      getSourcePosition: (d: any) => [d[DRT_REQUEST.fromX], d[DRT_REQUEST.fromY]],
      getTargetPosition: (d: any) => [d[DRT_REQUEST.toX], d[DRT_REQUEST.toY]],
      getTimeStart: (d: any) => d[DRT_REQUEST.time],
      getTimeEnd: (d: any) => d[DRT_REQUEST.arrival],
      getSourceColor: [255, 0, 255],
      getTargetColor: [200, 255, 255],
      getWidth: arcWidth,
      opacity: 0.2,
    }),
  ]

  return (
    <DeckGL
      layers={layers}
      effects={theme.effects}
      pickingRadius={5}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      getCursor={() => 'pointer'}
    >
      {
        /*
        // @ts-ignore */
        <StaticMap
          reuseMaps
          mapStyle={mapStyle}
          preventStyleDiffing={true}
          mapboxApiAccessToken={MAPBOX_TOKEN}
        />
      }
      {renderTooltip({ hoverInfo })}
    </DeckGL>
  )
}

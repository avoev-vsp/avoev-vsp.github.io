import React, { useState, useMemo, useEffect } from 'react'
import { StaticMap } from 'react-map-gl'
import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core'
import DeckGL from '@deck.gl/react'
import { TripsLayer } from '@deck.gl/geo-layers'

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

const COLOR_OCCUPANCY_MATSIM: any = {
  0: [255, 85, 255],
  1: [255, 255, 85],
  2: [85, 255, 85],
  3: [85, 85, 255],
  4: [255, 85, 85],
  5: [255, 85, 0],
}

const COLOR_OCCUPANCY: any = {
  0: [255, 85, 255],
  1: [255, 255, 85],
  2: [32, 96, 255],
  3: [85, 255, 85],
  4: [255, 85, 85],
  5: [255, 85, 0],
}

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
  minZoom: 2,
  maxZoom: 22,
}

// function handleClick(e: any) {
//   console.log(e)
// }

// function handleHover(e: any) {
//   e.setStyle
// }

// function handleUnhover(e: any) {
//   console.log(e)
// }

function renderTooltip({ hoverInfo }: any) {
  const { object, x, y } = hoverInfo

  if (!object) {
    return null
  }

  const content = <div>Passengers: {object.occ} </div>

  return (
    <div
      className="tooltip"
      style={{
        backgroundColor: '#000000cc',
        borderLeft: '5px solid grey',
        color: '#ddd',
        padding: '1rem 1rem',
        position: 'absolute',
        left: x + 40,
        top: y - 30,
      }}
    >
      <big>Vehicle: {object.veh}</big>
      {content}
    </div>
  )
}

export default function Component(props: any) {
  const mapStyle = 'mapbox://styles/vsp-tu-berlin/ckek59op0011219pbwfar1rex'
  // const mapStyle = 'mapbox://styles/vsp-tu-berlin/ckeetelh218ef19ob5nzw5vbh'
  // mapStyle = "mapbox://styles/mapbox/dark-v10",

  const trips = props.json
  const traces = props.traces
  const trailLength = 50
  const theme = DEFAULT_THEME

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
      getColor: (d: any) => COLOR_OCCUPANCY[d.occ],
      getWidth: (d: any) => 3.0 * d.occ - 2,
      opacity: 0.9,
      widthMinPixels: 2,
      rounded: false,
      shadowEnabled: false,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 0, 255],
      onHover: setHoverInfo,
    }),
    // new TripsLayer({
    //   id: 'worms',
    //   data: trips,
    //   getPath: (d: any) => d.path,
    //   getTimestamps: (d: any) => d.timestamps,
    //   getColor: (d: any) => (d.vendor === 0 ? theme.trailColor1 : theme.trailColor0),
    //   opacity: 0.4,
    //   widthMinPixels: 6.5,
    //   rounded: false,
    //   trailLength,
    //   currentTime: props.simulationTime,
    //   shadowEnabled: false,
    // }),
    //@ts-ignore
    new MovingIconLayer({
      id: 'sprites',
      data: trips,
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

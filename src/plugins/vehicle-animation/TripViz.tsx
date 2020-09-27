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

const COLOR_OCCUPANCY: any = {
  0: [255, 85, 255],
  1: [255, 255, 85],
  2: [85, 255, 85],
  3: [85, 85, 255],
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
  latitude: 51.55,
  longitude: 7,
  zoom: 11,
  minZoom: 2,
  maxZoom: 22,
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
      pickable: true,
      iconAtlas: '/icon-atlas.png',
      iconMapping: ICON_MAPPING,
      sizeScale: 1,
      billboard: true,
    }),
  ]

  return (
    <DeckGL
      layers={layers}
      effects={theme.effects}
      pickingRadius={5}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
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
      {/* {renderTooltip({ incidents, fatalities, year, hoverInfo })} */}
    </DeckGL>
  )
}

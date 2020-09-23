import React, { useState, useMemo, useEffect } from 'react'
import { StaticMap } from 'react-map-gl'
import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core'
import DeckGL from '@deck.gl/react'
import { TripsLayer } from '@deck.gl/geo-layers'
import { scaleLinear, scaleThreshold } from 'd3-scale'

// Set your mapbox token here
const MAPBOX_TOKEN =
  'pk.eyJ1IjoidnNwLXR1LWJlcmxpbiIsImEiOiJjamNpemh1bmEzNmF0MndudHI5aGFmeXpoIn0.u9f04rjFo7ZbWiSceTTXyA'
// process.env.MapboxAccessToken // eslint-disable-line

// Source data GeoJSON
const DATA_URL = {
  TRIPS: '/drt-latlon.json', // eslint-disable-line
  ROADS: '/gladbeck.geo.json',
}

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
  buildingColor: [74, 80, 87],
  trailColor0: [255, 255, 25],
  trailColor1: [23, 184, 190],
  effects: [lightingEffect],
}

const INITIAL_VIEW_STATE = {
  latitude: 51.55,
  longitude: 7,
  zoom: 11,
  minZoom: 4,
  maxZoom: 20,
}

export default function App(props: any) {
  const mapStyle = 'mapbox://styles/vsp-tu-berlin/ckek59op0011219pbwfar1rex'
  // mapStyle = 'mapbox://styles/vsp-tu-berlin/ckeetelh218ef19ob5nzw5vbh',
  // mapStyle = "mapbox://styles/mapbox/dark-v10",
  const trips = DATA_URL.TRIPS
  const trailLength = 80
  const theme = DEFAULT_THEME

  const [hoverInfo, setHoverInfo] = useState({})

  const layers = [
    new TripsLayer({
      id: 'trips',
      data: trips,
      //@ts-ignore
      getPath: d => d.path,
      //@ts-ignore
      getTimestamps: d => d.timestamps,
      //@ts-ignore
      getColor: d => (d.vendor === 0 ? theme.trailColor0 : theme.trailColor1),
      opacity: 1.0,
      widthMinPixels: 5,
      rounded: true,
      trailLength,
      currentTime: props.simulationTime,
      shadowEnabled: false,
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

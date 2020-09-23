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

const material = {
  ambient: 0.1,
  diffuse: 0.6,
  shininess: 32,
  specularColor: [60, 64, 70],
}

const DEFAULT_THEME = {
  buildingColor: [74, 80, 87],
  trailColor0: [255, 255, 25],
  trailColor1: [23, 184, 190],
  material,
  effects: [lightingEffect],
}

export const COLOR_SCALE = scaleThreshold()
  .domain([0, 4, 8, 12, 20, 32, 52, 84, 136, 220])
  .range([
    [26, 152, 80],
    [50, 120, 120],
    [166, 217, 106],
    [217, 239, 139],
    [255, 255, 191],
    [254, 224, 139],
    [253, 174, 97],
    [244, 109, 67],
    [215, 48, 39],
    [168, 0, 0] as any,
  ])

const INITIAL_VIEW_STATE = {
  latitude: 51.55,
  longitude: 7,
  zoom: 11,
  minZoom: 4,
  maxZoom: 20,
}

export default function App({
  mapStyle = 'mapbox://styles/vsp-tu-berlin/ckek59op0011219pbwfar1rex',
  // mapStyle = 'mapbox://styles/vsp-tu-berlin/ckeetelh218ef19ob5nzw5vbh',
  // mapStyle = "mapbox://styles/mapbox/dark-v10",
  trips = DATA_URL.TRIPS,
  trailLength = 80,
  theme = DEFAULT_THEME,
  loopLength = 86400, // unit corresponds to the timestamp in source data
  animationSpeed = 2,
}) {
  const [time, setTime] = useState(24000)
  const [animation] = useState({}) as any
  const [hoverInfo, setHoverInfo] = useState({})

  const animate = () => {
    setTime(t => (t + animationSpeed) % loopLength)
    animation.id = window.requestAnimationFrame(animate)
  }

  useEffect(() => {
    animation.id = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(animation.id)
  }, [animation])

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
      currentTime: time,
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

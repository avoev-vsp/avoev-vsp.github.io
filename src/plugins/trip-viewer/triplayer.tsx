import React, { useState, useMemo, useEffect } from 'react'
import { render } from 'react-dom'
import { StaticMap } from 'react-map-gl'
import { AmbientLight, PointLight, LightingEffect } from '@deck.gl/core'
import { COORDINATE_SYSTEM } from '@deck.gl/core'
import DeckGL from '@deck.gl/react'
import { GeoJsonLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import { scaleLinear, scaleThreshold } from 'd3-scale'

// Set your mapbox token here
const MAPBOX_TOKEN =
  'pk.eyJ1IjoidnNwLXR1LWJlcmxpbiIsImEiOiJjamNpemh1bmEzNmF0MndudHI5aGFmeXpoIn0.u9f04rjFo7ZbWiSceTTXyA'
// process.env.MapboxAccessToken // eslint-disable-line

// Source data GeoJSON
const DATA_URL = {
  ACCIDENTS:
    'https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/highway/accidents.csv',
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

//@ts-ignore
function getKey({ state, type, id }) {
  return `${state}-${type}-${id}`
}

const WIDTH_SCALE = scaleLinear()
  .clamp(true)
  .domain([0, 200])
  .range([10, 2000])

const INITIAL_VIEW_STATE = {
  latitude: 51.55,
  longitude: 7,
  zoom: 11,
  minZoom: 4,
  maxZoom: 20,
}

function aggregateAccidents(accidents: any) {
  const incidents: any = {}
  const fatalities: any = {}

  if (accidents) {
    accidents.forEach((a: any) => {
      const r = (incidents[a.year] = incidents[a.year] || {})
      const f = (fatalities[a.year] = fatalities[a.year] || {})
      const key = getKey(a)
      r[key] = a.incidents
      f[key] = a.fatalities
    })
  }
  return { incidents, fatalities }
}

//@ts-ignore
function renderTooltip({ fatalities, incidents, year, hoverInfo }) {
  const { object, x, y } = hoverInfo

  if (!object) {
    return null
  }

  const props = object.properties
  const key = getKey(props)
  const f = fatalities[year][key]
  const r = incidents[year][key]

  const content = r ? (
    <div>
      <b>{f}</b> people died in <b>{r}</b> crashes on{' '}
      {props.type === 'SR' ? props.state : props.type}-{props.id} in <b>{year}</b>
    </div>
  ) : (
    <div>
      no accidents recorded in <b>{year}</b>
    </div>
  )

  return (
    <div className="tooltip" style={{ left: x, top: y }}>
      <big>
        {props.name} ({props.state})
      </big>
      {content}
    </div>
  )
}

export default function App({
  mapStyle = 'mapbox://styles/vsp-tu-berlin/ckek59op0011219pbwfar1rex',
  // mapStyle = 'mapbox://styles/vsp-tu-berlin/ckeetelh218ef19ob5nzw5vbh',
  // "mapbox://styles/mapbox/dark-v10",
  trips = DATA_URL.TRIPS,
  trailLength = 80,
  initialViewState = INITIAL_VIEW_STATE,
  theme = DEFAULT_THEME,
  loopLength = 86400, // unit corresponds to the timestamp in source data
  animationSpeed = 2,
  roads = DATA_URL.ROADS,
  //@ts-ignore
  year,
  //@ts-ignore
  accidents,
}) {
  const [time, setTime] = useState(24000)
  const [animation] = useState({}) as any
  const [hoverInfo, setHoverInfo] = useState({})
  const { incidents, fatalities } = useMemo(() => aggregateAccidents(accidents), [accidents])

  const animate = () => {
    setTime(t => (t + animationSpeed) % loopLength)
    animation.id = window.requestAnimationFrame(animate)
  }

  useEffect(() => {
    animation.id = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(animation.id)
  }, [animation])

  //@ts-ignore
  const getLineColor = f => {
    if (!fatalities[year]) {
      return [200, 200, 200]
    }
    const key = getKey(f.properties)
    const fatalitiesPer1KMile = ((fatalities[year][key] || 0) / f.properties.length) * 1000
    return COLOR_SCALE(fatalitiesPer1KMile)
  }

  //@ts-ignore
  const getLineWidth = f => {
    if (!incidents[year]) {
      return 10
    }
    const key = getKey(f.properties)
    const incidentsPer1KMile = ((incidents[year][key] || 0) / f.properties.length) * 1000
    return WIDTH_SCALE(incidentsPer1KMile)
  }

  const layers = [
    // new GeoJsonLayer({
    //   id: 'geojson',
    //   data: roads,
    //   stroked: false,
    //   filled: false,
    //   lineWidthMinPixels: 0.5,
    //   parameters: {
    //     depthTest: false,
    //   },

    //   getLineColor,
    //   getLineWidth,

    //   pickable: true,
    //   onHover: setHoverInfo,

    //   updateTriggers: {
    //     getLineColor: { year },
    //     getLineWidth: { year },
    //   },

    //   transitions: {
    //     getLineColor: 1000,
    //     getLineWidth: 1000,
    //   },
    // }),
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

// //@ts-ignore
// export function renderToDOM(container) {
//   //@ts-ignore
//   render(<App />, container)

//   //@ts-ignore
//   const formatRow = d => ({
//     ...d,
//     incidents: Number(d.incidents),
//     fatalities: Number(d.fatalities),
//   })

//   //@ts-ignore
//   require('d3-request').csv(DATA_URL.ACCIDENTS, formatRow, (error, response) => {
//     if (!error) {
//       //@ts-ignore
//       render(<App accidents={response} year={response[0].year} />, container)
//     }
//   })
// }

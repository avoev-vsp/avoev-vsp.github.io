<template lang="pug">
#link-container
  .map-container(v-if="!thumbnail")
    .mymap(:id="mapId")

  left-data-panel.left-panel(v-if="!thumbnail && !myState.loadingText")
   .dashboard-panel
    .info-header
      h3(style="text-align: center; padding: 0.5rem 3rem; font-weight: normal;color: white;")
        | {{this.vizDetails.title ? this.vizDetails.title : 'O/D Flows'}}

    .info-description(style="padding: 0px 0.5rem;" v-if="this.vizDetails.description")
      p.description {{ this.vizDetails.description }}

    .widgets
      h4.heading Uhrzeit
      time-slider.time-slider(v-if="headers.length > 0"
        :useRange='showTimeRange'
        :stops='headers'
        @change='bounceTimeSlider')
      label.checkbox
         input(type="checkbox" v-model="showTimeRange")
         | &nbsp;Zeitraum

      h4.heading Scale
      h4.heading Usw

  .status-blob(v-show="myState.loadingText")
    h4 {{ myState.loadingText }}

</template>

<script lang="ts">
'use strict'

import * as shapefile from 'shapefile'
import { debounce } from 'debounce'
import { FeatureCollection, Feature } from 'geojson'
import mapboxgl, { LngLat, MapMouseEvent, PositionOptions } from 'mapbox-gl'
import nprogress from 'nprogress'
import Papaparse from 'papaparse'
import proj4 from 'proj4'
import readBlob from 'read-blob'
import VueSlider from 'vue-slider-component'
import { Vue, Component, Prop, Watch } from 'vue-property-decorator'
import yaml from 'yaml'

import Coords from '@/util/Coords'
import LeftDataPanel from '@/components/LeftDataPanel.vue'
import ScaleSlider from '@/components/ScaleSlider.vue'
import TimeSlider from './TimeSlider.vue'

import { FileSystem, SVNProject, VisualizationPlugin } from '@/Globals'
import HTTPFileSystem from '@/util/HTTPFileSystem'

import globalStore from '@/store'

interface VolumePlotYaml {
  shpFile: string
  dbfFile: string
  csvFile: string
  projection: string
  scaleFactor: number
  title?: string
  description?: string
  idColumn?: string
}

interface MapElement {
  lngLat: LngLat
  features: any[]
}

const TOTAL_MSG = 'Alle >>'
const SCALE_WIDTH = [1, 3, 5, 10, 25, 50, 100, 150, 200, 300, 400, 450, 500]

@Component({
  components: {
    LeftDataPanel,
    ScaleSlider,
    TimeSlider,
  },
})
class MyComponent extends Vue {
  @Prop({ required: false })
  private fileApi!: FileSystem

  @Prop({ required: false })
  private subfolder!: string

  @Prop({ required: false })
  private yamlConfig!: string

  @Prop({ required: false })
  private thumbnail!: boolean

  private globalState = globalStore.state

  private mapExtentXYXY: any = [180, 90, -180, -90]

  private mapId = `m${Math.floor(Math.random() * Math.floor(1e10))}`

  private myState = {
    fileApi: this.fileApi,
    fileSystem: undefined as SVNProject | undefined,
    subfolder: this.subfolder,
    yamlConfig: this.yamlConfig,
    thumbnail: this.thumbnail,
    loadingText: 'Link Volumes',
    visualization: null,
    project: {},
  }

  private vizDetails: VolumePlotYaml = {
    csvFile: '',
    shpFile: '',
    dbfFile: '',
    projection: '',
    scaleFactor: 1,
    title: '',
    description: '',
  }

  private destroyed() {
    globalStore.commit('setFullScreen', false)
  }

  private async zmounted() {
    globalStore.commit('setFullScreen', !this.thumbnail)
  }

  private async mounted() {
    globalStore.commit('setFullScreen', !this.thumbnail)
    if (!this.yamlConfig) {
      this.buildRouteFromUrl()
    }
    await this.getVizDetails()

    if (this.thumbnail) {
      this.myState.loadingText = ''
      return
    }

    this.generateBreadcrumbs()
    this.setupMap()
  }

  private updateMapExtent(coordinates: any) {
    this.mapExtentXYXY[0] = Math.min(this.mapExtentXYXY[0], coordinates[0])
    this.mapExtentXYXY[1] = Math.min(this.mapExtentXYXY[1], coordinates[1])
    this.mapExtentXYXY[2] = Math.max(this.mapExtentXYXY[2], coordinates[0])
    this.mapExtentXYXY[3] = Math.max(this.mapExtentXYXY[3], coordinates[1])
  }

  private setMapExtent() {
    localStorage.setItem(this.$route.fullPath + '-bounds', JSON.stringify(this.mapExtentXYXY))

    const options = this.thumbnail
      ? { animate: false }
      : {
          padding: { top: 10, bottom: 10, right: 10, left: 250 },
          animate: false,
        }
    this.map.fitBounds(this.mapExtentXYXY, options)
  }

  private generateBreadcrumbs() {
    if (!this.myState.fileSystem) return []

    const crumbs = [
      {
        label: this.myState.fileSystem.name,
        url: '/' + this.myState.fileSystem.url,
      },
    ]

    const subfolders = this.myState.subfolder.split('/')
    let buildFolder = '/'
    for (const folder of subfolders) {
      if (!folder) continue

      buildFolder += folder + '/'
      crumbs.push({
        label: folder,
        url: '/' + this.myState.fileSystem.url + buildFolder,
      })
    }

    // save them!
    globalStore.commit('setBreadCrumbs', crumbs)

    return crumbs
  }

  private getFileSystem(name: string) {
    const svnProject: any[] = globalStore.state.svnProjects.filter((a: any) => a.url === name)
    if (svnProject.length === 0) {
      console.log('no such project')
      throw Error
    }
    return svnProject[0]
  }

  // this happens if viz is the full page, not a thumbnail on a project page
  private buildRouteFromUrl() {
    const params = this.$route.params
    if (!params.project || !params.pathMatch) {
      console.log('I CANT EVEN: NO PROJECT/PARHMATCH')
      return
    }

    // project filesystem
    const filesystem = this.getFileSystem(params.project)
    this.myState.fileApi = new HTTPFileSystem(filesystem)
    this.myState.fileSystem = filesystem

    // subfolder and config file
    const sep = 1 + params.pathMatch.lastIndexOf('/')
    const subfolder = params.pathMatch.substring(0, sep)
    const config = params.pathMatch.substring(sep)

    this.myState.subfolder = subfolder
    this.myState.yamlConfig = config
  }

  private setupMap() {
    try {
      this.map = new mapboxgl.Map({
        bearing: 0,
        container: this.mapId,
        logoPosition: 'bottom-right',
        style: 'mapbox://styles/mapbox/streets-v11',
        pitch: 0,
      })

      this.map.on('style.load', this.mapIsReady)
      this.map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    } catch (e) {
      console.log(e)
    }
  }

  private async getVizDetails() {
    try {
      const text = await this.myState.fileApi.getFileText(
        this.myState.subfolder + '/' + this.myState.yamlConfig
      )
      this.vizDetails = yaml.parse(text)
    } catch (e) {
      // maybe it failed because password?
      if (this.myState.fileSystem && this.myState.fileSystem.need_password && e.status === 401) {
        globalStore.commit('requestLogin', this.myState.fileSystem.url)
      }
    }

    this.$emit('title', this.vizDetails.title)

    this.vizDetails.scaleFactor = this.vizDetails.scaleFactor
    this.vizDetails.projection = this.vizDetails.projection
    this.vizDetails.idColumn = this.vizDetails.idColumn ? this.vizDetails.idColumn : 'id'

    nprogress.done()
  }

  private map!: mapboxgl.Map

  private async loadFiles() {
    try {
      this.myState.loadingText = 'Loading files...'

      const linkFlows = await this.myState.fileApi.getFileText(
        this.myState.subfolder + this.vizDetails.csvFile
      )
      const blob = await this.myState.fileApi.getFileBlob(
        this.myState.subfolder + this.vizDetails.shpFile
      )
      const shpFile = await readBlob.arraybuffer(blob)

      const blob2 = await this.myState.fileApi.getFileBlob(
        this.myState.subfolder + this.vizDetails.dbfFile
      )
      const dbfFile = await readBlob.arraybuffer(blob2)

      return { shpFile, dbfFile, linkFlows }
      //
    } catch (e) {
      console.error({ e })
      this.myState.loadingText = '' + e
      return null
    }
  }

  private geojson: any = {}

  private headers: string[] = []
  private showTimeRange = false
  private bounceTimeSlider = debounce(this.changedTimeSlider, 100)
  private currentTimeBin = TOTAL_MSG
  private scaleValues = SCALE_WIDTH
  private currentScale = SCALE_WIDTH[0]

  private changedTimeSlider(value: any) {
    if (value === this.currentTimeBin) console.log(value)
    this.currentTimeBin = value
    const widthFactor = 0.02 // (this.currentScale / 500) * this.vizDetails.scaleFactor

    if (this.showTimeRange == false) {
      this.map.setPaintProperty('my-layer', 'line-width', ['*', widthFactor, ['get', value]])
      this.map.setPaintProperty('my-layer', 'line-offset', ['*', 0.5 * widthFactor, ['get', value]])
    } else {
      const sumElements: any = ['+']

      // build the summation expressions: e.g. ['+', ['get', '1'], ['get', '2']]
      let include = false
      for (const header of this.headers) {
        if (header === value[0]) include = true

        // don't double-count the total
        if (header === TOTAL_MSG) continue

        if (include) sumElements.push(['get', header])

        if (header === value[1]) include = false
      }

      this.map.setPaintProperty('my-layer', 'line-width', ['*', widthFactor, sumElements])
      this.map.setPaintProperty('my-layer', 'line-offset', ['*', 0.5 * widthFactor, sumElements])
    }
  }

  private processHeaders(csvData: string) {
    const lines = csvData.split('\n')
    const separator = lines[0].indexOf(';') > 0 ? ';' : ','

    // data is in format: o,d, value[1], value[2], value[3]...
    const headers = lines[0].split(separator).map(a => a.trim())
    this.headers = [TOTAL_MSG].concat(headers.slice(1))

    console.log(this.headers)
  }

  private async processShapefile(files: any) {
    this.myState.loadingText = 'Loading shapefile...'
    const geojson = await shapefile.read(files.shpFile, files.dbfFile)

    this.myState.loadingText = 'Converting coordinates...'
    let errCount = 0

    console.log({ geojson })

    this.vizDetails.idColumn = 'Id'

    let id = 0
    for (const feature of geojson.features) {
      // 'id' column used for lookup, unless idColumn is set in YAML

      //if (!this.vizDetails.idColumn && feature.properties)
      //   this.vizDetails.idColumn = Object.keys(feature.properties)[0]

      // Save ID somewhere more helpful
      if (feature.properties) {
        // && this.vizDetails.idColumn) {
        feature.id = id++ // feature.properties[this.vizDetails.idColumn]
        this.idLookup[feature.properties[this.vizDetails.idColumn]] = feature.id
      }

      try {
        if (feature.geometry.type === 'MultiPolygon') {
          this.convertMultiPolygonCoordinatesToWGS84(feature)
        } else if (feature.geometry.type === 'LineString') {
          this.convertLineStringCoordinatesToWGS84(feature)
        } else {
          this.convertPolygonCoordinatesToWGS84(feature)
        }
      } catch (e) {
        errCount++
        if (errCount < 5) {
          console.error('ERR with feature: ' + feature)
          console.error(e)
        }
      }
    }

    return geojson
  }

  private convertLineStringCoordinatesToWGS84(feature: any) {
    const newCoords: any = []
    const coordinates = feature.geometry.coordinates
    for (const origCoord of coordinates) {
      const lnglat = Coords.toLngLat(this.vizDetails.projection, origCoord) as any
      newCoords.push(lnglat)
      this.updateMapExtent(lnglat)
    }

    // replace existing coords
    coordinates.length = 0
    coordinates.push(...newCoords)
  }

  private convertPolygonCoordinatesToWGS84(polygon: any) {
    for (const origCoords of polygon.geometry.coordinates) {
      const newCoords: any = []
      for (const p of origCoords) {
        const lnglat = Coords.toLngLat(this.vizDetails.projection, p) as any
        newCoords.push(lnglat)
      }

      // replace existing coords
      origCoords.length = 0
      origCoords.push(...newCoords)
    }
  }

  private origConvertMultiPolygonCoordinatesToWGS84(multipolygon: any) {
    for (const origCoords of multipolygon.geometry.coordinates) {
      const coordinates = origCoords[0] // multipolygons have an extra array[0] added

      const newCoords: any = []
      for (const p of coordinates) {
        const lnglat = proj4(this.vizDetails.projection, 'WGS84', p) as any
        newCoords.push(lnglat)
      }

      origCoords[0] = newCoords
    }
  }

  private convertMultiPolygonCoordinatesToWGS84(multipolygon: any) {
    multipolygon.geometry.coordinates = this.recurseWGS84(multipolygon.geometry.coordinates)
  }

  private recurseWGS84(coords: any[]): any {
    const newCoords = []

    for (let coordArray of coords) {
      if (Array.isArray(coordArray[0])) {
        newCoords.push(this.recurseWGS84(coordArray))
      } else {
        newCoords.push(proj4(this.vizDetails.projection, 'WGS84', coordArray))
      }
    }
    return newCoords
  }

  private dataset: any = {}
  private idLookup: any = {}

  // Called immediately after MapBox is ready to draw the map
  private async mapIsReady() {
    const inputs = await this.loadFiles()

    if (!inputs) {
      this.myState.loadingText = 'Problem loading files, sorry'
      return
    }

    this.geojson = await this.processShapefile(inputs)

    this.setMapExtent()

    this.processCSVFile(inputs)
    this.processHeaders(inputs.linkFlows)
    this.calculateLinkProperties(this.geojson)

    this.addJsonToMap(this.geojson)
    this.setupMapListeners()

    this.myState.loadingText = ''
    nprogress.done()
  }

  private processCSVFile(inputs: { linkFlows: string }) {
    this.dataset = {}

    // determine delimiter
    let delimiter = ','
    try {
      const header = inputs.linkFlows.substring(0, inputs.linkFlows.indexOf('\n'))
      if (header.indexOf(',') > -1) delimiter = ','
      else if (header.indexOf(';') > -1) delimiter = ';'
      else if (header.indexOf('\t') > -1) delimiter = '\t'
      else if (header.indexOf(' ') > -1) delimiter = ' '
    } catch (e) {
      // use comma
      delimiter = ','
    }

    // convert CSV
    const content = Papaparse.parse(inputs.linkFlows, {
      header: true,
      dynamicTyping: true,
      delimiter,
    })
    console.log('finished reading CSV', content)

    const key = content.meta.fields[0]

    for (const row of content.data) {
      // mapbox requires numerical IDs
      const originalId = row[key]
      const numericalId = this.idLookup[originalId]
      this.dataset[numericalId] = row
    }
    console.log({ dataset: this.dataset })
  }

  private calculateLinkProperties(json: any) {
    console.log('features: ', json.features.length)
    for (const link of json.features) {
      const id = link.id

      link.properties.width = 2
      const values = this.dataset[id]
      if (values) {
        let daily = 0
        for (const key of Object.keys(values)) {
          if (!isNaN(values[key])) {
            link.properties[key] = values[key]
            daily += values[key]
          }
        }
        link.properties[TOTAL_MSG] = daily
        link.properties.width = 0.02 * daily
        // Math.log(2 * values['08:00:00'])
        if (link.properties.width < 2) link.properties.width = 2
      }
    }
  }

  private addJsonToMap(json: any) {
    if (!this.map) return

    this.map.addSource('my-data', {
      data: json,
      type: 'geojson',
    })

    this.map.addLayer({
      id: 'my-layer',
      source: 'my-data',
      type: 'line',
      paint: {
        'line-opacity': 1.0,
        'line-width': ['get', 'width'],
        'line-offset': ['+', 0.25, ['*', 0.5, ['get', 'width']]],
        'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#fb0', '#559'],
      },
      layout: {
        'line-cap': 'round',
      },
    }) // layer gets added just *above* this MapBox-defined layer.
  }

  private setupMapListeners() {
    if (!this.map) return

    const layerName = 'my-layer'
    const parent = this

    this.map.on('click', layerName, (e: MapMouseEvent) => {
      // this.clickedOnTaz(e)
    })

    // turn "hover cursor" into a pointer, so user knows they can click.
    this.map.on('mousemove', layerName, (e: MapMouseEvent) => {
      if (!this.map) return
      this.map.getCanvas().style.cursor = e ? 'pointer' : 'auto'
    })

    // and back to normal when they mouse away
    this.map.on('mouseleave', layerName, () => {
      if (!this.map) return
      this.map.getCanvas().style.cursor = 'auto'
    })

    // set hovers
    this.map.on('mousemove', layerName, function(e: MapMouseEvent) {
      const features = parent.map.queryRenderedFeatures(e.point) as any[]

      if (features.length > 0) {
        if (parent.hoveredStateId) {
          parent.map.setFeatureState(
            { source: 'my-data', id: parent.hoveredStateId },
            { hover: false }
          )
        }

        parent.hoveredStateId = features[0].id

        parent.map.setFeatureState(
          { source: 'my-data', id: parent.hoveredStateId },
          { hover: true }
        )
      }
    })

    // When the mouse leaves the state-fill layer, update the feature state of the
    // previously hovered feature.
    this.map.on('mouseleave', layerName, function() {
      if (parent.hoveredStateId) {
        parent.map.setFeatureState(
          { source: 'my-data', id: parent.hoveredStateId },
          { hover: false }
        )
      }
      parent.hoveredStateId = null
    })
  }

  private hoveredStateId: any = null
  private _popup: any

  /*
  // clickedOnTaz: called when user... clicks on the taz
  private clickedOnTaz(e: MapMouseEvent) {
    console.log(e)

    // cancel old close-popup event because it messes with event ordering
    // if (_popup) _popup.off('close', closePopupEvent);

    // the browser delivers some details that we need, in the fn argument 'e'
    const props = e.features[0].properties

    // highlight the zone that we clicked on, using this weird filter thing in MapBox API
    // see https://www.mapbox.com/mapbox-gl-js/example/hover-styles/
    // mymap.setFilter("highlight-layer", ["==", "id", props.id]);

    // build HTML of popup window
    let html = `<h4>Raw Values:</h4>`
    html +=
      'Freespeed: ' +
      props.Freespeed.toFixed(2) +
      '<br>' +
      'capacity: ' +
      props.capacity.toFixed(2) +
      '<br>' +
      'demand: ' +
      props['base case (demand)_agents']

    //   for (let altname in _activeDataset.alternatives) {
    //     let column = _activeDataset.alternatives[altname].column;
    //     let value = props[column].toFixed(4);
    //     html += `<p class="popup-value"><b>${altname}:</b> ${value}</p>`;
    //   }

    _popup = new mapboxgl.Popup({ closeOnClick: true }).setLngLat(e.lngLat).setHTML(html)

    // add a close-event, to remove highlight if user closes the popup
    // _popup.on('close', closePopupEvent);

    // create the popup!
    _popup.addTo(map)
  }
  */
}

// !register plugin!
globalStore.commit('registerPlugin', {
  kebabName: 'link-volumes',
  prettyName: 'Volumes',
  description: 'Aggregate volumes on network links',
  filePatterns: ['viz-link*.y?(a)ml'],
  component: MyComponent,
} as VisualizationPlugin)

export default MyComponent
</script>

<style scoped>
#link-container {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: 1fr;
  width: 100%;
  min-height: 200px;
  background: url('./thumb-linkvols.jpg') no-repeat center;
}

.map-container {
  background-color: #eee;
  grid-column: 1 / 3;
  grid-row: 1 / 2;
  display: flex;
  flex-direction: column;
}

.mymap {
  height: 100%;
  width: 100%;
}

.widgets h4 {
  font-weight: bold;
  margin-top: 2rem;
}

.left-panel {
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  display: flex;
  flex-direction: column;
  width: 18rem;
  z-index: 100;
}

.info-header {
  background-color: rgb(34, 85, 85);
}

.info-header h3 {
  font-size: 1rem;
}

.info-description {
  margin-top: 0.5rem;
  text-align: center;
  font-size: 0.9rem;
}

.widgets {
  margin-top: 1rem;
  margin-left: 0.5rem;
}

.status-blob {
  background-color: white;
  box-shadow: 0 0 8px #00000040;
  opacity: 0.9;
  margin: auto 0px auto -10px;
  padding: 3rem 0px;
  text-align: center;
  grid-column: 1 / 3;
  grid-row: 1 / 2;
  z-index: 99;
  border-top: solid 1px #479ccc;
  border-bottom: solid 1px #479ccc;
}

.status-blob p,
h2 {
  color: #555;
  font-weight: normal;
}
</style>

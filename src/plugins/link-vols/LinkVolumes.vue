<template lang="pug">
#link-container
  .map-container(v-if="!thumbnail")
    #linkmymap

  .status-blob(v-if="myState.loadingText"): h4 {{ myState.loadingText }}
</template>

<script lang="ts">
'use strict'

import * as shapefile from 'shapefile'
import * as turf from '@turf/turf'
import colormap from 'colormap'
import { debounce } from 'debounce'
import { FeatureCollection, Feature } from 'geojson'
import mapboxgl, { LngLat, MapMouseEvent, PositionOptions } from 'mapbox-gl'
import { multiPolygon } from '@turf/turf'
import nprogress from 'nprogress'
import proj4 from 'proj4'
import readBlob from 'read-blob'
import VueSlider from 'vue-slider-component'
import { Vue, Component, Prop, Watch } from 'vue-property-decorator'
import yaml from 'yaml'

import Coords from '@/util/Coords'
import LeftDataPanel from '@/components/LeftDataPanel.vue'
import ScaleSlider from '@/components/ScaleSlider.vue'

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

@Component({
  components: {
    LeftDataPanel,
    ScaleSlider,
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

  private myState = {
    fileApi: this.fileApi,
    fileSystem: undefined as SVNProject | undefined,
    subfolder: this.subfolder,
    yamlConfig: this.yamlConfig,
    thumbnail: this.thumbnail,
    loadingText: 'Network Volume Plot',
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
    this.map = new mapboxgl.Map({
      bearing: 0,
      center: [13.4, 52.5], // lnglat, not latlng
      container: 'linkmymap',
      logoPosition: 'bottom-left',
      style: 'mapbox://styles/mapbox/light-v9',
      pitch: 0,
      zoom: 11,
    })

    this.map.on('style.load', this.mapIsReady)
    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right')
  }

  private async getVizDetails() {
    // store.visualization = await store.api.fetchVisualization(store.projectId, store.vizId)
    // store.project = await store.api.fetchProject(store.projectId)
    // first get config
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

  private map?: mapboxgl.Map

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

  private async processShapefile(files: any) {
    this.myState.loadingText = 'Converting to GeoJSON...'
    const geojson = await shapefile.read(files.shpFile, files.dbfFile)

    this.myState.loadingText = 'Converting coordinates...'
    let errCount = 0
    for (const feature of geojson.features) {
      // 'id' column used for lookup, unless idColumn is set in YAML
      if (!this.vizDetails.idColumn && feature.properties)
        this.vizDetails.idColumn = Object.keys(feature.properties)[0]

      // Save id somewhere helpful
      // if (feature.properties) feature.id = feature.properties[this.vizDetails.idColumn]

      try {
        if (feature.geometry.type === 'MultiPolygon') {
          this.convertMultiPolygonCoordinatesToWGS84(feature)
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

  // Called immediately after MapBox is ready to draw the map
  private async mapIsReady() {
    const inputs = await this.loadFiles()
    if (!inputs) {
      this.myState.loadingText = 'Problem loading files, sorry'
      return
    }

    this.geojson = await this.processShapefile(inputs)

    this.calculateLinkProperties(inputs.shpFile)
    this.addJsonToMap(inputs.shpFile)
    this.setupMapListeners()

    this.myState.loadingText = ''
    nprogress.done()
  }

  private calculateLinkProperties(json: any) {
    console.log(json)
    for (const link of json.features) {
      link.properties.width = 20 // link.properties['base case (demand)_agents'] / 200
      if (link.properties.width < 3) link.properties.width = 2
      link.properties.vc = 0.8
      // (1.0 * link.properties['base case (demand)_agents']) / link.properties.capacity
    }
  }

  private addJsonToMap(json: any) {
    if (!this.map) return

    this.map.addSource('my-data', {
      data: json,
      type: 'geojson',
    })

    this.map.addLayer(
      {
        id: 'my-layer',
        source: 'my-data',
        type: 'line',
        paint: {
          'line-opacity': 0.8,
          'line-width': ['get', 'width'],
          'line-color': {
            property: 'vc',
            stops: [
              [0.4, '#04c'],
              [0.8, '#084'],
              [1.0, '#0a0'],
              [1.3, '#cc0'],
              [1.7, '#fc0'],
              [2.0, '#800'],
            ],
          },
        },
        // });
      },
      'road-primary'
    ) // layer gets added just *above* this MapBox-defined layer.
  }

  private setupMapListeners() {
    if (!this.map) return

    this.map.on('click', 'my-layer', (e: MapMouseEvent) => {
      // this.clickedOnTaz(e)
    })

    // turn "hover cursor" into a pointer, so user knows they can click.
    this.map.on('mousemove', 'my-layer', (e: MapMouseEvent) => {
      if (!this.map) return
      this.map.getCanvas().style.cursor = e ? 'pointer' : '-webkit-grab'
    })

    // and back to normal when they mouse away
    this.map.on('mouseleave', 'my-layer', () => {
      if (!this.map) return
      this.map.getCanvas().style.cursor = '-webkit-grab'
    })
  }

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
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  width: 100%;
  min-height: 225px;
  background: url('./thumb-linkvols.jpg') no-repeat center;
}

.map-container {
  background-color: #eee;
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  display: flex;
  flex-direction: column;
}

#linkmymap {
  height: 100%;
  width: 100%;
}

.status-blob {
  background-color: white;
  box-shadow: 0 0 8px #00000040;
  opacity: 0.9;
  margin: auto 0px auto -10px;
  padding: 3rem 0px;
  text-align: center;
  grid-column: 1 / 2;
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

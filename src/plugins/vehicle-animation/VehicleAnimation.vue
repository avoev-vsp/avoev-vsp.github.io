<template lang="pug">
#v3-app(:class="{'hide-thumbnail': !thumbnail}"
        :style='{"background": urlThumbnail}' oncontextmenu="return false")

  .nav(v-if="!thumbnail")
    p.big.day {{ vizDetails.title }}
    p.big.time(v-if="myState.statusMessage") {{ myState.statusMessage }}

  .right-side(v-if="!thumbnail")

    .big.time.clock(v-if="!myState.statusMessage")
      p {{ myState.clock }}

    .dark-panel(v-if="isLoaded")

      settings-panel.settings-area(:items="SETTINGS" :onClick="handleSettingChange")

      legend-colors.legend-block(title="Anfragen:" :items="legendRequests")

      legend-colors.legend-block(v-if="legendItems.length"
        title="Passagiere:" :items="legendItems")


      .speed-block
        p.speed-label(
          :style="{'color': textColor.text}") Geschwindigkeit: {{ speed }}x
        vue-slider.speed-slider(v-model="speed"
          :data="speedStops"
          :duration="0"
          :dotSize="20"
          tooltip="active"
          tooltip-placement="bottom"
          :tooltip-formatter="val => val + 'x'"
        )

  .bottom-area

    playback-controls.playback-stuff(v-if="!thumbnail && isLoaded"
      @click='toggleSimulation'
      @time='setTime'
      :timeStart = "timeStart"
      :timeEnd = "timeEnd"
      :isRunning = "myState.isRunning"
      :currentTime = "simulationTime")

  //- .extra-buttons(v-if="isLoaded")
  //-   .help-button(@click='clickedHelp' title="info")
  //-     i.help-button-text.fa.fa-1x.fa-question
  //-   img.theme-button(src="@/assets/images/darkmode.jpg" @click='rotateColors' title="dark/light theme")

  trip-viz.anim(v-if="!thumbnail" :simulationTime="simulationTime"
                :paths="$options.paths"
                :drtRequests="$options.drtRequests"
                :traces="$options.traces"
                :colors="COLOR_OCCUPANCY"
                :settingsShowLayers="SETTINGS")

</template>

<script lang="ts">
import { Component, Prop, Watch } from 'vue-property-decorator'
import Papaparse from 'papaparse'
import VueSlider from 'vue-slider-component'
import { ToggleButton } from 'vue-js-toggle-button'
import readBlob from 'read-blob'
import { Route } from 'vue-router'
import YAML from 'yaml'
import vuera from 'vuera'

import globalStore from '@/store'
import AnimationView from '@/plugins/agent-animation/AnimationView.vue'
import LegendColors from '@/components/LegendColors'
import ModalMarkdownDialog from '@/components/ModalMarkdownDialog.vue'
import PlaybackControls from './PlaybackControls.vue'
import SettingsPanel from '@/components/SettingsPanel'

import {
  ColorScheme,
  FileSystem,
  LegendItem,
  LegendItemType,
  SVNProject,
  VisualizationPlugin,
  LIGHT_MODE,
  DARK_MODE,
} from '@/Globals'

import TripViz from '@/plugins/vehicle-animation/TripViz'
import HTTPFileSystem from '@/util/HTTPFileSystem'

// AnimationView,
// ModalMarkdownDialog,
// PlaybackControls,
// VueSlider,
// ToggleButton,

import Vue from 'vue'
import { VuePlugin } from 'vuera'
Vue.use(VuePlugin)

@Component({
  components: {
    SettingsPanel,
    LegendColors,
    TripViz,
    VueSlider,
    PlaybackControls,
    ToggleButton,
  } as any,
})
class VehicleAnimation extends Vue {
  @Prop({ required: false })
  private fileApi!: FileSystem

  @Prop({ required: false })
  private subfolder!: string

  @Prop({ required: false })
  private yamlConfig!: string

  @Prop({ required: false })
  private thumbnail!: boolean

  private COLOR_OCCUPANCY: any = {
    0: [255, 255, 85],
    1: [32, 96, 255],
    2: [85, 255, 85],
    3: [255, 85, 85],
    4: [200, 0, 0],
    // 5: [255, 150, 255],
  }

  COLOR_OCCUPANCY_MATSIM_UNUSED: any = {
    0: [255, 85, 255],
    1: [255, 255, 85],
    2: [85, 255, 85],
    3: [85, 85, 255],
    4: [255, 85, 85],
    5: [255, 85, 0],
  }

  SETTINGS: { [label: string]: boolean } = {
    Fahrzeuge: true,
    Kurse: true,
    'DRT Anfragen': true,
  }

  private legendItems: LegendItem[] = Object.keys(this.COLOR_OCCUPANCY).map(key => {
    return { type: LegendItemType.line, color: this.COLOR_OCCUPANCY[key], value: key, label: key }
  })

  private legendRequests = [
    { type: LegendItemType.line, color: [255, 0, 255], value: 0, label: '' },
  ]

  private vizDetails = {
    network: '',
    drtTrips: '',
    projection: '',
    title: '',
    description: '',
    thumbnail: '',
  }

  public myState = {
    statusMessage: '',
    clock: '00:00',
    colorScheme: ColorScheme.DarkMode,
    isRunning: false,
    isShowingHelp: false,
    fileApi: this.fileApi,
    fileSystem: undefined as SVNProject | undefined,
    subfolder: this.subfolder,
    yamlConfig: this.yamlConfig,
    thumbnail: this.thumbnail,
    data: [] as any[],
  }

  private timeStart = 0
  private timeEnd = 86400

  // 08:10:00
  private simulationTime = 8 * 3600 + 10 * 60 + 10

  private timeElapsedSinceLastFrame = 0

  private globalState = globalStore.state
  private isDarkMode = this.myState.colorScheme === ColorScheme.DarkMode
  private isLoaded = true
  private showHelp = false

  private speedStops = [-10, -5, -2, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 2, 5, 10]
  private speed = 1

  private legendBits: any[] = []

  private handleSettingChange(label: string) {
    console.log(label)
    this.SETTINGS[label] = !this.SETTINGS[label]
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

  private thumbnailUrl = "url('assets/thumbnail.jpg') no-repeat;"
  private get urlThumbnail() {
    return this.thumbnailUrl
  }

  private getFileSystem(name: string) {
    const svnProject: any[] = globalStore.state.svnProjects.filter((a: any) => a.url === name)
    if (svnProject.length === 0) {
      console.log('no such project')
      throw Error
    }
    return svnProject[0]
  }

  private async getVizDetails() {
    // first get config
    try {
      const text = await this.myState.fileApi.getFileText(
        this.myState.subfolder + '/' + this.myState.yamlConfig
      )
      this.vizDetails = YAML.parse(text)
    } catch (e) {
      console.log('failed')
      // maybe it failed because password?
      if (this.myState.fileSystem && this.myState.fileSystem.need_password && e.status === 401) {
        globalStore.commit('requestLogin', this.myState.fileSystem.url)
      }
    }

    // title
    const t = this.vizDetails.title ? this.vizDetails.title : 'Agent Animation'
    this.$emit('title', t)

    this.buildThumbnail()
  }

  private async buildThumbnail() {
    if (this.thumbnail && this.vizDetails.thumbnail) {
      try {
        const blob = await this.myState.fileApi.getFileBlob(
          this.myState.subfolder + '/' + this.vizDetails.thumbnail
        )
        const buffer = await readBlob.arraybuffer(blob)
        const base64 = this.arrayBufferToBase64(buffer)
        if (base64)
          this.thumbnailUrl = `center / cover no-repeat url(data:image/png;base64,${base64})`
      } catch (e) {
        console.error(e)
      }
    }
  }

  @Watch('globalState.authAttempts') private async authenticationChanged() {
    console.log('AUTH CHANGED - Reload')
    if (!this.yamlConfig) this.buildRouteFromUrl()
    await this.getVizDetails()
  }

  @Watch('state.colorScheme') private swapTheme() {
    this.isDarkMode = this.myState.colorScheme === ColorScheme.DarkMode
    this.updateLegendColors()
  }

  private arrayBufferToBase64(buffer: any) {
    var binary = ''
    var bytes = new Uint8Array(buffer)
    var len = bytes.byteLength
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }

  private updateLegendColors() {
    // const theme = this.myState.colorScheme == ColorScheme.LightMode ? LIGHT_MODE : DARK_MODE
    // this.legendBits = [
    //   { label: 'susceptible', color: theme.susceptible },
    //   { label: 'latently infected', color: theme.infectedButNotContagious },
    //   { label: 'contagious', color: theme.contagious },
    //   { label: 'symptomatic', color: theme.symptomatic },
    //   { label: 'seriously ill', color: theme.seriouslyIll },
    //   { label: 'critical', color: theme.critical },
    //   { label: 'recovered', color: theme.recovered },
    // ]
  }

  private get textColor() {
    const lightmode = {
      text: '#3498db',
      bg: '#eeeef480',
    }

    const darkmode = {
      text: 'white',
      bg: '#181518aa',
    }

    return this.myState.colorScheme === ColorScheme.DarkMode ? darkmode : lightmode
  }

  private setWallClock() {
    const hour = Math.floor(this.simulationTime / 3600)
    const minute = Math.floor(this.simulationTime / 60) % 60
    this.myState.clock = `${hour < 10 ? '0' : ''}${hour}${minute < 10 ? ':0' : ':'}${minute}`
  }

  private setTime(seconds: number) {
    this.simulationTime = seconds
    this.setWallClock()
  }
  private toggleSimulation() {
    this.myState.isRunning = !this.myState.isRunning
    this.timeElapsedSinceLastFrame = Date.now()

    // ok so, many times I mashed the play/pause wondering why things wouldn't
    // start moving. Turns out a 0x speed is not very helpful! Help the user
    // out and switch the speed up if they press play.
    if (this.myState.isRunning && this.speed === 0.0) this.speed = 1.0
  }

  private async mounted() {
    globalStore.commit('setFullScreen', !this.thumbnail)

    if (!this.yamlConfig) this.buildRouteFromUrl()
    await this.getVizDetails()

    if (this.thumbnail) return

    this.showHelp = false
    this.generateBreadcrumbs()
    this.updateLegendColors()

    const { paths, drtRequests } = await this.loadFiles()

    this.setWallClock()

    //@ts-ignore:
    this.$options.paths = paths

    //@ts-ignore:
    this.$options.drtRequests = drtRequests

    //@ts-ignore:
    this.$options.traces = await this.parseJson()

    this.myState.isRunning = true

    setTimeout(() => {
      document.addEventListener('visibilitychange', this.handleVisibilityChange, false)
      this.timeElapsedSinceLastFrame = Date.now()
      this.animate()
    }, 2000)
  }

  private animate() {
    if (this.myState.isRunning) {
      const elapsed = Date.now() - this.timeElapsedSinceLastFrame
      this.timeElapsedSinceLastFrame += elapsed
      this.simulationTime += elapsed * this.speed * 0.06
      this.setWallClock()
    }
    window.requestAnimationFrame(this.animate)
  }

  private isPausedDueToHiding = false

  private handleVisibilityChange() {
    if (this.isPausedDueToHiding && !document.hidden) {
      console.log('unpausing')
      this.isPausedDueToHiding = false
      this.toggleSimulation()
    } else if (this.myState.isRunning && document.hidden) {
      console.log('pausing')
      this.isPausedDueToHiding = true
      this.toggleSimulation()
    }
  }

  // convert path/timestamp info into path traces we can use
  private parseJson() {
    let countTraces = 0
    const traces: any = []
    let countVehicles = 0

    //@ts-ignore:
    this.$options.paths.forEach((vehicle: any) => {
      countVehicles++

      let time = vehicle.timestamps[0]
      let nextTime = vehicle.timestamps[0]

      let segments: any[] = []

      for (let i = 1; i < vehicle.path.length; i++) {
        nextTime = vehicle.timestamps[i]

        // same point? start of new path.
        if (
          vehicle.path[i][0] === vehicle.path[i - 1][0] &&
          vehicle.path[i][1] === vehicle.path[i - 1][1]
        ) {
          segments.forEach(segment => {
            segment.t1 = vehicle.timestamps[i - 1]
          })

          traces.push(...segments)

          segments = []
          time = nextTime
        } else {
          segments.push({
            t0: time,
            p0: vehicle.path[i - 1],
            p1: vehicle.path[i],
            veh: countVehicles,
            occ: vehicle.passengers[i - 1],
          })
        }
      }

      // save final segments
      segments.forEach(segment => {
        segment.t1 = nextTime
      })
      traces.push(...segments)
    })
    return traces
  }

  private beforeDestroy() {
    document.removeEventListener('visibilityChange', this.handleVisibilityChange)
    globalStore.commit('setFullScreen', false)
    this.$store.commit('setFullScreen', false)
    this.myState.isRunning = false
  }

  private async loadFiles() {
    let paths: any = []
    let drtRequests: any = []

    try {
      const json = await this.myState.fileApi.getFileJson(
        this.myState.subfolder + '/' + this.vizDetails.drtTrips
      )
      paths = json.trips
      drtRequests = json.drtRequests
    } catch (e) {
      console.error(e)
      this.myState.statusMessage = '' + e
    }
    return { paths, drtRequests }
  }

  private clickedHelp() {
    console.log('HEEELP!')
    this.myState.isRunning = false
    this.showHelp = true
    this.myState.isShowingHelp = this.showHelp
  }

  private clickedCloseHelp() {
    this.showHelp = false
    this.myState.isShowingHelp = this.showHelp
    // only show the help once
    // this.$store.commit('setSawAgentAnimationHelp', true)
    this.myState.isRunning = true
  }

  private toggleLoaded(loaded: boolean) {
    this.isLoaded = loaded
  }

  private rotateColors() {
    this.myState.colorScheme =
      this.myState.colorScheme === ColorScheme.DarkMode
        ? ColorScheme.LightMode
        : ColorScheme.DarkMode
    localStorage.setItem('plugin/agent-animation/colorscheme', this.myState.colorScheme)
  }
}

// !register plugin!
globalStore.commit('registerPlugin', {
  kebabName: 'vehicle-animation',
  prettyName: 'Trip Viewer',
  description: 'Deck.gl based trip viewer',
  filePatterns: ['viz-vehicles*.y?(a)ml'],
  component: VehicleAnimation,
} as VisualizationPlugin)

export default VehicleAnimation
</script>

<style scoped lang="scss">
@import '~vue-slider-component/theme/default.css';
@import '@/styles.scss';
@import '~react-toggle/style.css';

#v3-app {
  display: grid;
  min-height: 200px;
  background: url('assets/thumbnail.jpg') no-repeat;
  background-size: cover;
  pointer-events: none;
  grid-template-columns: 1fr min-content;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    'hd       rightside'
    '.        rightside'
    'playback  playback';
}

#v3-app.hide-thumbnail {
  background: none;
}

#help-dialog {
  padding: 2rem 2rem;
  pointer-events: auto;
  // z-index: 20;
}

img.theme-button {
  opacity: 1;
  margin: 1rem 0 0.5rem auto;
  background-color: black;
  border-radius: 50%;
  border: 2px solid #648cb4;
  box-shadow: 0px 5px 10px rgba(0, 0, 0, 0.25);
  width: 3rem;
  height: 3rem;
  cursor: pointer;
  pointer-events: auto;
}

img.theme-button:hover {
  border: 2px solid white;
}

#top-hover-panel img.theme-button:hover {
  cursor: pointer;
  background-color: white;
}

.nav {
  grid-area: hd;
  display: flex;
  flex-direction: row;
  margin: 0 0;
  padding: 0 0.5rem 0 1rem;

  a {
    font-weight: bold;
    color: white;
    text-decoration: none;

    &.router-link-exact-active {
      color: white;
    }
  }

  p {
    margin: auto 0.5rem auto 0;
    padding: 0 0;
    color: white;
  }
}

.dark-panel {
  background-color: $steelGray; // #000000cc;
}

.speed-block {
  margin-top: 2rem;
  padding: 0 0.25rem 0 0.5rem;
}

.legend-block {
  margin-top: 2rem;
  padding: 0rem 0.25rem;
}

.speed-slider {
  flex: 1;
  width: 100%;
  margin: 0rem 0.25rem 0rem 0rem;
  pointer-events: auto;
  font-weight: bold;
}

.big {
  padding: 0rem 0;
  // margin-top: 1rem;
  font-size: 2rem;
  line-height: 3.75rem;
  font-weight: bold;
}

.controls {
  display: flex;
  flex-direction: row;
}

.left-side {
  flex: 1;
  margin-left: 0.5rem;
  margin-right: auto;
}

.right-side {
  grid-area: rightside;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  // margin-right: 1rem;
  padding: 0 0;
  color: white;
  pointer-events: none;
}

.logo {
  flex: 1;
  margin-top: auto;
  margin-left: auto;
  margin-bottom: none;
}

.help-button {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  color: white;
  background-color: $themeColor;
  display: flex;
  text-align: center;
  box-shadow: 0px 5px 10px rgba(0, 0, 0, 0.25);
  margin: 0 0 0 auto;
  cursor: pointer;
  pointer-events: auto;
}

.help-button:hover {
  background-color: #39a8f1;
  border: 2px solid white;
}

.help-button-text {
  margin: auto auto;
}

.playback-stuff {
  flex: 1;
}

.bottom-area {
  display: flex;
  flex-direction: row;
  margin-bottom: 2rem;
  grid-area: playback;
  padding: 0rem 1rem 1rem 2rem;
  pointer-events: auto;
}

.settings-area {
  pointer-events: auto;
  background-color: $steelGray;
  color: white;
  font-size: 0.8rem;
  padding: 0.25rem 0.25rem;
  margin: 1rem 2rem 0 0;
}

.extra-buttons {
  margin-left: auto;
  margin-right: 1rem;
  grid-area: extrabuttons;
}

.anim {
  background-color: #181919;
  z-index: -1;
  grid-column: 1 / 3;
  grid-row: 1 / 7;
  pointer-events: auto;
}

.label {
  margin-right: 1rem;
  color: white;
  text-align: left;
  line-height: 1.1rem;
  width: min-content;
}

.speed-label {
  font-weight: bold;
}

.clock {
  background-color: #000000cc;
  border: 3px solid white;
}

.clock p {
  margin-left: 0.25rem;
  padding: 5px 10px;
}

.tooltip {
  padding: 5rem 5rem;
  background-color: #ccc;
}
@media only screen and (max-width: 640px) {
  .nav {
    padding: 0.5rem 0.5rem;
  }

  .clock {
    text-align: center;
  }

  .right-side {
    font-size: 0.7rem;
    margin-right: 0.25rem;
  }

  .big {
    padding: 0 0rem;
    margin-top: 0.5rem;
    font-size: 1.3rem;
    line-height: 2rem;
  }

  .side-section {
    margin-left: 0;
  }

  .extra-buttons {
    margin-right: 1rem;
  }
  .playback-stuff {
    padding-right: 1rem;
  }
}
</style>

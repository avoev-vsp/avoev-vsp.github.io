// import plugins in the order you want them to appear on project pages
import VehicleAnimation from '@/plugins/vehicle-animation/VehicleAnimation.vue'
import XyHexagons from '@/plugins/xy-hexagons/XyHexagons.vue'
import AgentAnimation from '@/plugins/agent-animation/AgentAnimation.vue'
import LinksGl from '@/plugins/links-gl/LinksGl.vue'
import LinkVolumes from '@/plugins/link-vols/LinkVolumes.vue'
import SankeyDiagram from '@/plugins/sankey/SankeyDiagram.vue'
import VegaLite from '@/plugins/vega-lite/VegaLite.vue'
import AggregateOd from '@/plugins/aggregate-od/AggregateOd.vue'
import TransitSupply from '@/plugins/transit-supply/TransitSupply.vue'
import VideoPlayer from '@/plugins/video-player/VideoPlayer.vue'
import ImageView from '@/plugins/image/ImageView.vue'

// EVERY plugin must be registered here:
const plugins = {
  VehicleAnimation,
  XyHexagons,
  AgentAnimation,
  LinksGl,
  LinkVolumes,
  SankeyDiagram,
  VegaLite,
  AggregateOd,
  TransitSupply,
  VideoPlayer,
  ImageView,
}

export default plugins

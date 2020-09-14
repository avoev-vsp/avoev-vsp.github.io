import Vue from 'vue'
import App from '@/App.vue'
import router from '@/router'
import store from '@/store'
import Buefy from 'buefy'
import { VuePlugin } from 'vuera'

Vue.use(VuePlugin)

Vue.use(Buefy, {
  defaultIconPack: 'mdi',
  defaultInputHasCounter: false,
})

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App),
}).$mount('#app')

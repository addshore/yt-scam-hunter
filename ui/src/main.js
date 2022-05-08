import 'vuetify/styles' // Global CSS has to be imported
import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import App from './App.vue'
import { loadFonts } from './plugins/webfontloader'

loadFonts()

const app = createApp(App)
const vuetify = createVuetify() // Replaces new Vuetify(...)
app.use(vuetify)
app.mount('#app')

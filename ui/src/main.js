import 'vuetify/styles' // Global CSS has to be imported

import { createApp } from 'vue'
import vuetify from './plugins/vuetify'
import App from './App.vue'
import { loadFonts } from './plugins/webfontloader'
import { createRouter, createWebHashHistory } from 'vue-router'

import HomePage from "./components/HomePage.vue";
import StreamsPage from "./components/StreamsPage.vue";
import DomainsPage from "./components/DomainsPage.vue";
import WalletsPage from "./components/WalletsPage.vue";

const routes = [
    { path: '/', component: HomePage },
    { path: '/streams', component: StreamsPage },
    { path: '/websites', component: DomainsPage },
    { path: '/wallets', component: WalletsPage },
  ]

const router = createRouter({
// 4. Provide the history implementation to use. We are using the hash history for simplicity here.
history: createWebHashHistory(),
routes, // short for `routes: routes`
})

loadFonts()

const app = createApp(App)
app.use(vuetify)
app.use(router)
app.mount('#app')

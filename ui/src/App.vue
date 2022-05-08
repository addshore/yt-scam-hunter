<template>
  <v-app>
    <v-main>
      <v-card>
        <v-app-bar>
          <v-app-bar-nav-icon></v-app-bar-nav-icon>
          <v-toolbar-title>YT Scam Hunter</v-toolbar-title>
          <template v-slot:extension>
            <v-tabs grow v-model="active_tab">
              <v-tab
                v-for="tab of tabs"
                :key="tab.index"
              >
              {{tab.name}}
              </v-tab>
            </v-tabs>
          </template>
        </v-app-bar>
        <v-sheet>
          <div>
              <!-- Change selected component according to selected tab -->
            <div v-if="active_tab === 0">
              <HomePage/>
            </div>
            <div v-if="active_tab === 1">
              <StreamsPage/>
            </div>
            <div v-if="active_tab === 2">
              <DomainsPage/>
            </div>
            <div v-if="active_tab === 3">
              <WalletsPage/>
            </div>
          </div>
        </v-sheet>
      </v-card>
    </v-main>
  </v-app>
</template>

<script>
import HomePage from "./components/HomePage.vue";
import StreamsPage from "./components/StreamsPage.vue";
import DomainsPage from "./components/DomainsPage.vue";
import WalletsPage from "./components/WalletsPage.vue";

export default {
  name: "App",

  components: {
    HomePage,
    StreamsPage,
    DomainsPage,
    WalletsPage,
  },

  data: () => ({
      active_tab: 0,
      tabs: [
        { index: 0, name: 'Home' },
        { index: 1, name: 'Streams' },
        { index: 2, name: 'Domains' },
        { index: 3, name: 'Wallets' }
      ],
    }),
  methods: {
    tabsUpdate(tab) {
      this.selectedTab = tab
    },
}
};
</script>

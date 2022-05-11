<template>
  <v-app>
    <v-main>
        <v-app-bar>
          <v-container>
          <v-toolbar-title>YouTube Scam Hunter</v-toolbar-title>
          </v-container>
          <template v-slot:extension>
            <v-container>
            <v-tabs icons-and-text>
              <v-tab
                v-for="tab of tabs"
                :key="tab.name"
                :to="tab.link"
                :value="tab.name"
              >
              <v-icon icon="{{tab.icon}}">{{tab.icon}}</v-icon>
              {{tab.name}}
              </v-tab>
            </v-tabs>
            </v-container>
          </template>
        </v-app-bar>
        <router-view></router-view>
    </v-main>
  <v-footer>
    <v-card
      elevation="0"
      rounded="0"
      width="100%"
      class="bg-grey text-center"
    >
      <v-card-text>
        <v-btn
          class="mx-4"
          icon="mdi-home"
          variant="plain"
          href="https://addshore.com"
          target="_blank"
        ></v-btn>
        <v-btn
          class="mx-4"
          icon="mdi-github"
          variant="plain"
          href="https://github.com/addshore/yt-scam-hunter"
          target="_blank"
        ></v-btn>
        <v-btn
          class="mx-4"
          icon="mdi-twitter"
          variant="plain"
          href="https://twitter.com/addshore"
          target="_blank"
        ></v-btn>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-text class="text-white">
        {{ new Date().getFullYear() }} — <strong>Addshore</strong>
      </v-card-text>
    </v-card>
  </v-footer>
  </v-app>
</template>

<script>
export default {
  name: "App",

  components: {},

  data: () => ({
      tabs: [
        { name: 'Home', link: '/', icon: 'mdi-home' },
        { name: 'Streams', link: '/streams', icon: 'mdi-youtube' },
        { name: 'Websites', link: '/websites', icon: 'mdi-web' },
        { name: 'Wallets', link: '/wallets', icon: 'mdi-wallet' },
      ],
    }),
  methods: {}
};
</script>

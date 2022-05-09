<template>
  <v-container>
    <div id="app">
      <h2 class="headline font-weight-bold mb-5">Websites</h2>
      <p>
        Most scam streams include a website to navigate to in order to get
        scammed.
      </p>
      <p>This list includes the sites we have found to be online.</p>
      <p><small><v-icon icon="mdi-alert" color="red"/>Links will open the scam site</small></p>
      <v-divider></v-divider>
      <v-progress-circular
        v-if="domains === null"
        indeterminate
        color="primary"
      ></v-progress-circular>
      <template v-for="(item, domain) in domains" :key="domain">
        <a :href="item.url" target="_blank" rel="nofollow"
          ><v-chip>{{ domain }}</v-chip></a
        >
      </template>
    </div>
  </v-container>
</template>

<script>
import axios from "axios";
export default {
  name: "DomainsPage",
  data: () => ({
    domains: null,
  }),
  mounted() {
    axios.get(process.env.VUE_APP_ENDPOINT + "/domains").then((response) => {
      this.domains = response.data;
    });
  },
};
</script>

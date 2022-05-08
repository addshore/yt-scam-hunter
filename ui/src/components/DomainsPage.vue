<template>
  <v-container>
    <div id="app">
      <!-- Create a table for btc data -->
      <v-list>
        <v-list-item>
          <v-list-item-title>
            <v-row>
              <v-col cols="12" sm="6">
                <v-card>
                  <v-card-title>
                    <v-card-text>
                      <h2 class="headline font-weight-bold mb-5">
                        Domains
                      </h2>
                      <strong v-if="domains === null">Loading...</strong>
                      <ul>
                      <template v-for="(item, domain) in domains" :key="domain">
                        <li><a :href="item.url" target="_blank">{{ domain }}</a></li>
                      </template>
                      </ul>
                    </v-card-text>
                  </v-card-title>
                </v-card>
              </v-col>
            </v-row>
          </v-list-item-title>
        </v-list-item>
      </v-list>
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
    axios
      .get("https://us-central1-scam-hunter.cloudfunctions.net/domains")
      .then((response) => {
        this.domains = response.data;
      });
  },
};
</script>

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
                        BTC Wallets
                      </h2>
                      <strong v-if="btc === null">Loading...</strong>
                      <ul>
                      <template v-for="(item, address) in btc" :key="address">
                        <li><a :href="item.info" target="_blank">{{ address }}</a></li>
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
      <v-list>
        <v-list-item>
          <v-list-item-title>
            <v-row>
              <v-col cols="12" sm="6">
                <v-card>
                  <v-card-title>
                    <v-card-text>
                      <h2 class="headline font-weight-bold mb-5">
                        ETH Wallets
                      </h2>
                      <strong v-if="etc === null">Loading...</strong>
                      <ul>
                      <template v-for="(item, address) in eth" :key="address">
                        <li><a :href="item.info" target="_blank">{{ address }}</a></li>
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
  name: "WalletsPage",

  data: () => ({
    btc: null,
    eth: null,
  }),
  mounted() {
    axios
      .get( process.env.VUE_APP_ENDPOINT + "/wallets")
      .then((response) => {
        this.btc = response.data.btc;
        this.eth = response.data.eth;
      });
  },
};
</script>

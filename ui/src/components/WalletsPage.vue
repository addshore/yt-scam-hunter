<template>
  <v-container>
    <div id="app">
      <h2 class="headline font-weight-bold mb-5">Wallets</h2>
      <p>
        Most of the websites on the streams try to get people to send BTC or ETH
        to various wallets.
      </p>
      <p>These are the wallets extracted from the sites.</p>
      <p><small><v-icon icon="mdi-alert" color="red"/>These are all scammer wallets</small></p>
      <v-divider></v-divider>
      <h2 class="font-weight-bold">BTC</h2>
      <small>Links open wallet infomation on <a href="https://blockchain.info" target="_blanks">blockchain.info</a></small><br/>
      <v-progress-circular
        v-if="btc === null"
        indeterminate
        color="primary"
      ></v-progress-circular>
        <template v-for="(item, address) in btc" :key="address">
            <a :href="item.info" target="_blank"><v-chip>{{ address }}</v-chip></a>
        </template>
      <h2 class="font-weight-bold">ETH</h2>
      <small>Links open wallet infomation on <a href="https://etherscan.io" target="_blank">etherscan.io</a></small><br/>
      <v-progress-circular
        v-if="eth === null"
        indeterminate
        color="primary"
      ></v-progress-circular>
        <template v-for="(item, address) in eth" :key="address">
            <a :href="item.info" target="_blank"><v-chip>{{ address }}</v-chip></a>
        </template>
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
    axios.get(process.env.VUE_APP_ENDPOINT + "/wallets").then((response) => {
      this.btc = response.data.btc;
      this.eth = response.data.eth;
    });
  },
};
</script>

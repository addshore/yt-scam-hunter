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
      <p>Total received: <a v-bind:href="googleConvertLink(btcReceived,'BTC')" target="_blank">{{btcReceived}} BTC</a></p>
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
      <p>Total current balance: <a v-bind:href="googleConvertLink(ethBalance,'ETH')" target="_blank">{{ethBalance}} ETH</a></p>
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
  methods : {
    googleConvertLink(ammount, from){
      return "https://www.google.com/search?q=" + ammount + " " + from + " in USD";
    }
  },
  computed: {
    btcReceived() {
      if (this.btc === null) {
        return "Loading...";
      }
      let total = 0;
      for (let address in this.btc) {
        total += parseFloat(this.btc[address].received)
      }
      return total
    },
    ethBalance() {
      if (this.eth === null) {
        return "Loading...";
      }
      let total = 0;
      for (let address in this.eth) {
        total += parseFloat(this.eth[address].balance)
      }
      return total
    }
  }
};
</script>

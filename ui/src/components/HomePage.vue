<template>
  <v-container>
    <v-row>
      <v-col class="mb-5" cols="12">
        <h2 class="headline font-weight-bold mb-5">Home</h2>
        <p>This website tracks the live crypto scams that happen on YouTube every day.</p>
        <p>Crypto scams have existed on YouTube for the last few years. </p>
        <p>They havn't changed much, but YouTube has really failed to tackle them.</p>
        <p>The general pattern involves a hijacked account, a renammed channel, a video with some well known figures, and a link to a "competition" or giveaway.</p>
        <br/>
        <p>Currently tracking <router-link to="/streams">{{liveStreamCount}} streams</router-link>, <router-link to="/websites">{{domainCount}} websites</router-link>, and <router-link to="/wallets">{{walletCount}} wallets</router-link> holding a total of <a v-bind:href="googleConvertLink(btcReceived,'BTC')" target="_blank">{{btcTotalReceived}} BTC</a> and <a v-bind:href="googleConvertLink(ethBalance,'ETH')" target="_blank">{{ethTotalBalance}} ETH</a></p>
        <br/>
        <p>Use the tabs above to navigate through the data.</p>
      </v-col>

      <v-col class="mb-5" cols="12">
        <h2 class="headline font-weight-bold mb-5">News</h2>
        <v-timeline align="start">
          <v-timeline-item
            v-for="(next, i) in newsLinks"
            :key="i"
            :dot-color="blue"
            size="small"
          >
            <template v-slot:opposite>
              <div
                :class="`pt-1 headline font-weight-bold text-grey`"
                v-text="next.date"
              ></div>
            </template>
            <div>
              <a v-bind:href="next.href" target="_blank"
                ><h2 :class="`mt-n1 headline font-weight-light mb-4 text-blue`">
                  {{ next.title }}
                </h2></a
              >
              <div :class="`text-grey`" v-text="next.extract"></div>
            </div>
          </v-timeline-item>
        </v-timeline>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import axios from "axios";
export default {
  name: "HomePage",

  data: () => ({
    newsLinks: [
      {
        title:
          "CoinCodeCap: A YouTube Channel Hacked and Renamed to Tesla to Stream Crypto Scam",
        href: "https://coincodecap.com/a-youtube-channel-hacked-and-renamed-to-tesla-to-stream-crypto-scam",
        date: "22 April 2022",
        extract:
          "According to him the hacker changed the channel name to “Tesla” and streamed some crypto scam for about 6 hours.",
      },
      {
        title:
          "Independant: A YouTube Channel Hacked and Renamed to Tesla to Stream Crypto Scam",
        href: "https://www.independent.co.uk/tech/youtube-bitcoin-giveaway-scam-elon-musk-ethereum-b2048425.html",
        date: "1 April 2022",
        extract:
          "Videos promoting fake cryptocurrency giveaways have been attracting tens of thousands of live views on YouTube.",
      },
      {
        title: "FullyCrypto: Beware the YouTube Live Stream Crypto Scam",
        href: "https://fullycrypto.com/beware-the-youtube-live-stream-crypto-scam",
        date: "30 December 2021",
        extract:
          "Crypto scammers are still trying to steal your money through fake YouTube giveaways",
      },
      {
        title: "BBC: Apple co-founder sues YouTube over Bitcoin scam",
        href: "https://www.bbc.co.uk/news/technology-53512569",
        date: "23 July 2020",
        extract:
          'In response YouTube\'s owner Google said that it took abuse "seriously" and took action quickly on scams.',
      },
    ],
    liveStreamCount: "Loading",
    domainCount: "Loading",
    walletCount: "Loading",
    btcTotalReceived: "Loading",
    ethTotalBalance: "Loading",
  }),
  mounted() {
    axios
      .get(process.env.VUE_APP_ENDPOINT + "/streams")
      .then((response) => {
        this.liveStreamCount = Object.keys(response.data).length;
      });
    axios
      .get(process.env.VUE_APP_ENDPOINT + "/domains")
      .then((response) => {
        this.domainCount = Object.keys(response.data).length;
      });
    axios.get(process.env.VUE_APP_ENDPOINT + "/wallets").then((response) => {
      this.walletCount = 0
      this.btcTotalReceived = 0
      for (let address in response.data.btc) {
        this.btcTotalReceived += parseFloat(response.data.btc[address].received)
        this.walletCount++
      }
      this.ethTotalBalance = 0
      for (let address in response.data.eth) {
        this.ethTotalBalance += parseFloat(response.data.eth[address].balance)
        this.walletCount++
      }
    });
  },
  methods : {
    googleConvertLink(ammount, from){
      return "https://www.google.com/search?q=" + ammount + " " + from + " in USD";
    }
  },
};
</script>

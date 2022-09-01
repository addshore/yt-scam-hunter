<template>
  <v-container>
    <div id="app">
      <!-- Create a table for btc data -->
      <h2 class="headline font-weight-bold mb-5">Streams</h2>
      <p>Many live streams run on YouTube trying to scam people out of money.</p>
      <p><strong>This page no longer updates</strong>, but I expect you can find some scam streams <a href="https://www.youtube.com/results?search_query=ETH+BTC&sp=EgJAAQ%253D%253D">here</a></p>
    </div>
  </v-container>
</template>

<script>
import axios from "axios";
const agoImport = require('s-ago');

const ago = (date) => {
  // Simple escaping as this HTML is parsed
  return new Option(agoImport(date)).innerHTML;
}

export default {
  name: "StreamsPage",
  data: () => ({
    streams: null,
  }),
  mounted() {
    axios
      .get(process.env.VUE_APP_ENDPOINT + "/streams")
      .then((response) => {
        this.streams = response.data;
        // for each key in object
        for (let key in this.streams) {
          let detailsJsonFile = this.streams[key].files.details;
          axios.get(detailsJsonFile).then((response) => {
            this.streams[key].details = response.data;
          });
        }
      });
  },
  computed: {
    count() {
      if (this.streams === null) {
        return "Loading...";
      }
      return Object.keys(this.streams).length;
    },
      cards() {
        const streams = this.streams
        let cards = []
        for (let key in streams) {
          let stream = streams[key]
          let card = {
            title: key,
            link: stream.url,
            image: stream.files.snapshot,
            details: {
              title: {
                name: "Title",
                value: stream.details ? stream.details.videoDetails.title : "Unknown",
              },
              channel: {
                name: "Channel",
                value: stream.details ? stream.details.videoDetails.author.name + " (" + stream.details.videoDetails.author.user + ")" : "Unknown",
                link: stream.details ? stream.details.videoDetails.ownerProfileUrl : null,
              },
              times: {
                name: "When",
                html: "Stream started <strong>" + ( stream.details ? ago( new Date( stream.details.videoDetails.liveBroadcastDetails.startTimestamp ) ) : "???") +
                "</strong>, first seen <strong>" + ago( new Date( stream.times.firstSeen )) +
                "</strong>, detected scam <strong>" + ago( new Date( stream.times.badDetected )) +
                "</strong>, last seen <strong>" + ago( new Date( stream.times.lastSeen )) + "</strong>",
              },
              doamins: {
                name: "Websites",
                list: ((domains) => {
                  let bits = []
                  for (let domain in domains) {
                    bits.push({
                      text: domain,
                      link: "https://" + domain,
                    })
                  }
                  return bits
                })(stream.domains)
              },
              wallets: {
                name: "Wallets",
                list: ((wallets) => {
                  let bits = []
                  for (let wallet in wallets.btc) {
                    bits.push({
                      text: wallet,
                      link: "https://blockchain.info/address/" + wallet,
                    })
                  }
                  for (let wallet in wallets.eth) {
                    bits.push({
                      text: wallet,
                      link: "https://etherscan.io/address/" + wallet,
                    })
                  }
                  return bits
                })(stream.wallets)
            },
            artifacts: {
              name: "Artifacts",
              list: [
                {
                  text: "Frame",
                  link: stream.files.snapshot,
                },
                {
                  text: "Details",
                  link: stream.files.details,
                },
                {
                  text: "Text",
                  link: stream.files.text,
                },
                {
                  text: "Advanced Text",
                  link: stream.files['text-vision'],
                },
                {
                  text: "Report",
                  link: stream.files.report,
                },
              ]
            },
          }
          }
          cards.push(card)
        }
        return cards
      },
    },
};
</script>

<style scoped>

.warning {
  padding-top: 5px;
  padding-bottom: 10px;
}

.v-card-title {
  padding-top: 20px;
}

.v-card-text {
  line-height: 175%;
}

</style>
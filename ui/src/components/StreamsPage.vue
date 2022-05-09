<template>
  <v-container>
    <div id="app">
      <!-- Create a table for btc data -->
      <h2 class="headline font-weight-bold mb-5">Streams</h2>
      <p>Many live streams are currently running on YouTube trying to scam people out of money.</p>
      <p>Currently tracking <strong>{{count}}</strong> live streams</p>
      <p>This page should update hourly</p>
      <p><small><v-icon icon="mdi-alert" color="red"/>These videos are all scams, don't do what they say!</small></p>
      <v-divider></v-divider>
      <v-progress-circular
        v-if="streams === null"
        indeterminate
        color="primary"
      ></v-progress-circular>
    <v-container fluid>
      <v-row dense>
        <v-col
        v-for="card in cards"
        :key="card.id"
        :cols="6" >

        <v-card>
            <v-img
                height="250px"
                v-bind:src="card.image"
                cover
              >
              </v-img>

            <v-card-title>
              <a v-bind:href="card.link" target="_blank">{{ card.title }}</a>
            </v-card-title>

            <v-card-text class="text--primary">

            <div v-for="detail in card.details" v-bind:key="detail.name" >
              <strong>{{detail.name}}: </strong>
              <span v-if="detail.html && !detail.link" v-html="detail.html"></span>
              <span v-if="detail.value && !detail.link">{{detail.value}}</span>
              <a v-if="detail.value && detail.link" v-bind:href="detail.link" target="_blank" rel="nofollow">{{detail.value}}</a>
              <span v-if="detail.chips">
                <template v-for="chip in detail.chips" v-bind:key="chip">
                  <v-chip v-if="!chip.link">{{chip.text}}</v-chip>
                  <a v-if="chip.link" v-bind:href="chip.link" target="_blank" rel="nofollow"><v-chip>{{chip.text}}</v-chip></a>
                </template>
              </span>
            </div>
            </v-card-text>
        </v-card>
        </v-col>
        </v-row>
      </v-container>
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
                chips: ((domains) => {
                  let chips = []
                  for (let domain in domains) {
                    chips.push({
                      text: domain,
                      link: "https://" + domain,
                    })
                  }
                  return chips
                })(stream.domains)
              },
              wallets: {
                name: "Wallets",
                chips: ((wallets) => {
                  let chips = []
                  for (let wallet in wallets.btc) {
                    chips.push({
                      text: wallet,
                      link: "https://blockchain.info/address/" + wallet,
                    })
                  }
                  for (let wallet in wallets.eth) {
                    chips.push({
                      text: wallet,
                      link: "https://etherscan.io/address/" + wallet,
                    })
                  }
                  return chips
                })(stream.wallets)
            },
            artifacts: {
              name: "Artifacts",
              chips: [
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

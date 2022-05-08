<template>
  <v-container>
    <div id="app">
      <!-- Create a table for btc data -->
      <h2 class="headline font-weight-bold mb-5">Streams</h2>
      <strong>Currently live and detected streams</strong>
      <p>Historical stream data will come soon...</p>
      <strong v-if="streams === null">Loading...</strong>
      <v-spacer></v-spacer>
      <ul>
        <template v-for="(item, id) in streams" :key="id">
          <v-card>
            <v-img
                class="white--text align-end"
                height="200px"
                v-bind:src="item.files.snapshot"
              >
              </v-img
            >

            <v-card-title>
              <a v-bind:href="item.url" target="_blank">{{ id }}</a>
            </v-card-title>

            <v-card-text class="text--primary">
              <div v-if="item.details">
                <strong>Video Details</strong>
                <div>Title: {{ item.details.videoDetails.title }}</div>
                <div>Channel: <a v-bind:href="item.details.videoDetails.ownerProfileUrl" target="_blank">{{ item.details.videoDetails.author.name }} ( {{item.details.videoDetails.author.user}} )</a></div>
                <div>Broadcast Start: {{ item.details.videoDetails.liveBroadcastDetails.startTimestamp }}</div>
              </div>
              <strong>Times</strong>
              <div>First seen: {{item.times.firstSeen}}</div>
              <div>Bad detected: {{item.times.badDetected}}</div>
              <strong>Domains & Wallets</strong>
              <ul>
                <template v-for="(item, domain) in item.domains" :key="domain">
                  <li><a :href="item.url" target="_blank">{{ domain }}</a></li>
                </template>
                <template v-for="(item, address) in item.wallets.btc" :key="address">
                  <li><a :href="item.info" target="_blank">{{ address }}</a></li>
                </template>
                <template v-for="(item, address) in item.wallets.eth" :key="address">
                  <li><a :href="item.info" target="_blank">{{ address }}</a></li>
                </template>
              </ul>
              <strong>Artifacts: </strong>
                <template v-for="(file, fileName) in item.files" :key="fileName">
                  <a v-bind:href=file target="_blank" >{{ fileName }}</a>, 
                </template>
            </v-card-text>
          </v-card>
          <v-separator></v-separator>
        </template>
      </ul>
    </div>
  </v-container>
</template>

<script>
import axios from "axios";
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
};
</script>

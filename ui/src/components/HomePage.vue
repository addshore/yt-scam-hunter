<template>
  <v-container>
    <v-row>
      <v-col class="mb-5" cols="12">
        <h2 class="headline font-weight-bold mb-5">Home</h2>
        <p>This website tracks the live crypto scams that happen on YouTube every day.</p>
        <p>Crypto scams have existed on YouTube for the last few years. </p>
        <p>They havn't changed much, but YouTube has really failed to tackle them.</p>
        <p>YouTube should probably do something about this...</p>
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

        <!-- <v-row justify="center">
          <p v-for="(next, i) in newsLinks" :key="i" :href="next.href">
            {{ next.date }},<a class="subheading mx-3" target="_blank">
              {{ next.text }}
            </a>
          </p>
        </v-row> -->
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
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
  }),
};
</script>

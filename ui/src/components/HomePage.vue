<template>
  <v-container>
    <v-row class="text-center">
      <v-col class="mb-4">
        <h1 class="display-2 font-weight-bold mb-3">
          YouTube Scam Hunter
        </h1>
      </v-col>

      <v-col class="mb-4" cols="12">
            <p class="headline">
              A web application presenting some data on current YouTube crypto scams.
            </p>
      </v-col>

      <v-col
        class="mb-5"
        cols="12"
      >
        <h2 class="headline font-weight-bold mb-5">
          Links
        </h2>

        <v-row justify="center">
          <a
            v-for="(next, i) in links"
            :key="i"
            :href="next.href"
            class="subheading mx-3"
            target="_blank"
          >
            {{ next.text }}
          </a>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

export default {
  name: 'HomePage',

  data: () => ({
    links: [
      {
        text: 'Twitter',
        href: 'https://twitter.com/addshore',
      },
      {
        text: 'Github',
        href: 'https://github.com/addshore/yt-scam-hunter',
      },
    ],
  }),
}
</script>

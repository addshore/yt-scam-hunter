const functions = require("firebase-functions");
const pubsub = require("./src/pubsub");
const ytsr = require("ytsr");

const searchRequestTopic = "search-request";
const streamSeenTopic = "stream-seen";

const RUN_WITH = {
  // Searches can take some time, so 15 seconds?
  timeoutSeconds: 15,
  memory: "512MB",
};

exports.onPublish = functions
    .runWith(RUN_WITH)
    .pubsub.topic(searchRequestTopic)
    .onPublish(async () => {
      await searchAndPublishVideoSeenMessages();
    });

exports.onCall = functions
    .runWith(RUN_WITH)
    .https
    .onCall(async () => {
      await searchAndPublishVideoSeenMessages();
    });

/**
 * Search for streams using the search string. Publish messages for each stream found.
 * @param {string} searchString
 * @param {number} limit
 */
async function searchAndPublishVideoSeenMessages(searchString = "\"eth\" OR \"btc\"", limit = 250) {
  const filters1 = await ytsr.getFilters(searchString);
  const filter1 = filters1.get("Type").get("Video");
  const filters2 = await ytsr.getFilters(filter1.url);
  const filter2 = filters2.get("Features").get("Live");
  const ytOptions = {
    pages: 10,
  };

  // create an array to store ALL the results as we paginate
  let results = [];
  let result = await ytsr(filter2.url, ytOptions);
  results.push(...result.items);
  while (result.continuation !== null) {
    result = await ytsr.continueReq(result.continuation);
    results.push(...result.items);
  }

  // Slice results per the limit
  results = results.slice(0, limit);

  for (let i = 0; i < results.length; i++) {
    const video = results[i];
    await pubsub.messageWithCreate(streamSeenTopic, {
      id: video.id,
      url: video.url,
    });
  }
}

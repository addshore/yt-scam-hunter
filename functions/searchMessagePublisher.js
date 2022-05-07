const functions = require("firebase-functions");
const pubsub = require("./src/pubsub");

const TOPIC_SEARCH_REQUEST = "search-request";

const RUN_WITH = {
  // Should just be emiting a message, so 5 seconds
  timeoutSeconds: 5,
  memory: "128MB",
};

exports.onSchedule = functions
    .runWith(RUN_WITH)
    .pubsub.schedule("every 1 hours") // TODO make this come from an env var
    .onRun(async () => {
      await publishMessage();
    });

exports.onCall = functions
    .runWith(RUN_WITH)
    .https
    .onCall(async () => {
      await publishMessage();
    });

async function publishMessage() {
  await pubsub.messageWithCreate(TOPIC_SEARCH_REQUEST, {});
}

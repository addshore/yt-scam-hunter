const functions = require("firebase-functions");
const pubsub = require("./src/pubsub");

const searchRequestTopic = "search-request";

const RUN_WITH = {
  // Should just be emiting a message, so 5 seconds
  timeoutSeconds: 5,
  memory: "128MB",
};

exports.onSchedule = functions
    .runWith(RUN_WITH)
    .pubsub.schedule("every 1 hours") // TODO make this come from an env var
    .onRun(async () => {
      publishMessage();
    });

exports.onCall = functions
    .runWith(RUN_WITH)
    .https
    .onCall(async () => {
      publishMessage();
    });

async function publishMessage() {
  await pubsub.messageWithCreate(searchRequestTopic, {});
}

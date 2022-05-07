const functions = require("firebase-functions");
const {initializeApp} = require("firebase-admin/app");
initializeApp();

const http = require("./http");
const badStreamMessageSubscription = require("./badStreamMessageSubscription");
const badDomainMessageSubscription = require("./badDomainMessageSubscription");
const searchMessagePublisher = require("./searchMessagePublisher");
const searchMessageSubscription = require("./searchMessageSubscription");
const streamSeenMessageSubscription = require("./streamSeenMessageSubscription");
const cleanup = require("./cleanup");

// ////////////////////////
// HTTP Cloud Function
// ////////////////////////

exports.streams = http.getCurrentBadStreams;
exports.domains = http.getDomains;
exports.wallets = http.getWallets;

// ////////////////////////
// Callable Cloud Function
// ////////////////////////

exports.callCurrentBadStreams = http.callCurrentBadStreams;
exports.callGetDomains = http.callDomains;
exports.callGetWallets = http.callWallets;

exports.callSearchMessagePublisher = searchMessagePublisher.onCall;
exports.callSearchMessageSubscription = searchMessageSubscription.onCall;
exports.callStreamSeenMessageSubscription = streamSeenMessageSubscription.onCall;
exports.callCleanup = cleanup.onCall;
exports.callCleanupSingle = cleanup.onCallSingle;
exports.callBadStreamMessagePublish = badStreamMessageSubscription.onCall;
exports.callBadDomainMessagePublish = badDomainMessageSubscription.onCall;

// ////////////////////////
// Scheduled Cloud Function
// ////////////////////////

exports.scheduleSearchMessagePublisher = searchMessagePublisher.onSchedule;
exports.scheduleCleanup = cleanup.onSchedule;

// ////////////////////////
// PubSub subscriptions
// ////////////////////////

exports.onSearchMessagePublish = searchMessageSubscription.onPublish;
exports.onStreamSeenMessagePublish = streamSeenMessageSubscription.onPublish;
exports.onBadStreamMessagePublish = badStreamMessageSubscription.onPublish;
exports.onBadDomainMessagePublish = badDomainMessageSubscription.onPublish;

// ////////////////////////
// Event Cloud Function
// ////////////////////////

exports.suspectStreamsOnUpdateCheckIfWeCanDelete = cleanup.onUpdateCheckIfWeCanDelete;
exports.suspectStreamsOnDelete = cleanup.onDeleteAlsoRemoveArtifacts;

const pubsub = require("./src/pubsub");
const {getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();
const collection = db.collection("suspectStreams");
const TOPIC_BAD_STREAM = "bad-stream";
exports.hack = functions.https.onCall(async (data, context) => {
  const allBadStreams = await collection.where("badDetected", "!=", null).get();
  functions.logger.info("got bad streams", allBadStreams.docs.length);
  for (let i = 0; i < allBadStreams.docs.length; i++) {
    const streamData = allBadStreams.docs[i].data();
    await pubsub.messageWithCreate(TOPIC_BAD_STREAM, {id: streamData.id, url: streamData.url});
  }
});

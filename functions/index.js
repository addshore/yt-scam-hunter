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

exports.currentBadStreams = http.getCurrentBad;

// ////////////////////////
// Callable Cloud Function
// ////////////////////////

exports.callCurrentBad = http.callCurrentBad;
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

const {getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();
const collection = db.collection("suspectStreams");
exports.hack = functions.https.onCall(async (data, context) => {
  const allStreams = await collection.where("id", "!=", "NON_EXISTING_ID").get();
  functions.logger.info("got streams", allStreams.docs.length);
  for (let i = 0; i < allStreams.docs.length; i++) {
    const streamData = allStreams.docs[i].data();
    const updates = {};
    functions.logger.info("old data", {oldData: streamData});
    if (typeof streamData.firstSeen === "string") {
      updates.firstSeen = new Date(streamData.firstSeen);
    }
    if (typeof streamData.lastScanned === "string") {
      updates.lastScanned = new Date(streamData.lastScanned);
    }
    if (typeof streamData.lastSeen === "string") {
      updates.lastSeen = new Date(streamData.lastSeen);
    }
    if (typeof streamData.badDetected === "string") {
      updates.badDetected = new Date(streamData.badDetected);
    }
    functions.logger.info("new data", {updates: updates});

    if (Object.keys(updates).length > 0) {
      functions.logger.info("updating", {id: streamData.id});
      await collection.doc(allStreams.docs[i].id).update(updates);
    } else {
      functions.logger.info("no updates", {id: streamData.id});
    }
  }
});

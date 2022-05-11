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

// Global fetch so that fetch-mock is easier to use for tests
require("./src/fetch-polyfill");

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
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const db = getFirestore();
const collectionOfDomains = db.collection("domains");
const TOPIC_BAD_DOMAIN = "bad-domain";

exports.hack = functions.https.onCall(async (data, context) => {
  const liveDomains = [data.domain];

  const domainsDoc = collectionOfDomains.doc("all");
  if (! (await domainsDoc.get() ).exists ) {
    functions.logger.info("Creating new domains doc");
    await domainsDoc.set({
      domains: liveDomains,
    });
  } else {
    await domainsDoc.update({
      domains: FieldValue.arrayUnion(...liveDomains),
    });
  }

  // Publish messages about domains
  for (let i = 0; i < liveDomains.length; i++) {
    const domain = liveDomains[i];
    // Send a message to the bad-stream topic
    await pubsub.messageWithCreate(TOPIC_BAD_DOMAIN, {domain: domain});
  }
});

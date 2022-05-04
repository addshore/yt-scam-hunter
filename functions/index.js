const {initializeApp} = require("firebase-admin/app");
initializeApp();

const http = require("./http");
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

exports.callSearchMessagePublisher = searchMessagePublisher.onCall;
exports.callSearchMessageSubscription = searchMessageSubscription.onCall;
exports.callStreamSeenMessageSubscription = streamSeenMessageSubscription.onCall;
exports.callCleanup = cleanup.onCall;

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

// ////////////////////////
// Event Cloud Function
// ////////////////////////

exports.suspectStreamsOnUpdateCheckIfWeCanDelete = cleanup.onUpdateCheckIfWeCanDelete;
exports.suspectStreamsOnDelete = cleanup.onDeleteAlsoRemoveArtifacts;

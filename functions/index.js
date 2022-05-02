const {initializeApp} = require("firebase-admin/app");
initializeApp();

const suspectStreams = require("./suspectStreams");

// ////////////////////////
// HTTP Cloud Function
// ////////////////////////

exports.suspectStreamsGetBad = suspectStreams.getBad;

// ////////////////////////
// Callable Cloud Function
// ////////////////////////

// Testable from within the `firebase functions:shell`
// suspectStreamsGenerateCallable({})
exports.suspectStreamsGenerateCallable = suspectStreams.generateCallable;
// Checks an existing videoId to see if it is bad
// suspectStreamsCheckOneNowCallable({videoId: "someVideoId"})
exports.suspectStreamsCheckOneNowCallable = suspectStreams.checkOneNowCallable;

// ////////////////////////
// Scheduled Cloud Function
// ////////////////////////

exports.suspectStreamsGenerateSchedule = suspectStreams.generateSchedule;
exports.suspectStreamsMarkNonLive = suspectStreams.markNonLive;

// ////////////////////////
// Event Cloud Function
// ////////////////////////

exports.suspectStreamsOnCreate = suspectStreams.onCreate;
exports.suspectStreamsOnUpdate = suspectStreams.onUpdate;
exports.suspectStreamsOnDelete = suspectStreams.onDelete;

exports.cleanupStoredFilesCallable = suspectStreams.cleanupStoredFilesCallable;
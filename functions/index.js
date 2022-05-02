const {initializeApp} = require("firebase-admin/app");
initializeApp();

const suspectStreams = require("./suspectStreams");

// HTTP Cloud Function
exports.suspectStreamsGetBad = suspectStreams.getBad;

// Callable Cloud Function
exports.suspectStreamsGenerateCallable = suspectStreams.generateCallable;
exports.suspectStreamsCheckNow = suspectStreams.checkNow;

// Scheduled Cloud Function
exports.suspectStreamsGenerateSchedule = suspectStreams.generateSchedule;
exports.suspectStreamsMarkNonLive = suspectStreams.markNonLive;

// Event Cloud Function
exports.suspectStreamsOnCreate = suspectStreams.onCreate;
exports.suspectStreamsOnUpdate = suspectStreams.onUpdate;
exports.suspectStreamsOnDelete = suspectStreams.onDelete;

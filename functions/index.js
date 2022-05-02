const {initializeApp} = require("firebase-admin/app");
initializeApp();

const hello = require("./hello");
const suspectStreams = require("./suspectStreams");

exports.hello = hello.hello;
exports.suspectStreamsGenerateSchedule = suspectStreams.generateSchedule;
exports.suspectStreamsGenerateCallable = suspectStreams.generateCallable;
exports.suspectStreamsGetBad = suspectStreams.getBad;
exports.suspectStreamsCleanupNonLive = suspectStreams.cleanupNonLive;
exports.suspectStreamsOnCreate = suspectStreams.onCreate;
exports.suspectStreamsOnUpdate = suspectStreams.onUpdate;
exports.suspectStreamsOnDelete = suspectStreams.onDelete;

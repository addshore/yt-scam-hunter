const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
initializeApp();

const hello = require('./hello');
const suspectStreams = require('./suspectStreams');

exports.hello = hello.hello
exports.suspectStreamsSchedule = suspectStreams.schedule
exports.suspectStreamsGenerate = suspectStreams.generate
exports.suspectStreamsOnCreate = suspectStreams.onCreate
exports.suspectStreamsOnUpdate = suspectStreams.onUpdate
exports.suspectStreamsOnDelete = suspectStreams.onDelete
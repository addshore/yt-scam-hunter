const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
initializeApp();

const hello = require('./hello');
const suspectStreams = require('./suspectStreams');

exports.hello = hello.hello
exports.suspectStreamsGenerate = suspectStreams.suspectStreamsGenerate
exports.suspectStreamsOnWrite = suspectStreams.suspectStreamsOnWrite
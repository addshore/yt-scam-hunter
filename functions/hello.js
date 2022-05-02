const functions = require("firebase-functions");

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.hello = functions.https.onRequest(async (request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  // Cache on clients for 5 mins, in CDN for 10 mins
  response.set("Cache-Control", "public, max-age=300, s-maxage=600");
  response.send("Hello from Firebase!");
});

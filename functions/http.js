const functions = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");
const db = getFirestore();
const collection = db.collection("suspectStreams");
const storage = require("./src/storage");
const youtube = require("./src/youtube");

const RUN_WITH = {
  timeoutSeconds: 15,
  memory: "256MB",
};

exports.getCurrentBad = functions.runWith(RUN_WITH).https.onRequest( async (request, response) => {
  getCurrentBad(function(data) {
    // Cache on clients for 5 mins, in CDN for 10 mins
    response.set("Cache-Control", "public, max-age=300, s-maxage=600");
    response.send(data);
  });
});
exports.callCurrentBad = functions.runWith(RUN_WITH).https.onCall( async (data, context) => {
  getCurrentBad(function(data) {
    functions.logger.info("Current bad streams", {data: data});
  });
});

async function getCurrentBad(callback) {
  const badStreams = await collection.where("status", "==", youtube.STATUS_LIVE).where("badDetected", "!=", null).get();
  const badStreamsData = {};
  for (let i = 0; i < badStreams.size; i++) {
    const data = badStreams.docs[i].data();

    const badDate = data.badDetected.toDate();

    badStreamsData[data.id] = {
      id: data.id,
      url: data.url,
      times: {
        firstSeen: data.firstSeen.toDate().toISOString(),
        badDetected: badDate.toISOString(),
        // notLiveSince was only added for entries since 06/05/2022 ish
        notLiveSince: data.notLiveSince ? data.notLiveSince.toDate().toISOString() : undefined,
      },
      files: {
        "details": storage.videoFile(data.id, "video.json").publicUrl(),
        "snapshot": storage.videoFile(data.id, "snapshot.jpg", badDate).publicUrl(),
        "text": storage.videoFile(data.id, "text.txt", badDate).publicUrl(),
        // text-vision is defined after bad streams are detected, so it may not exist?
        "text-vision": storage.videoFile(data.id, "text-vision.txt", badDate).isPublic() ? storage.videoFile(data.id, "text-vision.txt", badDate).publicUrl() : undefined,
        "report": storage.videoFile(data.id, "report.txt", badDate).publicUrl(),
      },
    };
  }
  callback(badStreamsData);
}

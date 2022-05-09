const functions = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");
const youtube = require("./src/youtube");
const storage = require("./src/storage");

const db = getFirestore();
const collection = db.collection("suspectStreams");
const ONE_HOUR = 60 * 60 * 1000;

// How often to cleanup videos that are no longer live
const cleanupSchedule = "every 1 hours";
// How often to check if a video is still live
const cleanupCheckHours = 2;

const RUN_WITH = {
  timeoutSeconds: 60 * 3,
  memory: "256MB",
};

exports.onSchedule = functions
    .runWith(RUN_WITH)
    .pubsub.schedule(cleanupSchedule)
    .onRun(async () => {
      await checkAndUpdateStreamsStatusIfNotLive();
    });

exports.onCall = functions
    .runWith(RUN_WITH)
    .https
    .onCall(async () => {
      await checkAndUpdateStreamsStatusIfNotLive();
    });

exports.onCallSingle = functions
    .runWith(RUN_WITH)
    .https
    .onCall(async (data, context) => {
      await checkAndUpdateStreamStatusIfNotLive(data.id);
    });

async function checkAndUpdateStreamsStatusIfNotLive() {
  const now = new Date();
  const someHoursAgo = new Date(now.getTime() - (cleanupCheckHours * ONE_HOUR));

  // Look for things we think are live, but that we havn't seen in 3 hours
  const liveStreams = await collection.where("status", "==", youtube.STATUS_LIVE).where("lastSeen", "<=", someHoursAgo).orderBy("lastSeen", "ASC").get();
  functions.logger.info("Found " + liveStreams.size + " live streams that haven't been seen in " + cleanupCheckHours + " hours");
  // Iterate through live streams
  for (let i = 0; i < liveStreams.size; i++) {
    await checkAndUpdateStreamStatusIfNotLive(liveStreams.docs[i].id);
  }
}

async function checkAndUpdateStreamStatusIfNotLive(videoId) {
  const url = youtube.urlFromId(videoId);
  const {status: currentStatus} = await youtube.basicInfoAndStatus(url);
  if (currentStatus != youtube.STATUS_LIVE) {
    // Stream is not live anymore
    functions.logger.info("Stream is not live anymore: " + url + " : " + currentStatus);
    await collection.doc(videoId).update({
      status: currentStatus,
      notLiveSince: new Date(),
    });
  } else {
    functions.logger.info("Stream is still live: " + url + " : " + currentStatus);
  }
  return currentStatus;
}

exports.onUpdateCheckIfWeCanDelete = functions.firestore
    .document("suspectStreams/{videoId}")
    .onUpdate(async (change, context) => {
      const videoId = context.params.videoId;
      const newValue = change.after.data();
      // If not live, and not bad, we can delete it
      if (
        newValue.status != youtube.STATUS_LIVE && // If not live
        newValue.badDetected == undefined // And not marked as bad
      ) {
        functions.logger.info("Video not live, and not marked as bad, cleaning up: " + videoId, {videoId: videoId});
        await change.after.ref.delete();
      }
    });

exports.onDeleteAlsoRemoveArtifacts = functions.firestore
    .document("suspectStreams/{videoId}")
    .onDelete(async (snapshot, context) => {
      const videoId = context.params.videoId;
      functions.logger.info("Video deleted, cleaning up: " + videoId, {videoId: videoId});
      await storage.deleteVideoArtifacts(videoId);
    });

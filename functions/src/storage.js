const {Storage} = require("@google-cloud/storage");

const bucketName = "scam-hunter.appspot.com";
const storage = new Storage();
const bucket = storage.bucket(bucketName);

exports.storage = storage;
exports.bucketName = bucketName;

/**
 * @param {string} videoId
 * @param {string} fileName
 * @param {Date} checkTime
 * @returns File
 */
function videoFile(videoId, fileName, checkTime) {
  return storage.bucket(bucketName).file(videoFileName(videoId, fileName, checkTime));
}

/**
 * @param {string} videoId
 * @param {string} fileName
 * @param {Date} checkTime
 * @returns string
 */
function videoFileName(videoId, fileName, checkTime) {
  if (checkTime != null) {
    return videoId + "/" + checkTime.toISOString() + "_" + fileName;
  }
  return videoId + "/" + fileName;
}

async function writeVideoArtifacts(videoId, checkTime, videoJson, reportText, snapshotLocation, extractedText) {
  await videoFile(videoId, "video.json", null).save(JSON.stringify(videoJson, null, 2), {public: true});
  await videoFile(videoId, "report.txt", checkTime).save(reportText, {public: true});
  await bucket.upload(snapshotLocation, {
    destination: videoFileName(videoId, "snapshot.jpg", checkTime),
    public: true,
  });
  await videoFile(videoId, "text.txt", checkTime).save(extractedText, {public: true});
}

async function deleteVideoArtifacts(videoId) {
  await bucket.deleteFiles({
    prefix: videoId + "/",
  });
}

exports.videoFile = videoFile;
exports.videoFileName = videoFileName;
exports.writeVideoArtifacts = writeVideoArtifacts;
exports.deleteVideoArtifacts = deleteVideoArtifacts;

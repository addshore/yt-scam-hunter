const {Storage} = require("@google-cloud/storage");
const tmp = require("tmp");
const fs = require("fs");

const bucketName = "scam-hunter.appspot.com";
const storage = new Storage();
const bucket = storage.bucket(bucketName);

exports.storage = storage;
exports.bucketName = bucketName;

async function fileExistsAtPath(path) {
  return await bucket.exists(path);
}

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

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
async function getLocalTempCopyOfFile(file) {
  const tmpFile = tmp.fileSync();
  await file.download({destination: tmpFile.name});
  return tmpFile.name;
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
async function getFileContents(file) {
  const fileName = await getLocalTempCopyOfFile(file);
  const contents = fs.readFileSync(fileName, "utf8");
  fs.unlinkSync(fileName);
  return contents;
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

async function writeVideoVisionTextArtifacts(videoId, checkTime, text) {
  await videoFile(videoId, "text-vision.txt", checkTime).save(text, {public: true});
}

async function deleteVideoArtifacts(videoId) {
  await bucket.deleteFiles({
    prefix: videoId + "/",
  });
}

exports.fileExistsAtPath = fileExistsAtPath;
exports.videoFile = videoFile;
exports.videoFileName = videoFileName;
exports.getLocalTempCopyOfFile = getLocalTempCopyOfFile;
exports.getFileContents = getFileContents;
exports.writeVideoArtifacts = writeVideoArtifacts;
exports.writeVideoVisionTextArtifacts = writeVideoVisionTextArtifacts;
exports.deleteVideoArtifacts = deleteVideoArtifacts;

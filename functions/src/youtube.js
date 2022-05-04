const ytdl = require("ytdl-core");
const fs = require("fs");
const sleep = require("util").promisify(setTimeout);

// Don't allow ytdl to check for updates...
process.env.YTDL_NO_UPDATE = "1";

const STATUS_LIVE = "live";
const STATUS_ENDED = "ended";
const STATUS_OFFLINE = "offline";

exports.STATUS_LIVE = STATUS_LIVE;
exports.STATUS_ENDED = STATUS_ENDED;
exports.STATUS_OFFLINE = STATUS_OFFLINE;

/**
 * @param {string} videoId
 * @returns string
 */
exports.urlFromId = function(videoId) {
  return "https://www.youtube.com/watch?v=" + videoId;
};

/**
 * Gets basic video infomation and stream status from YouTube
 * @param {string} url of the YouTube video
 * @returns object with status and info keys
 * status will be one of STATUS_LIVE, STATUS_ENDED, STATUS_OFFLINE, or a string status some other unknown error status
 */
exports.basicInfoAndStatus = async function(url) {
  try {
    const info = await ytdl.getBasicInfo(url);
    // isLiveContent doesnt refer to live as in a live stream, instead if the content itself is accessible
    if (info.videoDetails.isLiveContent == false) {
      return {status: STATUS_OFFLINE, info: info};
    }
    // isLiveNow refers to the status of a live stream
    if (info.videoDetails.liveBroadcastDetails.isLiveNow == false) {
      return {status: STATUS_ENDED, info: info};
    }
    return {status: STATUS_LIVE, info: info};
  } catch (e) {
    return {status: e.message, info: null};
  }
};

exports.grabShortClip = async function(url, outputFile) {
  let vidFetchFail = false;
  const readableStream = ytdl(url, {
    begin: Date.now(),
  });
  readableStream.on("error", function(err) {
    vidFetchFail = "Video fetch failed at the readableStream stage: " + url + "\n" + err;
  });
  readableStream.pipe(fs.createWriteStream(outputFile));
  // TODO also maybe add a timeout?
  // Wait for the file to exist (or a failure)
  while (vidFetchFail == false && !fs.existsSync(outputFile)) {
    await sleep(50);
  }
  // Wait for the file to get to a certain size (or failure)
  while (vidFetchFail == false && fs.statSync(outputFile).size < 500000) {
    await sleep(50);
  }
  readableStream.destroy();

  if (vidFetchFail) {
    return false;
  }
  return true;
};

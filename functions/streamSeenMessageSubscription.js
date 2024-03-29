const functions = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");
const extractFrame = require("ffmpeg-extract-frame");
const youtube = require("./src/youtube");
const tesseract = require("./src/tesseract");
const storage = require("./src/storage");
const pubsub = require("./src/pubsub");
const tmp = require("tmp");

const db = getFirestore();
const collectionOfStreams = db.collection("suspectStreams");
const collectionOfDomains = db.collection("domains");
const ONE_HOUR = 60 * 60 * 1000;

const TOPIC_STREAM_SEEN = "stream-seen";
const TOPIC_BAD_STREAM = "bad-stream";

// This does lots of processing (video download, frame extraction, and OCR)
const RUN_WITH = {
  timeoutSeconds: 45,
  memory: "4GB",
};

exports.onPublish = functions
    .runWith(RUN_WITH)
    .pubsub.topic(TOPIC_STREAM_SEEN)
    .onPublish(async (message, context) => {
      await checkStream(message.json.id);
    });

exports.onCall = functions
    .runWith(RUN_WITH)
    .https
    .onCall(async (data, context) => {
      await checkStream(data.id);
    });

async function checkStream(videoId) {
  const url = youtube.urlFromId(videoId);
  const checkStartTime = new Date();

  const {info, status: currentStatus} = await youtube.basicInfoAndStatus(url);
  const storedDoc = await collectionOfStreams.doc(videoId).get();

  // If the video is not live at the start of this check, update the record or bail
  if ( currentStatus != youtube.STATUS_LIVE ) {
    functions.logger.info("Video not live: " + videoId, {videoId: videoId, currentStatus: currentStatus});
    if (storedDoc.exists) {
      await collectionOfStreams.doc(videoId).update({status: currentStatus, notLiveSince: checkStartTime});
    }
    return;
  }

  // If a doc already exists for the video, do some checks, we might be able to not bother checking now...
  if (storedDoc.exists) {
    const storedData = storedDoc.data();

    if (currentStatus != youtube.STATUS_LIVE) {
      functions.logger.info("Video no longer live: " + videoId, {videoId: videoId});
      await collectionOfStreams.doc(videoId).update({lastSeen: new Date()});
    }

    // If the video is already marked as bad, just store the fact that we have seen it again
    if (storedData.badDetected != undefined) {
      functions.logger.info("Video already marked as bad: " + videoId, {videoId: videoId});
      await collectionOfStreams.doc(videoId).update({lastSeen: new Date()});
      return;
    }

    // If we have seen this video before, and it has been scanned more than 12 times, we don't need to scan it again
    if (storedData.scanned >= 12) {
      functions.logger.info("Video already scanned 12 times: " + videoId, {videoId: videoId});
      return;
    }

    // Only scan videos every 2 hours
    // TODO make the 2 configurable somehow
    if (storedData.lastScanned != undefined && (new Date) - storedData.lastScanned.toDate() < 2 * ONE_HOUR ) {
      functions.logger.info("Video already scanned recently: " + videoId, {videoId: videoId});
      return;
    }
  } else {
    functions.logger.info("No document stored for video yet: " + videoId, {videoId: videoId});
  }

  // Grab a snippet of the stream
  functions.logger.info("Fetching video snippet: " + videoId, {videoId: videoId});
  const outputVideo = tmp.tmpNameSync() + ".mp4";
  const clipSuccess = await youtube.grabShortClip(url, outputVideo);
  if (!clipSuccess) {
    functions.logger.error("Failed to download video: " + videoId, {videoId: videoId});
    return;
  }

  // Grab the first frame of the stream
  functions.logger.info("Grabbing frame: " + videoId, {videoId: videoId});
  const outputSnap = tmp.tmpNameSync() + ".jpg";
  await extractFrame({
    input: outputVideo,
    output: outputSnap,
    offset: 0, // seek offset in milliseconds
  });

  // Extract text from the frame
  functions.logger.info("Recognizing text: " + videoId, {videoId: videoId});
  const extractedText = await tesseract.textFromImageAWSCode(outputSnap);

  // Check the text for things that indicate a bad stream
  functions.logger.info("Looking for bad stuff in text: " + videoId, {videoId: videoId});
  const badThings = await badThingsInText(extractedText);

  // If nothing bad, just update the document
  if (badThings.length == 0) {
    if (storedDoc.exists) {
      await collectionOfStreams.doc(videoId).update({
        lastSeen: checkStartTime,
        lastScanned: checkStartTime,
        scanned: storedDoc.data().scanned + 1,
      });
    } else {
      await collectionOfStreams.doc(videoId).set({
        firstSeen: checkStartTime,
        lastSeen: checkStartTime,
        lastScanned: checkStartTime,
        scanned: 1,
        id: videoId,
        url: url,
        status: currentStatus,
      });
    }
    return;
  }

  // We found bad stuff! Write artifacts & document
  functions.logger.info("Bad stuff found! " + videoId, {videoId: videoId, badThings: badThings});
  await storage.writeVideoArtifacts(videoId, checkStartTime, info, badThings.join("\n"), outputSnap, extractedText);
  if (storedDoc.exists) {
    await collectionOfStreams.doc(videoId).update({
      lastSeen: checkStartTime,
      lastScanned: checkStartTime,
      badDetected: checkStartTime,
      scanned: storedDoc.data().scanned + 1,
    });
  } else {
    await collectionOfStreams.doc(videoId).set({
      firstSeen: checkStartTime,
      lastSeen: checkStartTime,
      lastScanned: checkStartTime,
      badDetected: checkStartTime,
      scanned: 1,
      id: videoId,
      url: url,
      status: currentStatus,
    });
  }

  // Send a message to the bad-stream topic
  await pubsub.messageWithCreate(TOPIC_BAD_STREAM, {id: videoId, url: url});
}

async function getDomains() {
  const hardcodedDomains = [
    "2xmusk.com",
    "2022binance.com",
    "ark-elonmusk.com",
    "ark-x2.gift",
    "btc-invest.info",
    "buterin-eth2022.net",
    "cryptoshelpinghand.com",
    "doublems.org",
    "double-ether.org",
    "elon-2x.org",
    "elon-join.com",
    "ethcrypto.us",
    "ethgift22.info",
    "ethx2.top",
    "eth-claimx2.com",
    "eth-double.info",
    "eth-japan.org",
    "event-ether.net",
    "getx2ether.com",
    "givecrypt.in",
    "givetesla22.com",
    "invest-tesla.org",
    "livex2.tech",
    "msgetx2.net",
    "msgetx2.org",
    "ms2x.io",
    "musk-space.org",
    "musklive.tech",
    "sol2x.info",
    "tesla-join.com",
    "tesla-seo.com",
    "teslagive22.com",
    "teslax-event.com",
    "tesla22.us",
    "x2ether.us",
    "x2musk.io",
    "2xelon.net",
    "2xeth.info",
    "crttesla.com",
    "2xark.com",
  ];

  const domainsDoc = await collectionOfDomains.doc("all").get();
  if (!domainsDoc.exists) {
    return hardcodedDomains;
  }

  let joined = hardcodedDomains.concat(domainsDoc.data().domains);
  joined = [...new Set(joined)];
  return joined;
}

function getRegex() {
  return [
    "Mr\\.? Beast Crypto Charity Stream",
    "double\\syour\\scrypto\\s+SCAN\\sQR[\\s-]CODE",
    "\\d+((\\.|,)\\d+)?\\+? ?(ETH|BTC|SOL|ADA),? ?(to|you)? ?(get|to|get|receive|and),? ?\\d+((\\.|,)\\d+)?\\+? ?(ETH|BTC|SOL|ADA)?",
  ];
}

/**
 * Returns a list of bad things identified in the text
 * @param {string} text to check
 * @returns Array of bad stuff found
 */
async function badThingsInText(text) {
  text = text.toLowerCase();
  const foundBadStuff = [];

  const badDomains = await getDomains();
  for (let i = 0; i < badDomains.length; i++) {
    const badDomain = badDomains[i].toLowerCase();
    if (text.includes(badDomain)) {
      foundBadStuff.push(badDomain);
    }
  }

  const badRegex = getRegex();
  for (let i = 0; i < badRegex.length; i++) {
    const badRegexString = badRegex[i];
    const regex = new RegExp(badRegexString, "i");
    if (text.match(regex)) {
      foundBadStuff.push(badRegexString);
    }
  }

  return foundBadStuff;
}

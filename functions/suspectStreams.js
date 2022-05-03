const functions = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");
const tmp = require("tmp");
const {Storage} = require("@google-cloud/storage");
const vision = require("@google-cloud/vision");
const ytdl = require("ytdl-core");
const fs = require("fs");
const extractFrame = require("ffmpeg-extract-frame");
const sleep = require("util").promisify(setTimeout);
const ytsr = require("ytsr");

const db = getFirestore();
const collection = db.collection("suspectStreams");
const storage = new Storage();
const visionClient = new vision.ImageAnnotatorClient({
  projectId: "scam-hunter",
  keyFilename: "./sa-scam-hunter.json",
});

// //////////////////
// Configuration
// //////////////////
const bucketName = "scam-hunter.appspot.com";
// How often to search for new streams
const scanSchedule = "every 2 hours";
// How often to scan a video if it keeps appearing
const scanFrequencyHours = 3;
// Search string to use to look for videos to scan
const scanSearchString = "\"eth\" OR \"btc\"";
// How often to cleanup videos that are no longer live
const cleanupSchedule = "every 1 hours";
// How often to check if a video is still live
const cleanupCheckHours = 3;

// Constants
const ONE_HOUR = 60 * 60 * 1000;
const STATUS_LIVE = "live";
const STATUS_ENDED = "ended";
const LARGER_RUN_WITH = {
  timeoutSeconds: 60,
  memory: "512MB",
};

// Run every 2 hours to avoid looking at too many videos
// TODO a better solution would be look every 3 hours for videos that are still live? and at ALL new videos hourly?
exports.generateSchedule = functions.pubsub.schedule(scanSchedule).onRun(async (context) => {
  const result = await generateFromSearch(scanSearchString);
  functions.logger.info("Schedueled generateFromSearch ran", result);
});

exports.generateCallable = functions.https.onCall( async (data, context) => {
  return await generateFromSearch(scanSearchString);
});

exports.markNonLive = functions.pubsub.schedule(cleanupSchedule).onRun(async (context) => {
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - (cleanupCheckHours * ONE_HOUR));

  // Look for things we think are live, but that we havn't seen in 3 hours
  const liveStreams = await collection.where("status", "==", STATUS_LIVE).where("lastSeen", "<=", threeHoursAgo).get();
  // Iterate through live streams
  for (let i = 0; i < liveStreams.size; i++) {
    const liveStream = liveStreams.docs[i];
    const currentStatus = await streamStatus(liveStream.data().url);
    if (currentStatus != STATUS_LIVE) {
      // Stream is not live anymore
      functions.logger.info("Stream is not live anymore: " + liveStream.data().url + " : " + currentStatus );
      await collection.doc(liveStream.id).update({
        status: currentStatus,
      });
    }
  }
});

// Gets current live bad videos
exports.getBad = functions.https.onRequest(async (request, response) => {
  const badStreams = await collection.where("status", "==", STATUS_LIVE).where("badDetected", "!=", null).get();
  const badStreamsData = {};
  for (let i = 0; i < badStreams.size; i++) {
    const data = badStreams.docs[i].data();
    badStreamsData[data.id] = {
      url: data.url,
      times: {
        firstSeend: data.firstSeen.toDate().toISOString(),
        badDetected: data.badDetected,
      },
      files: {
        details: bucketFile(data.id, "video.json").publicUrl(),
        snapshot: bucketFile(data.id, "snapshot.jpg", data.badDetected).publicUrl(),
        text: bucketFile(data.id, "text.txt", data.badDetected).publicUrl(),
        report: bucketFile(data.id, "report.txt", data.badDetected).publicUrl(),
      },
    };
  }
  // Cache on clients for 5 mins, in CDN for 10 mins
  response.set("Cache-Control", "public, max-age=300, s-maxage=600");
  response.status(200).send(badStreamsData);
});

exports.checkOneNowCallable = functions.runWith(LARGER_RUN_WITH).https.onCall( async (data, context) => {
  const stream = await collection.doc(data.videoId).get();
  await checkStream(data.videoId, stream.data().scanned || 0);
});

exports.onCreate = functions.runWith(LARGER_RUN_WITH).firestore
    .document("suspectStreams/{videoId}")
    .onCreate(async (snapshot, context) => {
      const videoId = context.params.videoId;
      // Check all videos as they are first seen
      await checkStream(videoId, snapshot.data().scanned || 0);
    });

exports.onUpdate = functions.runWith(LARGER_RUN_WITH).firestore
    .document("suspectStreams/{videoId}")
    .onUpdate(async (change, context) => {
      const videoId = context.params.videoId;
      const newValue = change.after.data();

      // If live, and not already bad, and not already checked in the last 3 hours
      if (
        newValue.status == STATUS_LIVE && // If live
        !newValue.badDetected && // And not already marked as bad
        ( !newValue.lastScanned || (new Date) - newValue.lastScanned > scanFrequencyHours * ONE_HOUR ) // And not already scanned in the last 3 hours
      ) {
        const previousScanCount = newValue.scanned || 0;
        functions.logger.info("Video seen again, and scanned " + previousScanCount + " times, scanning again: " + videoId, {videoId: videoId, previousScanCount: previousScanCount});
        await checkStream(videoId, previousScanCount);
      }

      // If not live, and not bad, we can delete it
      if (
        newValue.status != STATUS_LIVE && // If not live
        !newValue.badDetected// And not marked as bad
      ) {
        functions.logger.info("Video not live, and not marked as bad, cleaning up: " + videoId, {videoId: videoId});
        await change.after.ref.delete();
      }
    });

exports.onDelete = functions.firestore
    .document("suspectStreams/{videoId}")
    .onDelete(async (snapshot, context) => {
      const videoId = context.params.videoId;
      functions.logger.info("Video deleted, cleaning up: " + videoId, {videoId: videoId});
      await cleanupStoredFiles(videoId);
    });

async function streamStatus(url) {
  try {
    const ytInfo = await ytdl.getBasicInfo(url);
    if ( ytInfo.videoDetails.isLiveContent == false ) {
      return STATUS_ENDED;
    }
  } catch (e) {
    switch (e.message) {
      case "Video unavailable":
      case "This video has been removed for violating YouTube's Terms of Service":
      case "Status code: 410":
        return e.message;
      default:
        throw e;
    }
  }
  return STATUS_LIVE;
}

async function generateFromSearch(searchString) {
  const filters1 = await ytsr.getFilters(searchString);
  const filter1 = filters1.get("Type").get("Video");
  const filters2 = await ytsr.getFilters(filter1.url);
  const filter2 = filters2.get("Features").get("Live");
  const ytOptions = {
    pages: 10,
  };

  // create an array to store ALL the results
  const results = [];
  let result = await ytsr(filter2.url, ytOptions);
  results.push(...result.items);
  while (result.continuation !== null) {
    result = await ytsr.continueReq(result.continuation);
    results.push(...result.items);
  }

  // Iterate through results, just returning the URLs
  const videoData = results.map(function(video) {
    return {
      url: video.url,
      video: video,
    };
  });

  let created = 0;
  let updated = 0;
  for (let i = 0; i < videoData.length; i++) {
    const url = videoData[i].url;
    const videoId = url.split("v=")[1];

    const doc = await collection.doc(videoId).get();
    const seenDate = new Date();
    if (!doc.exists) {
      await collection.doc(videoId).set({
        firstSeen: seenDate,
        lastSeen: seenDate,
        id: videoId,
        url: url,
        status: STATUS_LIVE,
      });
      created++;
    } else {
      await collection.doc(videoId).update({
        lastSeen: seenDate,
        status: STATUS_LIVE,
      });
      updated++;
    }

    await storage.bucket(bucketName).file(videoId + "/video.json").save(JSON.stringify(videoData[i].video, null, 2), {public: true});
  }

  return {
    found: videoData.length,
    created: created,
    updated: updated,
  };
}

async function checkStream(videoId, previousScans) {
  functions.logger.debug("Checking: " + videoId, {videoId: videoId});
  let checkTime = new Date();
  checkTime = checkTime.toISOString();

  const outputVideo = tmp.tmpNameSync() + ".mp4";
  const outputSnap = tmp.tmpNameSync() + ".jpg";

  // Check and Write Video (locally only)
  functions.logger.debug("Checking (Fetching video): " + videoId, {videoId: videoId});
  let vidFetchFail = false;
  const readableStream = ytdl("https://www.youtube.com/watch?v=" + videoId, {
    begin: Date.now(),
  });
  readableStream.on("error", function(err) {
    vidFetchFail = "Video fetch failed at the readableStream stage: " + videoId + "\n" + err;
  });
  readableStream.pipe(fs.createWriteStream(outputVideo));
  // Wait for file to exist on disk and be at least 1 MB (unles we failed)
  while (vidFetchFail || !fs.existsSync(outputVideo) || fs.statSync(outputVideo).size < 1000000) {
    await sleep(100);
  }
  readableStream.destroy();
  // Oh noes, we failed
  if (vidFetchFail) {
    return;
  }

  // Write Snapshot
  functions.logger.debug("Checking (Grabing frame): " + videoId, {videoId: videoId});
  await extractFrame({
    input: outputVideo,
    output: outputSnap,
    offset: 0, // seek offset in milliseconds
  });

  // Write text
  functions.logger.debug("Checking (Recognizing text): " + videoId, {videoId: videoId});
  const textDetectResult = await visionClient.textDetection(outputSnap);
  const extractedText = textDetectResult[0].fullTextAnnotation.text;

  /**
     * Looks for bad strings in the text of the video snapshot
     */
  functions.logger.debug("Checking (Detecting badness): " + videoId, {videoId: videoId});
  async function textIncludesBadStuff(text) {
    text = text.toLowerCase();
    const foundBadStuff = [];

    // TODO think of a better way to give initial values or config to the app?
    const badDomains = [
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
    ];
    for (let i = 0; i < badDomains.length; i++) {
      const badDomain = badDomains[i].toLowerCase();
      if (text.includes(badDomain)) {
        foundBadStuff.push(badDomain);
      }
    }

    // TODO think of a better way to give initial values or config to the app?
    const badRegex = [
      "Mr\\.? Beast Crypto Charity Stream",
      "double\\syour\\scrypto\\s+SCAN\\sQR[\\s-]CODE",
      "\\d+((\\.|,)\\d+)?\\+? ?(ETH|BTC|SOL|ADA),? ?(to|you)? ?(get|to|get|receive|and),? ?\\d+((\\.|,)\\d+)?\\+? ?(ETH|BTC|SOL|ADA)?",
    ];
    for (let i = 0; i < badRegex.length; i++) {
      const badRegexString = badRegex[i];
      const regex = new RegExp(badRegexString, "i");
      if (text.match(regex)) {
        foundBadStuff.push(badRegexString);
      }
    }

    return foundBadStuff;
  }

  const foundStuff = await textIncludesBadStuff(extractedText);
  functions.logger.debug("Checking (Updating state): " + videoId, {videoId: videoId, foundStuff: foundStuff});
  if (foundStuff.length > 0) {
    let report = "";
    for (let j = 0; j < foundStuff.length; j++) {
      report += foundStuff[j] + "\n";
    }

    // Write the report, JSON, frame, and text
    await bucketFile(videoId, "report.txt", checkTime).save(report, {public: true});
    await storage.bucket(bucketName).upload(outputSnap, {
      destination: bucketFileName(videoId, "snapshot.jpg", checkTime),
      public: true,
    });
    await bucketFile(videoId, "text.txt", checkTime).save(extractedText, {public: true});

    await collection.doc(videoId).update({
      badDetected: checkTime,
      lastScanned: new Date(),
      scanned: previousScans + 1,
    });
  } else {
    await collection.doc(videoId).update({
      lastScanned: new Date(),
      scanned: previousScans + 1,
    });
  }
}

exports.cleanupStoredFilesCallable = functions.https.onCall( async (data, context) => {
  await storage.bucket(bucketName).deleteFiles({
    prefix: data.videoId + "/",
  });
});

async function cleanupStoredFiles(videoId) {
  await storage.bucket(bucketName).deleteFiles({
    prefix: videoId + "/",
  });
}

function bucketFile(videoId, fileName, checkTime) {
  return storage.bucket(bucketName).file(bucketFileName(videoId, fileName, checkTime));
}

function bucketFileName(videoId, fileName, checkTime) {
  if (checkTime != null) {
    return videoId + "/" + checkTime + "_" + fileName;
  }
  return videoId + "/" + fileName;
}

const functions = require("firebase-functions");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const vision = require("@google-cloud/vision");
const tlds = require("tlds");
const storage = require("./src/storage");
const pubsub = require("./src/pubsub");

const TOPIC_BAD_STREAM = "bad-stream";
const TOPIC_BAD_DOMAIN = "bad-domain";
const DOMAIN_REGEX = new RegExp("(?:[^a-zA-Z0-9]|^)([a-zA-Z0-9-]+\\.(" + escapeDots(tlds.join("|")) + "))(?:[^a-zA-Z0-9]|$)", "ig");

const db = getFirestore();
const collectionOfStreams = db.collection("suspectStreams");
const collectionOfDomains = db.collection("domains");
const visionClient = new vision.ImageAnnotatorClient({
  projectId: process.env.PROJECT,
  keyFilename: "./sa-scam-hunter.json",
});

const RUN_WITH = {
  timeoutSeconds: 30,
  memory: "256MB",
};

exports.onPublish = functions
    .runWith(RUN_WITH)
    .pubsub.topic(TOPIC_BAD_STREAM)
    .onPublish(async (message, context) => {
      await processText(message.json.id);
    });

exports.onCall = functions
    .runWith(RUN_WITH)
    .https
    .onCall(async (data, context) => {
      await processText(data.id);
    });

async function processText(videoId) {
  const streamRef = collectionOfStreams.doc(videoId);
  const streamData = ( await streamRef.get() ).data();
  const textFile = storage.videoFile(videoId, "text.txt", streamData.badDetected.toDate());
  const text = await storage.getFileContents(textFile);

  // Also get the text of videos we decided are already bad from the vision API :)
  functions.logger.debug("Getting text from vision API: " + videoId, {videoId: videoId});
  const outputSnap = await storage.getLocalTempCopyOfFile(storage.videoFile(videoId, "snapshot.jpg", streamData.badDetected.toDate()));
  const visionTextResult = await visionClient.textDetection(outputSnap);
  if (visionTextResult[0].error) {
    functions.logger.error("Vision API error: " + visionTextResult[0].error.message, {videoId: videoId});
  }
  const visionText = visionTextResult[0].fullTextAnnotation.text;
  functions.logger.debug("Got vision text of length " + visionText.length, {videoId: videoId});
  storage.writeVideoVisionTextArtifacts(videoId, streamData.badDetected.toDate(), visionText);

  const newlyDetectedDomains = [...new Set([...matchDomainsInText(text), ...matchDomainsInText(visionText)])];
  functions.logger.debug("Detected " + newlyDetectedDomains.length + " new domains", {newlyDetectedDomains: newlyDetectedDomains});
  if (newlyDetectedDomains.length == 0) {
    functions.logger.info("No new domains detected");
    return;
  }

  // Check if these are live sites before counting then as real domains
  const liveDomains = [];
  for (let i = 0; i < newlyDetectedDomains.length; i++) {
    const domain = newlyDetectedDomains[i];
    const url = "https://" + domain;
    const isLive = await isUrl200Response(url);
    if (isLive) {
      liveDomains.push(domain);
    }
  }

  functions.logger.info("Detected " + liveDomains.length + " live domains");
  if (liveDomains.length == 0) {
    return;
  }

  // Update things related to the stream
  streamRef.update({
    domains: liveDomains,
  });
  storage.writeVideoVisionTextArtifacts(videoId, streamData.badDetected.toDate(), visionText);

  // Record the domains
  const domainsDoc = collectionOfDomains.doc("all");
  if (! (await domainsDoc.get() ).exists ) {
    functions.logger.info("Creating new domains doc");
    await domainsDoc.set({
      domains: liveDomains,
    });
  } else {
    await domainsDoc.update({
      domains: FieldValue.arrayUnion(...liveDomains),
    });
  }

  // Publish messages about domains
  for (let i = 0; i < liveDomains.length; i++) {
    const domain = liveDomains[i];
    // Send a message to the bad-stream topic
    await pubsub.messageWithCreate(TOPIC_BAD_DOMAIN, {videoId: videoId, domain: domain});
  }
}

function matchDomainsInText(text) {
  const domains = [];
  for (const match of text.matchAll(DOMAIN_REGEX)) {
    const lowerCaseDomains = match[1].toLowerCase();
    domains.push(lowerCaseDomains);
  }
  return domains;
}

// ecape all dots in strings
function escapeDots(str) {
  return str.replace(/\./g, "\\.");
}

async function isUrl200Response(url) {
  try {
    const response = await fetch(url);
    functions.logger.debug("Got response: " + response.status);
    return response.status === 200;
  } catch (e) {
    functions.logger.debug("Got error: " + e);
    return false;
  }
}

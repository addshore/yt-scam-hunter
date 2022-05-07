const functions = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");
const storage = require("./src/storage");
const youtube = require("./src/youtube");

const db = getFirestore();
const collectionOfStreams = db.collection("suspectStreams");
const collectionOfDomains = db.collection("domains");
const collectionOfWallets = db.collection("wallets");

// Cache on clients for 5 mins, in CDN for 10 mins
const CACHE_CONTROL = "public, max-age=300, s-maxage=600";
const RUN_WITH = {
  timeoutSeconds: 10,
  memory: "256MB",
};

exports.getCurrentBadStreams = functions.runWith(RUN_WITH).https.onRequest( async (request, response) => {
  getCurrentBadStreams(function(data) {
    response.set("Cache-Control", CACHE_CONTROL);
    response.send(data);
  });
});
exports.callCurrentBadStreams = functions.runWith(RUN_WITH).https.onCall( async (data, context) => {
  getCurrentBadStreams(function(data) {
    functions.logger.info("Response", {data: data});
  });
});

async function getCurrentBadStreams(callback) {
  const badStreams = await collectionOfStreams.where("status", "==", youtube.STATUS_LIVE).where("badDetected", "!=", null).get();
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
        "text-vision": ( await storage.fileExistsAtPath(storage.videoFileName(data.id, "text-vision.txt", badDate))) ? storage.videoFile(data.id, "text-vision.txt", badDate).publicUrl() : undefined,
        "report": storage.videoFile(data.id, "report.txt", badDate).publicUrl(),
      },
      domains: data.domains,
      wallets: data.wallets,
    };
  }
  callback(badStreamsData);
}

exports.getDomains = functions.runWith(RUN_WITH).https.onRequest( async (request, response) => {
  getDomains(function(data) {
    response.set("Cache-Control", CACHE_CONTROL);
    response.send(data);
  });
});
exports.callDomains = functions.runWith(RUN_WITH).https.onCall( async (data, context) => {
  getDomains(function(data) {
    functions.logger.info("Response", {data: data});
  });
});

async function getDomains(callback) {
  const domainsDoc = await collectionOfDomains.doc("all");
  const domains = (await domainsDoc.get()).data().domains;
  const returnData = {};
  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    returnData[domain] = {
      url: "https://" + domain,
    };
  }
  callback(returnData);
}

exports.getWallets = functions.runWith(RUN_WITH).https.onRequest( async (request, response) => {
  getWallets(function(data) {
    response.set("Cache-Control", CACHE_CONTROL);
    response.send(data);
  });
});
exports.callWallets = functions.runWith(RUN_WITH).https.onCall( async (data, context) => {
  getWallets(function(data) {
    functions.logger.info("Response", {data: data});
  });
});

async function getWallets(callback) {
  const walletsDoc = collectionOfWallets.doc("all");
  const wallets = (await walletsDoc.get()).data();
  const returnData = {
    btc: {},
    eth: {},
  };
  for (let i = 0; i < wallets.btc.length; i++) {
    const wallet = wallets.btc[i];
    returnData.btc[wallet] = {
      lookupUrl: "https://blockchain.info/address/" + wallet,
    };
  }
  for (let i = 0; i < wallets.eth.length; i++) {
    const wallet = wallets.eth[i];
    returnData.eth[wallet] = {
      lookupUrl: "https://etherscan.io/address/" + wallet,
    };
  }
  callback(returnData);
}

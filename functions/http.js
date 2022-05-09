const functions = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");
const storage = require("./src/storage");
const youtube = require("./src/youtube");
const cryptoBtc = require("./src/crypto-btc");
const cryptoEth = require("./src/crypto-eth");

const db = getFirestore();
const collectionOfStreams = db.collection("suspectStreams");
const collectionOfDomains = db.collection("domains");
const collectionOfWallets = db.collection("wallets");

// Cache on clients for 10 mins, in CDN for 10 mins
const CACHE_CONTROL = "public, max-age=600, s-maxage=600";
const RUN_WITH = {
  timeoutSeconds: 15,
  memory: "256MB",
};

exports.getCurrentBadStreams = functions.runWith(RUN_WITH).https.onRequest( async (request, response) => {
  getCurrentBadStreams(function(data) {
    response.set("Cache-Control", CACHE_CONTROL);
    response.set("Access-Control-Allow-Origin", "*");
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
        lastSeen: data.lastSeen.toDate().toISOString(),
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
      domains: data.domains ? domainsArrayFormatter(data.domains) : {},
      wallets: data.wallets ? {
        "eth": ethArrayFormatter(data.wallets.eth),
        "btc": btcArrayFormatter(data.wallets.btc),
      } : {},
    };
  }
  callback(badStreamsData);
}

exports.getDomains = functions.runWith(RUN_WITH).https.onRequest( async (request, response) => {
  getDomains(function(data) {
    response.set("Cache-Control", CACHE_CONTROL);
    response.set("Access-Control-Allow-Origin", "*");
    response.send(data);
  });
});
exports.callDomains = functions.runWith(RUN_WITH).https.onCall( async (data, context) => {
  getDomains(function(data) {
    functions.logger.info("Response", {data: data});
  });
});

async function getDomains(callback) {
  const domainsDoc = collectionOfDomains.doc("all");
  const domains = await domainsDoc.get();
  if (!domains.exists) {
    callback({});
    return;
  }
  callback(domainsArrayFormatter(domains.data().domains));
}

exports.getWallets = functions.runWith(RUN_WITH).https.onRequest( async (request, response) => {
  getWallets(function(data) {
    response.set("Cache-Control", CACHE_CONTROL);
    response.set("Access-Control-Allow-Origin", "*");
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
  const wallets = await walletsDoc.get();
  if (!wallets.exists) {
    callback({});
    return;
  }
  const walletsData = wallets.data();
  // TODO if these requests take too long, run the colelction of balances on a cron instead? (But these responses are cached, so should be fine?)
  callback({
    btc: btcArrayFormatter(
        walletsData.btc,
        await cryptoBtc.walletsReceived(walletsData.btc),
    ),
    eth: ethArrayFormatter(
        walletsData.eth,
        await cryptoEth.walletsBalance(walletsData.eth),
    ),
  });
}

function domainsArrayFormatter(data) {
  const returnData = {};
  for (let i = 0; i < data.length; i++) {
    const domain = data[i];
    returnData[domain] = {
      url: "https://" + domain,
    };
  }
  return returnData;
}

function btcArrayFormatter(wallets, balances) {
  const returnData = {};
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    returnData[wallet] = {
      info: cryptoBtc.infoLink(wallet),
      received: balances ? balances[wallet] : undefined,
    };
  }
  return returnData;
}

function ethArrayFormatter(wallets, balances) {
  const returnData = {};
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    returnData[wallet] = {
      info: cryptoEth.infoLink(wallet),
      balance: balances ? balances[wallet] : undefined,
    };
  }
  return returnData;
}

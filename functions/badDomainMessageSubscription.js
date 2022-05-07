const functions = require("firebase-functions");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const fetch = require("node-fetch");
const xpath = require('xpath')
const dom = require('xmldom').DOMParser
const Web3 = require('web3');

const TOPIC_BAD_DOMAIN = "bad-domain";
// Each regex is surrounded with (?:[^a-zA-Z0-9]|^|$) to avoid matching on other parts of other wallet addresses
// https://regexland.com/regex-bitcoin-addresses/
const BTC_REGEX = /(?:[^a-zA-Z0-9]|^)([13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}|bc1[a-z0-9]{39,59})(?:[^a-zA-Z0-9]|$)/g
// https://regexland.com/regex-ethereum-addresses/
const ETH_REGEX = /(?:[^a-zA-Z0-9]|^)(0x[a-fA-F0-9]{40})(?:[^a-zA-Z0-9]|$)/g

const db = getFirestore();
const collectionOfStreams = db.collection("suspectStreams");
const collectionOfWallets = db.collection("wallets");

// 90 seconds as this has a bunch ot http requests in it
// - Domain checks
// - Wallet checks
const RUN_WITH = {
  timeoutSeconds: 90,
  memory: "128MB",
};

exports.onPublish = functions
    .runWith(RUN_WITH)
    .pubsub.topic(TOPIC_BAD_DOMAIN)
    .onPublish(async (message, context) => {
      await processDomain(message.json.domain, message.json.videoId);
    });

exports.onCall = functions
    .runWith(RUN_WITH)
    .https
    .onCall(async (data, context) => {
      await processDomain(data.domain, data.videoId);
    });

async function processDomain(domain, videoId) {
    let streamRef = collectionOfStreams.doc(videoId)

    let url = "https://" + domain;
    let htmls = []
    htmls.push(await htmlPlusCookiesForUrl(url));

    // Also grab HTML for any links from this first page
    let firstRoundMatches = getxPath(htmls[0], "//a/@href")
    let filteredNextUrls = []
    for (let j = 0; j < firstRoundMatches.length; j++) {
        let match = firstRoundMatches[j];
        if (match.startsWith("http")) {
            continue;
        }
        // get URLs from relative links
        let innerUrl = url + "/" + match;

        // strip everything after the last hash
        let hashIndex = innerUrl.lastIndexOf("#");
        if (hashIndex > 0) {
            innerUrl = innerUrl.substring(0, hashIndex);
        }

        // trim trailing slash
        if (innerUrl.endsWith("/")) {
            innerUrl = innerUrl.substring(0, innerUrl.length - 1);
        }

        if ( innerUrl == url ) {
            continue;
        }

        filteredNextUrls.push(innerUrl);
    }
    filteredNextUrls = [...new Set(filteredNextUrls)]

    // Grab the HTML from these URLs too
    for (let j = 0; j < filteredNextUrls.length; j++) {
        let innerUrl = filteredNextUrls[j];
        let innerHtml = await htmlPlusCookiesForUrl(innerUrl);
        console.log(innerUrl)
        htmls.push(innerHtml);
    }
    functions.logger.debug("Got " + htmls.length + " HTMLs");

    // Process all html looking for crypto wallets...
    let btcwallets = []
    let ethwallets = []
    for (let j = 0; j < htmls.length; j++) {
        let html = htmls[j];
        for (const match of html.matchAll(BTC_REGEX)) {
            let wallet = match[1];
            let walletCheck = await checkBTCWalletExists(wallet);
            if (walletCheck !== false) {
                functions.logger.info("Found BTC wallet: " + wallet, {walletCheck:walletCheck});
                btcwallets.push(wallet);
            }
        }
        for (const match of html.matchAll(ETH_REGEX)) {
            let wallet = match[1];
            let walletCheck = await checkETHWalletExists(wallet);
            if (walletCheck !== false) {
                functions.logger.info("Found ETH wallet: " + wallet, {walletCheck:walletCheck});
                ethwallets.push(wallet);
            }
        }
    }

    // make arrays unique
    btcwallets = [...new Set(btcwallets)];
    ethwallets = [...new Set(ethwallets)];

    // Bail if we have no wallets
    functions.logger.info("Detected " + ( Object.keys(btcwallets).length + Object.keys(ethwallets).length ) + " live wallets");
    if (Object.keys(btcwallets).length == 0 && Object.keys(ethwallets).length == 0) {
        return;
    }

    // Update things related to the stream
    streamRef.update({
        wallets: {
            btc: btcwallets,
            eth: ethwallets,
        }
    })

    // Record the wallets
    let walletsDoc = collectionOfWallets.doc("all");
    if (! (await walletsDoc.get() ).exists) {
        functions.logger.info("Creating new wallets doc");
        await walletsDoc.set({
            btc: btcwallets,
            eth: ethwallets,
        })
    } else {
        await walletsDoc.update({
            btc: FieldValue.arrayUnion(...btcwallets),
            eth: FieldValue.arrayUnion(...ethwallets),
        })
    }
}

async function checkETHWalletExists(wallet) {
    const checkUrl = "https://api.etherscan.io/api?module=account&action=balance&address=" + wallet + "&apikey=" + process.env.ETHERSCAN_KEY
    try{
        const response = await fetch(checkUrl);
        const json = await response.json();
        if (json.hasOwnProperty("result")) {
            const wei = json.result;
            const etherValue = Web3.utils.fromWei(wei, 'ether');
            return etherValue
        }
        return false;
    } catch (e) {
        return null
    }
}

async function checkBTCWalletExists(wallet) {
    const checkUrl = "https://blockchain.info/rawaddr/" + wallet;
    try {
        let response = await fetch(checkUrl);
        let json = await response.json();
        // If json object has key total_received
        if (json.hasOwnProperty("total_received")) {
            return true;
        }
        return false;
    } catch (e) {
        return null
    }
}

async function htmlPlusCookiesForUrl(url) {
    const controller = new AbortController()
    setTimeout(() => {
        controller.abort();
    }, 3000);
    try {
        const response = await fetch(url, {signal: controller.signal});
        let outputText = await response.text();
        // Some of the sites store the wallets in the cookies, so grab boring text from there too
        if (response.headers.has("set-cookie")) {
            const setCookie = response.headers.raw()['set-cookie'];
            outputText = outputText + "\n\n" + setCookie;
        }
        return outputText;
    } catch (e) {
        functions.logger.error(e);
        return ""
    }
}

function getxPath(html, path) {
    try {
        // dom with hidden warnings per https://stackoverflow.com/a/56213118/4746236 
      let root = new dom({
        locator: {},
        errorHandler: { warning: function (w) { }, 
        error: function (e) { }, 
        fatalError: function (e) { console.error(e) } }
    }).parseFromString(html);
      
      let results = xpath.select(path, root);
      if (results.length > 0) {
        let _results = [];
        for (let r of results) {
          _results.push(r.textContent);
        }
        return _results;
      }
    } catch (exc) {
    }
    return [];
}
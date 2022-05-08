const functions = require("firebase-functions");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const fetch = require("node-fetch");
const xpath = require("xpath");
const Dom = require("xmldom").DOMParser;
const Web3 = require("web3");

const TOPIC_BAD_DOMAIN = "bad-domain";
// Each regex is surrounded with (?:[^a-zA-Z0-9]|^|$) to avoid matching on other parts of other wallet addresses
// https://regexland.com/regex-bitcoin-addresses/
const BTC_REGEX = /(?:[^a-zA-Z0-9]|^)([13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}|bc1[a-z0-9]{39,59})(?:[^a-zA-Z0-9]|$)/g;
// https://regexland.com/regex-ethereum-addresses/
const ETH_REGEX = /(?:[^a-zA-Z0-9]|^)(0x[a-fA-F0-9]{40})(?:[^a-zA-Z0-9]|$)/g;

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
  const streamRef = collectionOfStreams.doc(videoId);

  // Scan the first URL that we can construct
  const url = "https://" + domain;
  const contentToScan = [];
  const {content, links} = await extractFromURL(url);
  contentToScan.push( content);

  // Also scan link on the page that we find
  for (let j = 0; j < links.length; j++) {
    const innerUrl = links[j];
    const {innerContent, innerLinks} = await extractFromURL(innerUrl);
    contentToScan.push(innerContent);
    // Scan 1 more jump, if not scanned before
    // TODO XXX FIX Cannot read properties of undefined (reading 'length')
    for (let k = 0; k < innerLinks.length; k++) {
      const innerInnerUrl = innerLinks[k];
      if (links.includes(innerInnerUrl)) {
        continue;
      }
      const {innerInnerContent} = await extractFromURL(innerInnerUrl);
      contentToScan.push(innerInnerContent);
    }
  }
  functions.logger.debug("Got " + contentToScan.length + " HTMLs");

  // TODO go out another jump for sites like https://ark-doublecoin.net/ -> https://ark-doublecoin.net/new -> https://ark-doublecoin.net/ethnew

  // Process all html looking for crypto wallets...
  let btcwallets = [];
  let ethwallets = [];
  for (let j = 0; j < contentToScan.length; j++) {
    const html = contentToScan[j];
    for (const match of html.matchAll(BTC_REGEX)) {
      const wallet = match[1];
      const walletCheck = await checkBTCWalletExists(wallet);
      if (walletCheck !== false) {
        btcwallets.push(wallet);
      }
    }
    for (const match of html.matchAll(ETH_REGEX)) {
      const wallet = match[1];
      const walletCheck = await checkETHWalletExists(wallet);
      if (walletCheck !== false) {
        ethwallets.push(wallet);
      }
    }
  }

  // make arrays unique and count them
  btcwallets = [...new Set(btcwallets)];
  ethwallets = [...new Set(ethwallets)];
  functions.logger.info("Found " + btcwallets.length + " BTC wallets and " + ethwallets.length + " ETH wallets");

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
    },
  });

  // Record the wallets
  const walletsDoc = collectionOfWallets.doc("all");
  if (! (await walletsDoc.get() ).exists) {
    functions.logger.info("Creating new wallets doc");
    await walletsDoc.set({
      btc: btcwallets,
      eth: ethwallets,
    });
  } else {
    // Use arrayUnion to do updated, bu do this selectively to avoid "Function "FieldValue.arrayUnion()" requires at least 1 argument."
    // ie. If the array is empty, it would error...
    if (btcwallets.length > 0 && ethwallets.length > 0) {
      await walletsDoc.update({
        btc: FieldValue.arrayUnion(...btcwallets),
        eth: FieldValue.arrayUnion(...ethwallets),
      });
    } else if (btcwallets.length > 0) {
      await walletsDoc.update({
        btc: FieldValue.arrayUnion(...btcwallets),
      });
    } else if (ethwallets.length > 0) {
      await walletsDoc.update({
        eth: FieldValue.arrayUnion(...ethwallets),
      });
    }
  }
}

/**
 * Extracts text based on HTML and cookies from a URL, as well as returning other links found on the page.
 * @param {string} url
 * @returns {Promise<object>}
 */
async function extractFromURL( url ) {
  functions.logger.info("Extracting content etc from URL: " + url);
  const {html, cookies} = await htmlPlusCookiesForUrl(url);
  const linkedUrls = extractLinksFromHtml(url, html);
  const content = ( html + "\n\n" + cookies );
  return {content, linkedUrls};
}

function extractLinksFromHtml( baseUrl, html ) {
  const hrefMatches = getxPath(html, "//a/@href");
  let linkedUrls = [];
  for (let j = 0; j < hrefMatches.length; j++) {
    const match = hrefMatches[j];
    if (match.startsWith("http")) {
      continue;
    }
    // get URLs from relative links
    let innerUrl = baseUrl + "/" + match;

    // strip everything after the last hash
    const hashIndex = innerUrl.lastIndexOf("#");
    if (hashIndex > 0) {
      innerUrl = innerUrl.substring(0, hashIndex);
    }

    // trim trailing slash
    if (innerUrl.endsWith("/")) {
      innerUrl = innerUrl.substring(0, innerUrl.length - 1);
    }

    if ( innerUrl == baseUrl ) {
      continue;
    }

    linkedUrls.push(innerUrl);
  }
  linkedUrls = [...new Set(linkedUrls)];
  return linkedUrls;
}

async function checkETHWalletExists(wallet) {
  const checkUrl = "https://api.etherscan.io/api?module=account&action=balance&address=" + wallet + "&apikey=" + process.env.ETHERSCAN_KEY;
  try {
    const response = await fetch(checkUrl);
    const json = await response.json();
    if (Object.prototype.hasOwnProperty.call( json, "result")) {
      const wei = json.result;
      const etherValue = Web3.utils.fromWei(wei, "ether");
      return etherValue;
    }
    return false;
  } catch (e) {
    return null;
  }
}

async function checkBTCWalletExists(wallet) {
  const checkUrl = "https://blockchain.info/rawaddr/" + wallet;
  try {
    const response = await fetch(checkUrl);
    const json = await response.json();
    // If json object has key total_received
    if (Object.prototype.hasOwnProperty.call( json, "total_received")) {
      return true;
    }
    return false;
  } catch (e) {
    return null;
  }
}

async function htmlPlusCookiesForUrl(url) {
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
  }, 3000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      follow: 10,
      signal: controller.signal,
    });
    const outputText = await response.text();
    // Some of the sites store the wallets in the cookies, so grab boring text from there too
    if (response.headers.has("set-cookie")) {
      return {html: outputText, cookies: response.headers.raw()["set-cookie"]};
    }
    return {html: outputText, cookies: undefined};
  } catch (e) {
    functions.logger.error(e);
    return {html: "", cookies: undefined};
  }
}

function getxPath(html, path) {
  try {
    // dom with hidden warnings per https://stackoverflow.com/a/56213118/4746236
    const root = new Dom({
      locator: {},
      errorHandler: {warning: function(w) { },
        error: function(e) { },
        fatalError: function(e) {
          console.error(e);
        }},
    }).parseFromString(html);

    const results = xpath.select(path, root);
    if (results.length > 0) {
      const _results = [];
      for (const r of results) {
        _results.push(r.textContent);
      }
      return _results;
    }
  } catch (exc) {
    // Ignore
  }
  return [];
}

const functions = require("firebase-functions");
const fetch = require("node-fetch");

exports.infoLink = function(wallet) {
  return "https://blockchain.info/address/" + wallet;
};

/**
 * @param {string} wallet
 * @returns boolean if we succeed to check, null if not
 */
exports.walletExists = async function(wallet) {
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
};

exports.walletsReceived = async function(wallets) {
  const walletsReceived = {};
  const apiUrl = "https://blockchain.info/balance?active=" + wallets.join("|");
  try {
    const response = await fetch(apiUrl);
    const json = await response.json();
    for ( const wallet in json ) {
      if ( Object.prototype.hasOwnProperty.call( json, wallet )) {
        walletsReceived[wallet] = parseFloat( json[wallet].total_received ) * 0.00000001;
      }
    }
  } catch (e) {
    functions.logger.error("Error fetching wallet received: " + e);
    return null;
  }
  return walletsReceived;
};

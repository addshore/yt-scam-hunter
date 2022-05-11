const functions = require("firebase-functions");

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
    if (Object.prototype.hasOwnProperty.call(json, "total_received")) {
      return true;
    }
    return false;
  } catch (e) {
    return null;
  }
};

exports.walletsReceived = async function(wallets) {
  const walletsReceived = {};

  // run query for batches of 20 wallets (etherscan has this as a limit, so let just do it for blockchain.info too..?)
  const batchSize = 20;
  const batches = [];
  for (let i = 0; i < wallets.length; i += batchSize) {
    batches.push(wallets.slice(i, i + batchSize));
  }
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    const apiUrl = "https://blockchain.info/balance?active=" + batch.join("|");
    try {
      const response = await fetch(apiUrl);
      const json = await response.json();
      for (const wallet in json) {
        if (Object.prototype.hasOwnProperty.call(json, wallet)) {
          walletsReceived[wallet] = parseFloat(json[wallet].total_received) * 0.00000001;
        }
      }
    } catch (e) {
      functions.logger.error("Error fetching wallet batch, received: " + e);
    }
  }
  return walletsReceived;
};

const functions = require("firebase-functions");
const fetch = require("node-fetch");
const Web3 = require("web3");

exports.infoLink = function(wallet) {
  return "https://etherscan.io/address/" + wallet;
};

/**
 * @param {string} wallet
 * @returns boolean if we succeed to check, null if not
 */
exports.walletExists = async function(wallet) {
  const checkUrl = "https://api.etherscan.io/api?module=account&action=balance&address=" + wallet + "&apikey=" + process.env.ETHERSCAN_KEY;
  try {
    const response = await fetch(checkUrl);
    const json = await response.json();
    if (Object.prototype.hasOwnProperty.call(json, "result")) {
      const wei = json.result;
      const etherValue = Web3.utils.fromWei(wei, "ether");
      return etherValue;
    }
    return false;
  } catch (e) {
    return null;
  }
};

exports.walletsBalance = async function(wallets) {
  const walletsReceived = {};

  // run query for batches of 20 wallets (etherscan appears to have this as a limit)
  const batchSize = 20;
  const batches = [];
  for (let i = 0; i < wallets.length; i += batchSize) {
    batches.push(wallets.slice(i, i + batchSize));
  }
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const apiUrl = "https://api.etherscan.io/api?module=account&action=balancemulti&tag=latest&address=" + batch.join(",") + "&apikey=" + process.env.ETHERSCAN_KEY;
    try {
      const response = await fetch(apiUrl);
      const json = await response.json();
      for (const wallet in json.result) {
        if (Object.prototype.hasOwnProperty.call(json.result, wallet)) {
          walletsReceived[json.result[wallet].account] = Web3.utils.fromWei(json.result[wallet].balance, "ether");
        }
      }
    } catch (e) {
      functions.logger.error("Error fetching wallet batch, received: " + e);
    }
  }
  return walletsReceived;
};

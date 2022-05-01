const fetch = require('node-fetch');
const Database = require('st.db');
const badDb = new Database({path:'./bad.db.yml'});
const xpath = require('xpath')
const dom = require('xmldom').DOMParser

const controller = new AbortController()
const timeout = setTimeout(() => {
	controller.abort();
}, 3000);


// Each regex is surrounded with (?:[^a-zA-Z0-9]) to avoid matching on other parts of other wallet addresses
// https://regexland.com/regex-bitcoin-addresses/
const BTC_REGEX = /(?:[^a-zA-Z0-9])([13]{1}[a-km-zA-HJ-NP-Z1-9]{26,33}|bc1[a-z0-9]{39,59})(?:[^a-zA-Z0-9])/g
// https://regexland.com/regex-ethereum-addresses/
const ETH_REGEX = /(?:[^a-zA-Z0-9])(0x[a-fA-F0-9]{40})(?:[^a-zA-Z0-9])/g

async function htmlForUrl(url) {
    try {
        const response = await fetch(url, {signal: controller.signal});
        const html = await response.text();
        return html;
    } catch (e) {
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

(async () => {
    let badDomains = await badDb.get("domains")
    let walletsBTC = await badDb.get("wallets.btc")
    let walletsETH = await badDb.get("wallets.eth")
    if ( walletsBTC == undefined ){
        walletsBTC = []
    }
    if ( walletsETH == undefined ){
        walletsETH = []
    }

    for (i = 0; i < badDomains.length; i++) {
        let url = "https://" + badDomains[i].toLowerCase();
        let htmls = []
        // add empty string to htmls
        console.log("Looking for crypto wallets: " + url)
        htmls.push(await htmlForUrl(url));

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
            let innerHtml = await htmlForUrl(innerUrl);
            console.log(innerUrl)
            htmls.push(innerHtml);
        }

        // Process all html looking for crypto wallets...
        for (let j = 0; j < htmls.length; j++) {
            let html = htmls[j];

            for (const match of html.matchAll(BTC_REGEX)) {
                if (!walletsBTC.includes(match[1])) {
                    walletsBTC.push(match[1]);
                    badDb.push("wallets.btc", match[1]);
                    console.log("Found new BTC wallet: " + match[1]);
                }
            }
            for (const match of html.matchAll(ETH_REGEX)) {
                if (!walletsETH.includes(match[1])) {
                    walletsETH.push(match[1]);
                    badDb.push("wallets.eth", match[1]);
                    console.log("Found new ETH wallet: " + match[1]);
                }
            }
        }
    }
})()
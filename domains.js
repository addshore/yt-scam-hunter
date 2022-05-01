const fetch = require('node-fetch');
const tlds = require('tlds');
const fs = require('fs')
const Database = require('st.db');

const badDb = new Database({path:'./bad.db.yml'});

// ecape all dots in strings
function escapeDots(str) {
    return str.replace(/\./g, '\\.');
}

let domainRegex = new RegExp("([a-z0-9-]+\\.(" + escapeDots(tlds.join('|')) + "))(?:[^a-zA-Z0-9])", 'ig');

async function isUrl200Response(url) {
    try {
        const response = await fetch(url);
        return response.status === 200;
    } catch (e) {
        return false;
    }
}

(async () => {
    let badDomains = await badDb.get("domains")
    let badVideos = await badDb.get("videos")

    let newlyDetectedDomains = []
    for (i = 0; i < badVideos.length; i++) {
        let videoUrl = badVideos[i];
        let videoId = videoUrl.split("=")[1];
        let outputText = "./.data/" + videoId + ".txt";
        let text = fs.readFileSync(outputText, 'utf8');
        for (const match of text.matchAll(domainRegex)) {
            let lowerCaseDomains = match[1].toLowerCase()
            if (!badDomains.includes(lowerCaseDomains)) {
                badDomains.push(lowerCaseDomains);
                newlyDetectedDomains.push(lowerCaseDomains);
            }
        }
    }
    newlyDetectedDomains = [...new Set(newlyDetectedDomains)];
    console.log("Detected " + newlyDetectedDomains.length + " new domains");

    console.log("Checking for live sites...");
    for (i = 0; i < newlyDetectedDomains.length; i++) {
        let domain = newlyDetectedDomains[i];
        let url = "https://" + domain;
        let isLive = await isUrl200Response(url);
        if (isLive) {
            console.log(domain + " is live, pushing to the DB!");
            badDb.push("domains", domain);
        }
    }

})()
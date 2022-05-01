const functions = require("firebase-functions");
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const tmp = require('tmp');
const {Storage} = require('@google-cloud/storage');
const ytdl = require('ytdl-core');
const fs = require('fs');
const extractFrame = require('ffmpeg-extract-frame')
const tesseract = require("node-tesseract-ocr")
const sleep = require('util').promisify(setTimeout)

exports.suspectStreamsGenerate = functions.https.onRequest(async (request, response) => {
    const ytsr = require('ytsr');
    const db = getFirestore();
    const collection = db.collection('suspectStreams');

    const storage = new Storage();
    const bucketName = "scamhunter-public"

    const searchString = '"eth" OR "btc"'

    const filters1 = await ytsr.getFilters(searchString);
    const filter1 = filters1.get('Type').get('Video');
    const filters2 = await ytsr.getFilters(filter1.url);
    const filter2 = filters2.get('Features').get('Live');
    const ytOptions = {
        pages: 10,
    }

    // create an array to store ALL the results
    let results = [];
    let result = await ytsr(filter2.url, ytOptions);
    results.push(...result.items);
    while (result.continuation !== null) {
        result = await ytsr.continueReq(result.continuation);
        results.push(...result.items);
    }

    // Iterate through results, just returning the URLs
    let videoData = results.map(function(video) {
        return {
            url: video.url,
            video: video,
        };
    });

    let created = 0;
    let updated = 0;
    for (let i = 0; i < videoData.length; i++) {
        let url = videoData[i].url;
        let videoId = url.split('v=')[1];

        let doc = await collection.doc(videoId).get();
        if (!doc.exists) {
            await collection.doc(videoId).set({
                firstSeen: new Date(),
                lastSeen: new Date(),
                id: videoId,
                url: url,
            })
            created++;
        } else {
            await collection.doc(videoId).update({
                lastSeen: new Date(),
            })
            updated++;
        }
        
        await storage.bucket(bucketName).file(videoId + '/video.json').save(JSON.stringify(videoData[i].video,null,2))
    }

    response.send({
        found: videoData.length,
        created: created,
        updated: updated,
    })
});

exports.suspectStreamsOnWrite = functions.firestore
    .document('suspectStreams/{docId}')
    // Only trigger this the first time a video is added (for now)
    // In the future, do this hourly?
    // And in that case we will need to skip if badDetected is already set :)
    .onCreate(async (snapshot, context) => {
        const db = getFirestore();
        const collection = db.collection('suspectStreams');
        const storage = new Storage();
        const bucketName = "scamhunter-public"

        let youtubeVideoId = context.params.docId

        let now = new Date();
        now = now.toISOString()
    
        let outputVideo = tmp.tmpNameSync() + '.mp4';
        let outputSnap = tmp.tmpNameSync() + '.jpg';
        let outputText = tmp.tmpNameSync() + '.txt';
    
        // Check and Write Video (locally only)
        let vidFetchFail = false;
        let readableStream = ytdl('https://www.youtube.com/watch?v=' + youtubeVideoId, {
            begin : Date.now(),
        })
        readableStream.on('error', function(err) {
            vidFetchFail = "Video fetch failed at the readableStream stage: " + youtubeVideoId + "\n" + err;
        })
        readableStream.pipe(fs.createWriteStream(outputVideo));
        // Wait for file to exist on disk and be at least 1 MB (unles we failed)
        while (vidFetchFail || !fs.existsSync(outputVideo) || fs.statSync(outputVideo).size < 1000000) {
            await sleep(100);
        }
        readableStream.destroy();
        // Oh noes, we failed
        if (vidFetchFail) {
            return
        }
        
        // Write Snapshot
        await extractFrame({
            input: outputVideo,
            output: outputSnap,
            offset: 0 // seek offset in milliseconds
        })

        // Write text
        let extractedText = await tesseract
            .recognize(outputSnap, {
                lang: "eng",
                oem: 1,
                psm: 3,
                dpi: 2400,
            })
            .then((text) => {
                fs.writeFileSync(outputText, text);
                return text
            })
            .catch((error) => {
                fs.writeFileSync(outputText, "");
                console.log(error.message)
                return ""
            });

        /**
         * Looks for bad strings in the text of the video snapshot
         */
        async function textIncludesBadStuff(text) {
            text = text.toLowerCase();
            let foundBadStuff = []

            // TODO think of a better way to give initial values or config to the app?
            let badDomains = [
                "2xmusk.com",
                "2022binance.com",
                "ark-elonmusk.com",
                "ark-x2.gift",
                "btc-invest.info",
                "buterin-eth2022.net",
                "cryptoshelpinghand.com",
                "doublems.org",
                "double-ether.org",
                "elon-2x.org",
                "elon-join.com",
                "ethcrypto.us",
                "ethgift22.info",
                "ethx2.top",
                "eth-claimx2.com",
                "eth-double.info",
                "eth-japan.org",
                "event-ether.net",
                "getx2ether.com",
                "givecrypt.in",
                "givetesla22.com",
                "invest-tesla.org",
                "livex2.tech",
                "msgetx2.net",
                "msgetx2.org",
                "ms2x.io",
                "musk-space.org",
                "musklive.tech",
                "sol2x.info",
                "tesla-join.com",
                "tesla-seo.com",
                "teslagive22.com",
                "teslax-event.com",
                "tesla22.us",
                "x2ether.us",
                "x2musk.io",
                "2xelon.net",
            ]
            for (i = 0; i < badDomains.length; i++) {
                let badDomain = badDomains[i].toLowerCase();
                if (text.includes(badDomain)) {
                    foundBadStuff.push(badDomain);
                }
            }

            // TODO think of a better way to give initial values or config to the app?
            let badRegex = [
                "Mr\\.? Beast Crypto Charity Stream",
                "double\\syour\\scrypto\\s+SCAN\\sQR[\\s-]CODE",
                "\\d+((\\.|,)\\d+)?\\+? ?(ETH|BTC|SOL|ADA),? ?(to|you)? ?(get|to|get|receive|and),? ?\\d+((\\.|,)\\d+)?\\+? ?(ETH|BTC|SOL|ADA)?",
            ];
            for (i = 0; i < badRegex.length; i++) {
                let badRegexString = badRegex[i];
                let regex = new RegExp(badRegexString,'i');
                if (text.match(regex)) {
                    foundBadStuff.push(badRegexString);
                }
            }

            return foundBadStuff
        }

        let foundStuff = await textIncludesBadStuff(extractedText);
        let previousScans = snapshot.data().scans || 0;
        if (foundStuff.length > 0) {

            let report = ""
            for (let j = 0; j < foundStuff.length; j++) {
                report += " - \"" + foundStuff[j] + "\"\n"
            }

            // Write the report, JSON, frame, and text
            await storage.bucket(bucketName).file(youtubeVideoId + '/' + now + '_report.txt').save(report)
            await storage.bucket(bucketName).upload(outputSnap, {destination: youtubeVideoId + '/' + now + '_frame.jpg'});
            await storage.bucket(bucketName).file(youtubeVideoId + '/' + now + '_text.txt').save(extractedText)
            await collection.doc(youtubeVideoId).update({
                badDetected: now,
                lastScanned: new Date(),
                scanned: previousScans + 1,
            })
        } else {
            await collection.doc(youtubeVideoId).update({
                lastScanned: new Date(),
                scanned: previousScans + 1,
            })
        }

   });
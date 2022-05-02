const functions = require("firebase-functions");
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const tmp = require('tmp');
const {Storage} = require('@google-cloud/storage');
const ytdl = require('ytdl-core');
const fs = require('fs');
const extractFrame = require('ffmpeg-extract-frame')
const tesseract = require("node-tesseract-ocr")
const sleep = require('util').promisify(setTimeout)
const ytsr = require('ytsr');

const bucketName = "scamhunter-public"
const db = getFirestore();
const collection = db.collection('suspectStreams');
const storage = new Storage();

exports.schedule = functions.pubsub.schedule('every 1 hour').onRun(async (context) => {
    let result = await generateFromSearch('"eth" OR "btc"');
    functions.logger.info("Schedueled generateFromSearch ran", result);
});

// Testable from within the `firebase functions:shell`
// with `suspectStreamsGenerate({})`
exports.generate = functions.https.onCall( async (data, context) => {
    return await generateFromSearch('"eth" OR "btc"');
});

exports.onCreate = functions.firestore
    .document('suspectStreams/{videoId}')
    // Only trigger this the first time a video is added (for now)
    // In the future, do this hourly?
    // And in that case we will need to skip if badDetected is already set :)
    .onCreate(async (snapshot, context) => {
        let videoId = context.params.videoId
        await checkStream(videoId, snapshot.data().scanned || 0);
    });

exports.onUpdate = functions.firestore
    .document('suspectStreams/{videoId}')
    .onUpdate(async (change, context) => {
        let videoId = context.params.videoId
        let previousValue = change.before.data();
        let newValue = change.after.data();
        // Never check videos that area already detectedas "bad"
        if (newValue.badDetected) {
            functions.logger.info("onUpdate: Video already bad detected, skipping: " + videoId, {videoId: videoId});
            return;
        }
        // If the last seen value has changed (i.e. the video has been seen again) then check again
        // TODO maybe only scan if it has not been scanned in 2 hours?
        // TODO maybe have an upper limit on the number of scans?
        if (newValue.lastSeen.toDate().getTime() != previousValue.lastSeen.toDate().getTime()) {
            let previousScanCount = newValue.scanned || 0
            functions.logger.info("onUpdate: Video seen again, and scanned " + previousScanCount + " times, scanning again: " + videoId, {videoId: videoId, previousScanCount: previousScanCount});
            await checkStream(videoId, previousScanCount);
        }
        functions.logger.debug("onUpdate: Nothing to do: " + videoId, {videoId: videoId});
    });

exports.onDelete = functions.firestore
    .document('suspectStreams/{videoId}')
    .onDelete(async (snapshot, context) => {
        let videoId = context.params.videoId
        functions.logger.info("onDelete: Video deleted, cleaning up: " + videoId, {videoId: videoId});
        await cleanupStoredFiles(videoId);
    });

async function generateFromSearch(searchString) {
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
        let seenDate = new Date()
        if (!doc.exists) {
            await collection.doc(videoId).set({
                firstSeen: seenDate,
                lastSeen: seenDate,
                id: videoId,
                url: url,
            })
            created++;
        } else {
            await collection.doc(videoId).update({
                lastSeen: seenDate,
            })
            updated++;
        }
        
        await storage.bucket(bucketName).file(videoId + '/video.json').save(JSON.stringify(videoData[i].video,null,2))
    }

    return {
        found: videoData.length,
        created: created,
        updated: updated,
    }
}

async function checkStream(videoId, previousScans) {
    //functions.logger.debug("checkStream: " + videoId, {videoId: videoId, previousScans: previousScans});
    let checkTime = new Date();
    checkTime = checkTime.toISOString()

    let outputVideo = tmp.tmpNameSync() + '.mp4';
    let outputSnap = tmp.tmpNameSync() + '.jpg';
    let outputText = tmp.tmpNameSync() + '.txt';

    // Check and Write Video (locally only)
    let vidFetchFail = false;
    let readableStream = ytdl('https://www.youtube.com/watch?v=' + videoId, {
        begin : Date.now(),
    })
    readableStream.on('error', function(err) {
        vidFetchFail = "Video fetch failed at the readableStream stage: " + videoId + "\n" + err;
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
            "2xeth.info",
            "crttesla.com",
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
    if (foundStuff.length > 0) {

        let report = ""
        for (let j = 0; j < foundStuff.length; j++) {
            report += " - \"" + foundStuff[j] + "\"\n"
        }

        // Write the report, JSON, frame, and text
        await storage.bucket(bucketName).file(videoId + '/' + checkTime + '_report.txt').save(report)
        await storage.bucket(bucketName).upload(outputSnap, {destination: videoId + '/' + checkTime + '_frame.jpg'});
        await storage.bucket(bucketName).file(videoId + '/' + checkTime + '_text.txt').save(extractedText)
        await collection.doc(videoId).update({
            badDetected: checkTime,
            lastScanned: new Date(),
            scanned: previousScans + 1,
        })
    } else {
        await collection.doc(videoId).update({
            lastScanned: new Date(),
            scanned: previousScans + 1,
        })
    }
}

async function cleanupStoredFiles(videoId) {
    let files = await storage.bucket(bucketName).getFiles({
        prefix: videoId + '/',
    });
    for (let i = 0; i < files.length; i++) {
        await files[i].delete();
    }
}

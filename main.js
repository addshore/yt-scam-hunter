const ytsr = require('ytsr');
const columnify = require('columnify')
const fs = require('fs');
const ytdl = require('ytdl-core');
const tesseract = require("node-tesseract-ocr")

const sleep = require('util').promisify(setTimeout)

/**
 * Searches on YouTube for live streams that look like crypto scams
 */
async function videos() {
    const filters1 = await ytsr.getFilters('"eth" OR "btc"');
    const filter1 = filters1.get('Type').get('Video');
    const filters2 = await ytsr.getFilters(filter1.url);
    const filter2 = filters2.get('Features').get('Live');
    const ytOptions = {
        pages: 10,
      }

    // create an array to store the results
    const results = [];
    const requests = 1;
    var result = await ytsr(filter2.url, ytOptions);
    results.push(...result.items);
    while (result.continuation !== null) {
        requests++;
        result = await ytsr.continueReq(result.continuation);
        results.push(...result.items);
    }

    // Iterate through results, removing some keys from objects
    return await results.map(function(video) {
        return {
            title: video.title,
            url: video.url,
            channel: video.author.name,
            views: video.views,
            description: video.description,
            video: video,
        };
    });
}

/**
 * Downloads a snippet of a current live stream from YouTube
 * Then extracting the first frame from the video
 */
async function videoSnapshots(youtubeVideoId) {
    outputVideo = "./.data/" + youtubeVideoId + ".mp4";
    outputSnap = "./.data/" + youtubeVideoId + ".jpg";
    if (fs.existsSync(outputVideo)) {
        fs.unlinkSync(outputVideo);
    }
    if (fs.existsSync(outputSnap)) {
        fs.unlinkSync(outputSnap);
    }
    var readableStream = ytdl('https://www.youtube.com/watch?v=' + youtubeVideoId, {
        begin : Date.now(),
    })
    readableStream.pipe(fs.createWriteStream(outputVideo));
    // Wait for file to exist on disk
    while (!fs.existsSync(outputVideo)) {
        await sleep(100);
    }
    // wait until file is 1 MB in size
    while (fs.statSync(outputVideo).size < 1000000) {
        await sleep(100)
    }

    readableStream.destroy();
    const extractFrame = require('ffmpeg-extract-frame')
    
    return extractFrame({
        input: outputVideo,
        output: outputSnap,
        offset: 0 // seek offset in milliseconds
      })
}

/**
 * Extract the text from a video snapshot and write it to disk
 */
async function textFromSnapshot(youtubeVideoId) {
    outputSnap = "./.data/" + youtubeVideoId + ".jpg";
    outputText = "./.data/" + youtubeVideoId + ".txt";
    if (fs.existsSync(outputText)) {
        fs.unlinkSync(outputText);
    }

    const tesseractConfig = {
        lang: "eng",
        oem: 1,
        psm: 3,
    }
    return tesseract
        .recognize(outputSnap, tesseractConfig)
        .then((text) => {
            fs.writeFileSync(outputText, text);
        })
        .catch((error) => {
            console.log(error.message)
        })
}

/**
 * Looks for bad strings in the text of the video snapshot
 */
function textIncludesBadStuff(youtubeVideoId) {
    outputTextFile = "./.data/" + youtubeVideoId + ".txt";
    text = fs.readFileSync(outputTextFile, 'utf8');
    badStrings = fs.readFileSync("./badlist.txt", 'utf8');
    badStrings = badStrings.split("\n");
    foundBadStrings = []
    for (i = 0; i < badStrings.length; i++) {
        if (text.includes(badStrings[i])) {
            foundBadStrings.push(badStrings[i]);
        }
    }
    return foundBadStrings
}

// //Tie things together
(async () => {
    console.log("Starting...");
    let videosData = await videos();
    console.log(columnify(videosData, {}))
    console.log("Got " + videosData.length + " videos");
    for (let i = 0; i < videosData.length; i++) {
        let video = videosData[i];
        let youtubeVideoId = video.url.split("=")[1];
        console.log("Processing video " + (i + 1) + " of " + videosData.length);
        fs.writeFileSync("./.data/" + youtubeVideoId + ".json", JSON.stringify(video,null,2));
        await videoSnapshots(youtubeVideoId);
        await textFromSnapshot(youtubeVideoId);
        let badStrings = textIncludesBadStuff(youtubeVideoId);
        if (badStrings.length > 0) {
            console.log(video.url + " has known bad strings:");
            for (let j = 0; j < badStrings.length; j++) {
                console.log(" - \"" + badStrings[j] + "\"");
            }
        }
    }
})()
const ytsr = require('ytsr');
const columnify = require('columnify')
const fs = require('fs');
const os = require("os")
const ytdl = require('ytdl-core');
const extractFrame = require('ffmpeg-extract-frame')
const tesseract = require("node-tesseract-ocr")
const chalk = require('chalk');
const Database = require('st.db');
const sleep = require('util').promisify(setTimeout)

const badDb = new Database({path:'./bad.db.yml'});

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
    let results = [];
    let result = await ytsr(filter2.url, ytOptions);
    results.push(...result.items);
    while (result.continuation !== null) {
        result = await ytsr.continueReq(result.continuation);
        results.push(...result.items);
    }

    // Iterate through results, removing some keys from objects
    return results.map(function(video) {
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

async function processVideo(video) {
    let report = ""
    let youtubeVideoId = video.url.split("=")[1];

    report += "Processed " + video.url + "\n"
    let outputJson = "./.data/" + youtubeVideoId + ".json";
    let outputVideo = "./.data/" + youtubeVideoId + ".mp4";
    let outputSnap = "./.data/" + youtubeVideoId + ".jpg";
    let outputText = "./.data/" + youtubeVideoId + ".txt";
    if (fs.existsSync(outputJson)) {
        fs.unlinkSync(outputJson);
    }
    if (fs.existsSync(outputVideo)) {
        fs.unlinkSync(outputVideo);
    }
    if (fs.existsSync(outputSnap)) {
        fs.unlinkSync(outputSnap);
    }
    if (fs.existsSync(outputText)) {
        fs.unlinkSync(outputText);
    }

    // Write JSON
    fs.writeFileSync(outputJson, JSON.stringify(video,null,2));

    // Check and Write Video
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
        return {
            evilDetected: null,
            log: vidFetchFail,
        }
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
        })

    let foundStuff = await textIncludesBadStuff(extractedText);
    if (foundStuff.length > 0) {
        report += "Detected known bad strings:\n"
        for (let j = 0; j < foundStuff.length; j++) {
            report += " - \"" + foundStuff[j] + "\"\n"
        }
    }
    return {
        evilDetected: foundStuff.length > 0,
        log: report.trim()
    }
}

/**
 * Looks for bad strings in the text of the video snapshot
 */
async function textIncludesBadStuff(text) {
    text = text.toLowerCase();
    let foundBadStuff = []

    let badDomains = await badDb.get("domains")
    for (i = 0; i < badDomains.length; i++) {
        let badDomain = badDomains[i].toLowerCase();
        if (text.includes(badDomain)) {
            foundBadStuff.push(badDomain);
        }
    }

    let badRegex = await badDb.get("regex")
    for (i = 0; i < badRegex.length; i++) {
        let badRegexString = badRegex[i];
        let regex = new RegExp(badRegexString,'i');
        if (text.match(regex)) {
            foundBadStuff.push(badRegexString);
        }
    }

    return foundBadStuff
}

// Tie things together
(async () => {
    console.log("Looking for suspect videos on YouTube...");
    let videosData = await videos();
    console.log(columnify(videosData, {}))
    console.log("Got " + videosData.length + " videos");

    const chunkSize = os.cpus().length;
    console.log("Chunk size: " + chunkSize);

    let badVideos = await badDb.get("videos")
    if (badVideos == undefined) {
        badVideos = []
    }
    // filter out videos that are already detected
    let filteredVideos = videosData.filter(function(video) {
        if( badVideos.includes(video.url) ) {
            console.log(chalk.red("Already detected " + video.url + " as bad (skipping).."))
        }
        return !badVideos.includes(video.url);
    })

    let videoReports = []
    for (let i = 0; i < filteredVideos.length; i += chunkSize) {
        const chunk = filteredVideos.slice(i, i + chunkSize);
        // do a chunk of work
        for (let i = 0; i < chunk.length; i++) {
            let video = chunk[i];
            let videoId = video.url.split("=")[1];
            videoReports[videoId] = processVideo(video);
        }
        for (let i = 0; i < chunk.length; i++) {
            let video = chunk[i];
            let videoId = video.url.split("=")[1];
            
            // Try and process the video :)
            try{
                videoReports[videoId] = await videoReports[videoId]
                if(videoReports[videoId].evilDetected) {
                    // Collect the bad URL...
                    if (!badVideos.includes(video.url)) {
                        badVideos.push(video.url);
                        badDb.push("videos", video.url);
                    }
                    console.log(chalk.red(videoReports[videoId].log))
                } else {
                    console.log(videoReports[videoId].log)
                }
            } catch (error) {
                console.log(error.message)
            }
        }
    }
})()
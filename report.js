const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const Database = require('st.db');

const SCOPES = ['https://www.googleapis.com/auth/youtube'];
const TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
const TOKEN_PATH = TOKEN_DIR + 'yt-scam-hunter.json';
const secrets = JSON.parse(fs.readFileSync('google_client_secret.json'))

// Valid reason codes are more restricted in the API than in the UI?
// https://developers.google.com/youtube/v3/docs/videoAbuseReportReasons/list?apix_params=%7B%22part%22%3A%5B%22id%22%2C%22snippet%22%5D%7D#usage
const topLevelReasonCode = "V"
const subLevelReasonCode = "44"
const reasonComment = "Crypto scam on a likley hijacked account"

const privateDb = new Database({path:'./.private.db.yml'});
const badDb = new Database({path:'./bad.db.yml'});

(async () => {
    let reportedVideos = await privateDb.get("reported-videos")
    if (reportedVideos == undefined) {
        reportedVideos = []
    }
    let badVideos = await badDb.get("videos")
    if (badVideos == undefined) {
        badVideos = []
    }

    let skippedAsDone = 0
    for (let videoUrl of badVideos) {
        if (reportedVideos.includes(videoUrl)) {
            skippedAsDone++
            continue
        }
        reportVideo(videoUrl, function(videoUrl){
            privateDb.push("reported-videos", videoUrl)
        })
    }
    console.log("Skipped " + skippedAsDone + " videos as already reported")
})()

function reportVideo(videoUrl, successCallback) {
    let videoId = videoUrl.split("v=")[1]
    authorize(secrets, function(auth) {
        var yt = google.youtube('v3');
        // https://developers.google.com/youtube/v3/docs/videos/reportAbuse
        yt.videos.reportAbuse({
            auth: auth,
            "resource": {
                videoId: videoId,
                reasonId: topLevelReasonCode,
                secondaryReasonId: subLevelReasonCode,
                comments: reasonComment,
            }
          },function(err, response) {
            if (err) {
              console.log('The API for ' +  videoId+ ' returned an error: ' + err);
              return;
            }
            if( response.status = 204) {
                console.log('Successfully reported: ' + videoId);
                successCallback(videoId)
                return
            }
            console.log("Unknown response for: " + videoId)
            console.log(response)
        })
    });
}

// Everything below here is modified YouTube auth stuff...
// From https://developers.google.com/youtube/v3/quickstart/nodejs

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
 function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var oauth2Client = new OAuth2(clientId, clientSecret, redirectUrl);
  
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
      if (err) {
        getNewToken(oauth2Client, callback);
      } else {
        oauth2Client.credentials = JSON.parse(token);
        callback(oauth2Client);
      }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
 function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter the code from redirect URL here: ', function(code) {
      rl.close();
      oauth2Client.getToken(code, function(err, token) {
        if (err) {
          console.log('Error while trying to retrieve access token', err);
          return;
        }
        oauth2Client.credentials = token;
        storeToken(token);
        callback(oauth2Client);
      });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
 function storeToken(token) {
    try {
      fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
      if (err) throw err;
      console.log('Token stored to ' + TOKEN_PATH);
    });
}
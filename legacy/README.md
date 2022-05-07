# yt-scam-hunter LEGACY proof of concept

There are currently still a set of "manual" scripts in this repository that act as a proof of concept for detection.

 - `ytlive.js`: YouTube live video scam detection
 - `report.js`: Automatically report videos that have been collected
 - `domains.js`: Extract more domains to look for, from video texts
 - `wallets.js`: Extract wallets from domains that appear to be scamming

## Setup

Install the dependencies:

```sh
apt install ffmpeg tesseract-ocr
```

Install the node packages:

```sh
npm install
```

## Usage

There are a few scripts you can run

### YouTube live video scam detection

![](https://i.imgur.com/A9uR5fX.png)
![](https://i.imgur.com/2OR1sr4.png)

```sh
node ytlive.js
```

You'll see a list of videos being searched.
You'll see any that are flagged as bad.
The `bad.db.yml` will be updated

For each video you will keep some files in a `.data` directory:

- JSON hodling the video data
- MP4 snippet of the stream
- JPG frame from the screen
- TXT extracted from the frame

### YouTube live video scam reporting

**WORK IN PROGRESS**

You need to have run the detections script first.
This will populate a list of bad videos in `bad.db.yml`.

You currently also need to have a `google_client_secret.json` for an OAauth client for Google apis.

Then you can run the script

```sh
node report.js
```

This will ask you to login and then report all videos to YouTube with the reason `Violent, hateful, or dangerous > Digital security` (As the API doesnt provide a better choosable reason...)

### New scam domain extraction

As new YouTube videos are detected, the text to them is saved.
This script will look at that text and extract new working domains, which are probably scam links.

![](https://i.imgur.com/ntDMV7M.png)

```sh
node domains.js
```

### Wallet extraction

![](https://i.imgur.com/3xL5XOE.png)

```sh
node wallets.js
```

This will look at the found domains in the `bad.db.yml` and search for wallet addresses.
Wallet addresses will be stored in `bad.db.yml`
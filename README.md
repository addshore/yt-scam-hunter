# yt-scam-hunter

A little app to hunt for crypto scams on YouTube inspired from some [shouting into the void at YouTube](https://twitter.com/addshore/status/1520154767036751873).

If it's this easy to save their users what is most likley millions of USD a month from being scammed, they should really do something...

Hunting works by:

1) Perfoming a YouTube search for live streams, currently looking for `"eth" OR "btc"`
2) Downloading a few seconds of live video from the stream
3) Convert the first frame of that video to an image
4) Extracting text from that image using OCR
5) Checking the text against a [bad word domains & regex](./bad.db.yml) 

![](https://i.imgur.com/A9uR5fX.png)
![](https://i.imgur.com/RI3DpW1.png)

In the future it would be nice to:

- Auto flag to YouTube
- Validate that collected wallet addresses are real? (Remove if not)
- Also report those wallet addresses to somewhere?
- QR code detection? [example](https://i.imgur.com/1jubd7R.png)
- Check live chat messages for text too
- Check description text too?
- Convince YouTube to do a better job?

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

### New scam domain extraction

As new YouTube videos are detected, the text to them is saved.
This script will look at that text and extract new working domains, which are probably scam links.

```sh
node domains.js
```

### Wallet extraction

```sh
node wallets.js
```

This will look at the found domains in the `bad.db.yml` and search for wallet addresses.
Wallet addresses will be stored in `bad.db.yml`
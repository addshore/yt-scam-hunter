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
- Detect fresh scam domains from the text of videos matched
- Validate that collected wallet addresses are real? (Remove if not)
- Also report those wallet addresses to somewhere?
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

Just run the script

```sh
node ytlive.js
```

You'll see output like in the screenshots above.

You'll also start seeing data in a `./.data` directory.

For each video you will keep:

- JSON hodling the video data
- MP4 snippet of the stream
- JPG frame from the screen
- TXT extracted from the frame
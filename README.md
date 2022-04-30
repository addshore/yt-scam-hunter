# yt-scam-hunters

A little app to hunt for crypto scams on YouTube.

It does this by:

1) Perfoming a YouTube search for live streams
2) Downloading a short live video from the stream
3) Using the first frame of that video as an image
4) Extracting text from that image
5) Checking the text against a bad words list

## Requirements

```sh
apt install ffmpeg tesseract-ocr
```
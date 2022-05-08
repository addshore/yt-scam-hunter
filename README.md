# yt-scam-hunter

A little project to hunt for crypto scams on YouTube inspired from some [shouting into the void at YouTube](https://twitter.com/addshore/status/1520154767036751873).

Currently exposed as a few API endpoints.

There is also a currently undeployed UI...

[/streams](https://us-central1-scam-hunter.cloudfunctions.net/streams), Currently live YouTube scam streams

```json
{
    "P-hf0mFA6AI": {
        "id": "P-hf0mFA6AI",
        "url": "https://www.youtube.com/watch?v=P-hf0mFA6AI",
        "times": {
            "firstSeen": "2022-05-06T22:59:02.933Z",
            "badDetected": "2022-05-06T22:59:02.933Z"
        },
        "files": {
            "details": "https://storage.googleapis.com/scam-hunter.appspot.com/P-hf0mFA6AI%2Fvideo.json",
            "snapshot": "https://storage.googleapis.com/scam-hunter.appspot.com/P-hf0mFA6AI%2F2022-05-06T22%3A59%3A02.933Z_snapshot.jpg",
            "text": "https://storage.googleapis.com/scam-hunter.appspot.com/P-hf0mFA6AI%2F2022-05-06T22%3A59%3A02.933Z_text.txt",
            "text-vision": "https://storage.googleapis.com/scam-hunter.appspot.com/P-hf0mFA6AI%2F2022-05-06T22%3A59%3A02.933Z_text-vision.txt",
            "report": "https://storage.googleapis.com/scam-hunter.appspot.com/P-hf0mFA6AI%2F2022-05-06T22%3A59%3A02.933Z_report.txt"
        },
        "domains": {},
        "wallets": {}
    },
}
```

[/domains](https://us-central1-scam-hunter.cloudfunctions.net/domains), Domains involved in scams, extracted from the videos

```json
{
    "elongive22.org": {
        "url": "https://elongive22.org"
    },
    "2binance.net": {
        "url": "https://2binance.net"
    }
}
```


[/wallets](https://us-central1-scam-hunter.cloudfunctions.net/wallets), Wallets involved in scams, extracted from the domains

```json
{
    "btc": {
        "19i77z9gbC6TgUcshneD8UQQUNvaNixchH": {
            "info": "https://blockchain.info/address/19i77z9gbC6TgUcshneD8UQQUNvaNixchH"
        },
        "bc1qpyttdffcce49g9jjrvmeszy877rv7nm32uccma": {
            "info": "https://blockchain.info/address/bc1qpyttdffcce49g9jjrvmeszy877rv7nm32uccma"
        }
    },
    "eth": {
        "0xaCF150b0dd71Fb95b3aF3A9c72Eb22DF3854129D": {
            "info": "https://etherscan.io/address/0xaCF150b0dd71Fb95b3aF3A9c72Eb22DF3854129D"
        },
        "0x04B53383701Ac45737deF9297CD8CC59f5697897": {
            "info": "https://etherscan.io/address/0x04B53383701Ac45737deF9297CD8CC59f5697897"
        }
    }
}
```

## Method

1) Perfoming a YouTube search for live streams, currently looking for `"eth" OR "btc"`
2) Downloading half a second of live video from the stream
3) Convert the first frame of that video to an image
4) Extracting text from that image using OCR
5) Checking the text against a some known bad domains, and regular expressions

In the future it would be nice to:

- Also report those wallet addresses to somewhere?
- Update the ammount of coin in the wallets daily?
- QR code detection? [example](https://i.imgur.com/1jubd7R.png)
- Check live chat messages for text too
- Check description text too?
- Twitter bot to get the word out?
- Convince YouTube to do a better job?

## Development

The project is currently developed using Firebase.

You can find the functions in [./functions]()

![](./docs/overview.drawio.svg)

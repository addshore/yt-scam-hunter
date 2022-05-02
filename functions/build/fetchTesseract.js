const Tesseract = require("tesseract.js");
const fs = require("fs");

(async () => {
  // Force run Terreract once to ensure we have the needed data prior to deploy
  await Tesseract.recognize(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Wikidata-logo-en.svg/320px-Wikidata-logo-en.svg.png",
      "eng",
  );
  if (!fs.existsSync("./eng.traineddata")) {
    throw new Error("No traineddata file found");
  } else {
    console.log("Training data file exists!");
  }
})();

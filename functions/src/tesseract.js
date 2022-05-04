
const Tesseract = require("tesseract.js");
const fs = require("fs");

exports.textFromImage = async function(imagePath) {
  // Move training data into a writable place
  // https://github.com/naptha/tesseract.js/issues/481#issuecomment-705223523
  // TODO maybe only do this if the file doesnt already exist? (Just in case this method is used twice in process)
  fs.copyFileSync("./eng.traineddata", "/tmp/eng.traineddata");

  const tessWorker = Tesseract.createWorker({
    errorHandler: function(err) {
      throw err;
    },
    langPath: "/tmp",
    cacheMethod: "none",
    gzip: false,
  });
  await tessWorker.load();
  await tessWorker.loadLanguage("eng");
  await tessWorker.initialize("eng");
  const {data: {text}} = await tessWorker.recognize(imagePath);
  await tessWorker.terminate();
  return text;
};

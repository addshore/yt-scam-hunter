
const Tesseract = require("tesseract.js");
const fs = require("fs");
const jimp = require("jimp");
const tmp = require("tmp");

exports.textFromImage = async function(imagePath) {
  // Move training data into a writable place
  // https://github.com/naptha/tesseract.js/issues/481#issuecomment-705223523
  // TODO maybe only do this if the file doesnt already exist? (Just in case this method is used twice in process)
  fs.copyFileSync("./eng.traineddata", "/tmp/eng.traineddata");

  // Invert the image colours (as probably we have a colourfull background?)
  const pokedFile = tmp.fileSync();
  const image = await jimp.read(imagePath);
  image.invert();
  image.write(pokedFile.name);

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
  await tessWorker.setParameters({
    tessedit_pageseg_mode: Tesseract.OEM.SPARSE_TEXT,
    tessedit_char_whitelist: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_*.,:;!?()[]{}@$%^&+=|\\/~`'\"#<> ",
  })
  const {data: {text}} = await tessWorker.recognize(pokedFile.name);
  await tessWorker.terminate();
  return text;
};

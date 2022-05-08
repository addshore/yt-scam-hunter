
const TesseractJs = require("tesseract.js");
const {getTextFromImage} = require("@shelf/aws-lambda-tesseract");
const fs = require("fs");
const jimp = require("jimp");
const tmp = require("tmp");

exports.textFromImageAWSCode = async function(imagePath) {
  // Make copy of the snap, just for tesseract
  // As it seems to do something with the file? meaning that we can't later access it...
  const myCopy = tmp.tmpNameSync() + ".jpg";
  fs.copyFileSync(imagePath, myCopy);

  // Also poke the image to make it easier to read?
  const pokedFile = tmp.fileSync();
  const image = await jimp.read(myCopy);
  image.invert();
  image.write(pokedFile.name);

  // And extract text from BOTH!
  const text = ( await getTextFromImage(myCopy) ) + "\n\n---------------------\n\n" + ( await getTextFromImage(pokedFile.name) );
  return text;
};

exports.textFromImageJS = async function(imagePath) {
  // Move training data into a writable place
  // https://github.com/naptha/tesseract.js/issues/481#issuecomment-705223523
  // TODO maybe only do this if the file doesnt already exist? (Just in case this method is used twice in process)
  fs.copyFileSync("./eng.traineddata", "/tmp/eng.traineddata");

  // Invert the image colours (as probably we have a colourfull background?)
  const pokedFile = tmp.fileSync();
  const image = await jimp.read(imagePath);
  image.invert();
  image.write(pokedFile.name);

  const tessWorker = TesseractJs.createWorker({
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
    tessedit_pageseg_mode: TesseractJs.OEM.SPARSE_TEXT,
    tessedit_char_whitelist: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_*.,:;!?()[]{}@$%^&+=|\\/~`'\"#<> ",
  });
  const {data: {text}} = await tessWorker.recognize(pokedFile.name);
  await tessWorker.terminate();
  return text;
};

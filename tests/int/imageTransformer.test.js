const exif = require('exif-parser');
const fs  = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const streamifier = require('streamifier');
const transformer = require('../../utils/imageTransformer');
const chai = require('chai');
const helper = require('../helpers');
chai.should();

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

describe('imageTransformer - verify transformation', () => {
  let tempFilePath;

  before(() => {
    tempFilePath = helper.getTempDir();
  });

  after(() => {
    rimraf.sync(tempFilePath);
  });

  const getTransformStream = async (file, writePath, options, size) => {
    /*
     * For more information about EXIF orientation refer to https://www.impulseadventure.com/photo/exif-orientation.html
     */
    const transform = transformer.getTransformStream(options, size);
    const readPath = path.join(__dirname, file);
    const readBuffer = fs.readFileSync(readPath);
    const readStream = streamifier.createReadStream(new Buffer.from(readBuffer));
    const writeStream = fs.createWriteStream(writePath);

    readStream.pipe(transform).pipe(writeStream);
    await helper.awaitWriteStream(writeStream);
  };

  const getOutExif = async (file, options, size) => {
    const writePath = path.join(tempFilePath, `${Date.now().toString()}.jpg`);

    await getTransformStream(file, writePath, options, size);

    const outParse = exif.create(fs.readFileSync(writePath));
    return outParse.parse();
  };

  it('Transforming from fs create files stream', async () => {
    const readPath = path.join(__dirname, '../assets/corrupt_exif.jpg');
    const readStream = fs.createReadStream(readPath);
    const writePath = path.join(tempFilePath, `${Date.now().toString()}.jpg`);
    const writeStream = fs.createWriteStream(writePath);

    const transform = transformer.getTransformStream();
    readStream.pipe(transform).pipe(writeStream);

    await helper.awaitWriteStream(writeStream);

  });
  it('Verify image resized after transform', async () => {
    const size = {width: getRandomInt(2000)};
    const outExif = await getOutExif('../assets/upsidedown.jpg', null, size);

    outExif.tags.should.be.empty;
    outExif.imageSize.width.should.be.equal(size.width);
  });
  it('Image resized after transform with invalid EXIF', async () => {
    const size = {width: getRandomInt(2000)};
    const outExif = await getOutExif('../assets/corrupt_exif.jpg', null, size);

    outExif.should.exist;
    outExif.tags.should.be.empty;
  });
  it('Image copying metadata (EXIF) to the new image', async () => {
    const options = {withMetadata: true};
    const outExif = await getOutExif('../assets/upsidedown.jpg', options);

    outExif.tags.should.not.be.empty;
  });
  it('Rotate the image per EXIF Orientation', async () => {
    const writePath = path.join(tempFilePath, `${Date.now().toString()}.jpg`);
    const writePath2 = path.join(tempFilePath, `${Date.now().toString() + 1}.jpg`);
    await getTransformStream('../assets/upsidedown.jpg', writePath, {rotate: true}, {width: 100});
    // resize the image again and do not rotate for comparison.
    await getTransformStream('../assets/upsidedown.jpg', writePath2, {rotate: false}, {width: 100});

    const writeBuffer1 = fs.readFileSync(writePath);
    const writeBuffer2 = fs.readFileSync(writePath2);

    writeBuffer1.should.not.eql(writeBuffer2);
  });
  it('Grayscale the image per EXIF Orientation', async () => {
    const writePath = path.join(tempFilePath, `${Date.now().toString()}.jpg`);
    const writePath2 = path.join(tempFilePath, `${Date.now().toString() + 1}.jpg`);
    await getTransformStream('../assets/upsidedown.jpg', writePath, {grayscale: true}, {width: 100});
    // resize the image again and do not rotate for comparison.
    await getTransformStream('../assets/upsidedown.jpg', writePath2, {grayscale: false}, {width: 100});

    const writeBuffer1 = fs.readFileSync(writePath);
    const writeBuffer2 = fs.readFileSync(writePath2);

    writeBuffer1.should.not.eql(writeBuffer2);
  });
  it('Resize image with width and height and preserve the aspect ratio (should be less or equal to provided values)', async () => {
    const size = {width: 200, height: 200, options: {fit: 'inside'}};
    const outExif = await getOutExif('../assets/upsidedown.jpg', null, size);

    const inParse = exif.create(fs.readFileSync(path.join(__dirname, '../assets/upsidedown.jpg')));
    const inExif = inParse.parse();
    const ratio = inExif.imageSize.height/inExif.imageSize.width;

    outExif.imageSize.width.should.be.equal(size.width);
    outExif.imageSize.height.should.be.equal(size.height*ratio);
  });
  it('Resize image with width and height and preserve the aspect ratio (should be greater or equal to provided values)', async () => {
    const size = {width: 200, height: 200, options: {fit: 'outside'}};
    const outExif = await getOutExif('../assets/upsidedown.jpg', null, size);

    const inParse = exif.create(fs.readFileSync(path.join(__dirname, '../assets/upsidedown.jpg')));
    const inExif = inParse.parse();
    const ratio = inExif.imageSize.width/inExif.imageSize.height;

    outExif.imageSize.width.should.be.equal(Math.round(size.width*ratio));
    outExif.imageSize.height.should.be.equal(size.height);
  });
  it('Resize image with width and height and preserve the aspect ratio via the global fit \'inside\' option', async () => {
    const size = {width: 200, height: 200};
    const outExif = await getOutExif('../assets/upsidedown.jpg', {fit:'inside'}, size);

    const inParse = exif.create(fs.readFileSync(path.join(__dirname, '../assets/upsidedown.jpg')));
    const inExif = inParse.parse();
    const ratio = inExif.imageSize.height/inExif.imageSize.width;

    outExif.imageSize.width.should.be.equal(size.width);
    outExif.imageSize.height.should.be.equal(size.height*ratio);
  });
  it('Resize image with width and height and preserve the aspect ratio  via the global fit \'output\' option', async () => {
    const size = {width: 200, height: 200};
    const outExif = await getOutExif('../assets/upsidedown.jpg', {fit: 'outside'}, size);

    const inParse = exif.create(fs.readFileSync(path.join(__dirname, '../assets/upsidedown.jpg')));
    const inExif = inParse.parse();
    const ratio = inExif.imageSize.width/inExif.imageSize.height;

    outExif.imageSize.width.should.be.equal(Math.round(size.width*ratio));
    outExif.imageSize.height.should.be.equal(size.height);
  });
  it('Convert image to WebP', async () => {
    const imageType = require('image-type');
    const readChunk = require('read-chunk');
    const writePath = path.join(tempFilePath, `${Date.now().toString()}.webp`);
    await getTransformStream('../assets/corrupt_exif.jpg', writePath, {webP: true});

    const writeBuffer = readChunk.sync(writePath, 0, 12);
    const type = imageType(writeBuffer);
    type.ext.should.equal('webp');
    type.mime.should.equal('image/webp');
  });
});
describe.skip('Sandbox for transforming images', () => {
  const tempFilePath = helper.getTempDir();

  it('create a really really big image', async () => {
    const size = {width: 10000};
    const transform = transformer.getTransformStream(null, size);
    const readPath = path.join(__dirname, '../assets/corrupt_exif.jpg');
    const writePath = path.join(tempFilePath, `${Date.now().toString()}.jpg`);
    const readStream = fs.createReadStream(readPath);
    const writeStream = fs.createWriteStream(writePath);

    readStream.pipe(transform).pipe(writeStream);
    await helper.awaitWriteStream(writeStream);
  });
});

const isStream = require('is-stream');
const transformer = require('../../../utils/imageTransformer');
const chai = require('chai');
chai.should();

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

describe('imageTransformer', () => {
  it('Getting an image transform stream', () => {
    const stream = transformer.getTransformStream();

    isStream.duplex(stream).should.be.true;
  });
  it('Providing option for rotating an image being streamed', () => {
    const stream = transformer.getTransformStream({rotate: true}, null);

    stream.options.useExifOrientation.should.be.true;
  });
  it('Providing option for default rotating option', () => {
    const stream = transformer.getTransformStream();

    stream.options.useExifOrientation.should.be.false;
  });
  it('Provide options for grayscaling the image being streamed', () => {
    const stream = transformer.getTransformStream({grayscale: true}, null);

    stream.options.greyscale.should.be.true;
  });
  it('Provide options for default grayscaling', () => {
    const stream = transformer.getTransformStream();

    stream.options.greyscale.should.be.false;
  });
  it('Provide options for webP the image being streamed', () => {
    const stream = transformer.getTransformStream({webP: true}, null);

    stream.options.formatOut.should.equal('webp');
  });
  it('Provide options for default webP', () => {
    const stream = transformer.getTransformStream();

    stream.options.formatOut.should.equal('input');
  });
  it('Provide options for withMetadata (EXIF) image stream', () => {
    const stream = transformer.getTransformStream({withMetadata: true}, null);

    stream.options.withMetadata.should.be.true;
  });
  it('Provide options for default metadata', () => {
    const stream = transformer.getTransformStream();

    stream.options.withMetadata.should.be.false;
  });
  it('Providing empty resize object', () => {
    const stream = transformer.getTransformStream(null, {});

    stream.options.width.should.be.equal(-1);
    stream.options.height.should.be.equal(-1);
  });
  it('Providing resize option w/ width to the image steam', () => {
    const expectedWidth = getRandomInt(20000);
    const stream = transformer.getTransformStream(null, {width: expectedWidth});

    stream.options.width.should.be.equal(expectedWidth);
    stream.options.height.should.be.equal(-1);
  });
  it('Providing resize option w/ height to the image steam', () => {
    const expectedHeight = getRandomInt(20000);
    const stream = transformer.getTransformStream(null, {height: expectedHeight});

    stream.options.height.should.be.equal(expectedHeight);
    stream.options.width.should.be.equal(-1);
  });
  it('Providing both width and height to the image stream', () => {
    const expectedHeight = getRandomInt(20000);
    const expectedWidth = getRandomInt(20000);
    const stream = transformer.getTransformStream(null, {width: expectedWidth, height: expectedHeight});

    stream.options.width.should.be.equal(expectedWidth);
    stream.options.height.should.be.equal(expectedHeight);
  });
  it('Providing a bad width to the image stream', () => {
    (() => transformer.getTransformStream(null, {width: 'test'})).should.throw();
  });
  it('Providing a bad hight to the image stream', () => {
    (() => transformer.getTransformStream(null, {height: 'test'})).should.throw();
  });
  it('Providing resize fit option to the image stream', () => {
    const expectedFit = 'contain';
    const stream = transformer.getTransformStream(null, {options: {fit: expectedFit}});

    stream.options.canvas.should.equal('embed');
  });
});

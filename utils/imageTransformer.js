'use strict';
const sharp = require('sharp');

/**
 * Transforms an image to the given size
 * @param {Object} options
 * @param {Object[]} sizes
 * @param {number} sizes[].width - positive number
 * @param {number} sizes[].height - positive number
 * @param {Object} sizes[].options - resize options found in
 * {@link https://sharp.dimens.io/en/stable/api-resize/|sharp resize docs}
 * @param {'cover'|'contain'|'fill'|'inside'|'outside'} sizes[].options.fit
 * @param {'string'} sizes[].options.position - strategy to use when fit is cover or contain
 */
const imageTransform = (options, size) => {
  if (!options) options = {};
  if (!size) size = {};
  if (options.fit) {
    size.options = {fit: options.fit};
  }
  const imagePipeline = sharp();

  if (options.rotate){
    imagePipeline.rotate();
  }
  if(options.grayscale){
    imagePipeline.grayscale();
  }
  if(options.withMetadata){
    imagePipeline.withMetadata();
  }
  if(size){
    imagePipeline.resize(size.width, size.height, size.options);
  }
  if(options.webP){
    imagePipeline.webp();
  }

  return imagePipeline;
};

const validateFitType = (fit)  => fit.match(/^(cover|contain|fill|inside|outside)$/);

module.exports = {
  getTransformStream: imageTransform,
  validateFitType
};

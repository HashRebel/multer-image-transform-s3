'use strict';

// Should import services and libs
const path = require('path');
const defaultOptions = require('./config/defaults');
const transformer = require('./utils/imageTransformer');
const fileHelper = require('./utils/fileHelper');
const awsHelper = require('./utils/awsHelper');
// In the case where we are creating multiple write streams (for webp and resizing) the event
// emitter can cause a warning for having to many emitters. If we are resizing more then 4 and
// creating webPs a warning will be generated. Set the event emitter threshold higher to avoid.
require('events').EventEmitter.defaultMaxListeners = 25;

const DEFAULT_FILE_TYPE = 'original';

/**
 * @typedef {import('aws-sdk').S3} S3
 */

/***
 * class for managing the transformation and storage of images from the
 * multer file stream. Images will be stored into
 */
class ImageStorageEngine {
  /**
   * Constructor
   * @param {S3} s3 - S3 AWS SDK
   * @param {Object} options - options for transforming and saving the image
   * @param {string} cdn the cdn hostname. Provide only in the case we need to override the base
   * URL to point to a CDN.
   * @param {bool} [options.webP=false] - saves webP version of each file generated (requires sizes
   * to be provided)
   * @param {'cover'|'contain'|'fill'|'inside'|'outside'} [options.fit=outside] - optional parameter
   * for overriding the global resize fit. Only applies if options.sizes is provided.
   * @param {Object[]} [options.sizes=[]] - an array of sizes used to create and save multiple
   * version of the image (to save the ordinal size add a empty object {} to the array)
   * @param {string} options.sizes[].name the name of the size (gets added to file name as
   * suffix. e.g. example.jpg => example_{name}.jpg)
   * @param {number} sizes[].width - positive number
   * @param {number} sizes[].height - positive number
   * @param {Object} sizes[].options - resize options found in
   * {@link https://sharp.dimens.io/en/stable/api-resize/|sharp resize docs}
   * @param {'cover'|'contain'|'fill'|'inside'|'outside'} sizes[].options.fit - overrides global
   * fit type if one is provided.
   * @param {'string'} sizes[].options.position - strategy to use when fit is cover or contain
   *
   */
  constructor(s3, options) {
    options = options ? options : {};
    if(!s3 && typeof s3 !== 'object'){
      throw new Error('aws-sdk#S3 is a required parameter');
    }
    if(options.sizes && !Array.isArray(options.sizes)){
      throw new Error('If sizes is provided it must be an array of objects');
    }
    if(options.fit && !transformer.validateFitType(options.fit)){
      throw new Error('Invalid fit (cover|contain|fill|inside|outside)');
    }

    options.bucket = options.bucket || process.env.S3_BUCKET;
    options.s3Path = options.s3Path || process.env.S3_PATH || '';
    options.cdn = options.cdn || process.env.CDN_HOST || '';

    this.s3 = s3;
    // Merge the options
    this.options = Object.assign({}, defaultOptions, options);

    if(!this.options.bucket){
      throw new Error('A valid bucket must be provided through options or env.S3_BUCKET');
    }

    // Create map to track in flight files in order ot know what to remove from the database
    // if an error occurs
    this.fileMap = {};
  }

  transformAndUpload(params, options, fileStream, fileInfo, filename, size){
    params.Key = path.join(options.s3Path, filename);
    const upload = awsHelper.getUploadWriteStream(this.s3, params);
    fileInfo.push({
      name: filename,
      type: size.name ? size.name : DEFAULT_FILE_TYPE,
      promise: upload.promise
    });

    fileStream
      .pipe(transformer.getTransformStream(options, size))
      .on('error', (err) => {throw err;})
      .pipe(upload.writeStream)
      .on('error', (err) => {throw err;});
  }

  _handleFile (req, file, cb) {
    fileHelper.getName(req, file, async (err, filename) => {
      if (err) return cb(err);
      const originalName = file.originalname;

      // Create record in the map to keep track incase a failure occurs
      this.fileMap[originalName] = [];

      const fileInfo = [];
      const files = [];
      const params = {
        Bucket: this.options.bucket,
        ACL: this.options.acl
      };

      try{
        if(this.options.sizes.length > 0){
          this.options.sizes.forEach((size) => {
            let newFilename = fileHelper.addSuffix(filename, size.name);
            this.fileMap[originalName].push(newFilename);
            this.transformAndUpload(
              params,
              this.options,
              file.stream,
              fileInfo,
              newFilename,
              size);

            if(this.options.webP || size.webP){
              const webPFilename = fileHelper.updateExtension(filename, 'webp');
              newFilename = fileHelper.addSuffix(webPFilename, size.name);
              this.fileMap[originalName].push(newFilename);
              this.transformAndUpload(
                params,
                {webP: true, ...this.options},
                file.stream,
                fileInfo,
                newFilename,
                size);
            }
          });
        }

        const data = await Promise.all(fileInfo.map((file) => file.promise));
        fileInfo.forEach((file, i) => {
          const url = this.options.cdn && this.options.cdn.length > 0 ?
            path.join(this.options.cdn, this.options.s3Path, filename) :
            data[i].Location;
          files.push({
            eTag: data[i].ETag.replace(/['"]+/g, ''),
            name: file.name,
            type: file.type,
            url
          });
        });

      }catch(err){
        cb(err);
        return;
      }

      delete this.fileMap[originalName];

      cb(null, {
        files
      });
    });
  }

  async _removeFile (req, file, cb) {
    const originalName = file.originalname;
    if(!this.fileMap[originalName]) {
      cb(null, true);
      return;
    }

    // Deep copy the files to delete and remove in case an error occurs while deleting.
    const filesToDelete = Array.from(this.fileMap[originalName]);
    delete this.fileMap[originalName];

    if(filesToDelete.length > 0){
      const promises =  [];
      const params = {
        Bucket: process.env.S3_BUCKET,
      };

      try{
        filesToDelete.forEach((filename) => {
          params.Key = path.join(this.options.s3Path, filename);
          promises.push(awsHelper.removeAsync(this.s3, params));
        });

        const data = await Promise.all(promises);
        cb(null, data);
      } catch(err){
        cb(err);
      }
    }
  }
}

module.exports = function (s3, opts) {
  return new ImageStorageEngine(s3, opts);
};

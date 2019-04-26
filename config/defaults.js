'use strict';
/**
 * Default configuration for the multer image processor
 * @param acl Access Level Control defined by AWS S3
 * {@link https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html#canned-acl|ACL Access}
 *
 */
module.exports = {
  acl: 'public-read',
  rotate: true,
  webP: false,
  fit:'outside',
  sizes: [{}], // forces to default to the original size
  bucket: process.env.S3_BUCKET
};

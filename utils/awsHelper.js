const stream = require('stream');

const getUploadWriteStream = (s3, params) => {
  if(!params || (params && (!params.Bucket || !params.Key || !params.ACL))){
    throw new Error('Params are required (i.e. {Bucket:{bucket},Key:{key},ACL:{acl})');
  }
  if(!s3 || typeof s3 !== 'object'){
    throw new Error('aws-sdk.S3 is a required paramter');
  }
  const pass = new stream.PassThrough();

  params.Body = pass;
  return {
    writeStream: pass,
    promise: s3.upload(params).promise()
  };
};

const removeAsync = (s3, params) => {
  return s3.deleteObject(params).promise();
};

module.exports = {
  getUploadWriteStream,
  removeAsync
};

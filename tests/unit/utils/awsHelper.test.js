const helper = require('../../../utils/awsHelper');
const isStream = require('is-stream');
const Aws = require('aws-sdk');
const sandbox = require('sinon').createSandbox();
const chai = require('chai');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
chai.use(sinonChai);
chai.should();

describe('awsHelper', () => {
  const expectedError = new Error('error......');
  const expectedResult = 'Yay!';
  const s3 = new Aws.S3;
  const paramsSuccess = {
    Bucket:'bucket',
    Key:'filename',
    ACL:'private'
  };
  const paramsError = {
    Bucket:'error',
    Key:'error',
    ACL:'error'
  };

  before(() => {
    const s3Stub = sandbox.stub(s3, 'upload');
    s3Stub.withArgs(sandbox.match((value) => {
      return value.Bucket === paramsError.Bucket;
    })).returns({
      promise: () => Promise.reject(expectedError)
    });
    s3Stub.withArgs(sandbox.match((value) => {
      return value.Bucket === paramsSuccess.Bucket;
    })).returns({
      promise: () => Promise.resolve(expectedResult)
    });
  });

  after(() => {
    sandbox.restore();
  });

  it('Pass in invalid params object', () => {
    (() => helper.getUploadWriteStream(s3, null)).should.throw('Params are required (i.e. {Bucket:{bucket},Key:{key},ACL:{acl})');
  });
  it('Pass in invalid params object', () => {
    (() => helper.getUploadWriteStream(s3, {})).should.throw('Params are required (i.e. {Bucket:{bucket},Key:{key},ACL:{acl})');
  });
  it('Pass in invalid params object', () => {
    (() => helper.getUploadWriteStream(s3, {Bucket:'test'})).should.throw('Params are required (i.e. {Bucket:{bucket},Key:{key},ACL:{acl})');
  });
  it('Pass in invalid params object', () => {
    (() => helper.getUploadWriteStream(s3, {Bucket:'test', ACL:'test'})).should.throw('Params are required (i.e. {Bucket:{bucket},Key:{key},ACL:{acl})');
  });
  it('Pass in invalid s3 object', () => {
    (() => helper.getUploadWriteStream()).should.throw();
  });
  it('S3 upload failure', async () => {
    const s3Upload = helper.getUploadWriteStream(s3, paramsError);
    await s3Upload.promise.should.be.rejectedWith(expectedError);
  });
  it('Get aws S3 upload stream on finish writeStream', () => {
    const s3Upload = helper.getUploadWriteStream(s3, paramsSuccess);
    s3Upload.promise.should.eventually.equal(expectedResult);
  });
  it('Get aws S3 upload writeStream', () => {
    const s3Upload = helper.getUploadWriteStream(s3, paramsSuccess);
    isStream(s3Upload.writeStream).should.be.true;
  });
});

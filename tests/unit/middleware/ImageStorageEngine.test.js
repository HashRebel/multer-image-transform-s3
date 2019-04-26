const chai = require('chai');
const Aws = require('aws-sdk');
const util = require('util');
const path = require('path');
const stream = require('stream');
const sinonChai = require('sinon-chai');
const ImageStorageEngine = require('../../../');
const fileHelper = require('../../../utils/fileHelper');
const awsHelper = require('../../../utils/awsHelper');
const sandbox = require('sinon').createSandbox();
const should = chai.should();
require('dotenv').config();
chai.use(sinonChai);

describe('ImageStorageEngine constructor', () => {
  const env = Object.assign({}, process.env);
  let defaultOptions = require('../../../config/defaults');
  let saveDefaults = defaultOptions;
  let s3;
  beforeEach(() => {
    s3 = new Aws.S3;
    process.env.S3_BUCKET = 'test_bucket';
  });

  afterEach(() => {
    process.env = env;
    defaultOptions = saveDefaults;
  });

  it('Constructing the object', () => {
    const expectedValue = {testing: 'test'};
    const storageEngine = ImageStorageEngine(s3, expectedValue);
    storageEngine.options.should.include(expectedValue);
  });
  it('Merging options w/o collision', () => {
    defaultOptions.bucket = process.env.S3_BUCKET;
    const expectedValue = {testing: 'test'};
    const storageEngine = ImageStorageEngine(s3, expectedValue);
    defaultOptions.testing = 'test';
    storageEngine.options.should.include(defaultOptions);
  });
  it('Merging options w/ collision', () => {
    const expectedValue = {acl: 'test'};
    const storageEngine = ImageStorageEngine(s3, expectedValue);

    storageEngine.options.should.deep.include(expectedValue);
  });
  it('Merging options sizes not an array', () => {
    const expectedValue = {sizes: 'test'};
    (() => ImageStorageEngine(s3, expectedValue)).should.throw();
  });
  it('Merging options sizes valid array', () => {
    const expectedValue = {sizes: []};
    const storageEngine = ImageStorageEngine(s3, expectedValue);

    storageEngine.options.should.deep.include(expectedValue);
  });
  it('Constructing with cdn override from env', () => {
    process.env = {CDN_HOST: 'http://testing.com', S3_BUCKET: 'test'};
    const engine = ImageStorageEngine(s3);
    engine.options.cdn.should.be.equal(process.env.CDN_HOST);
  });
  it('Constructing without cdn overrides', () => {
    const engine = ImageStorageEngine(s3);
    engine.options.cdn.should.be.equal('');
  });
  it('Constructing with cdn option overrides', () => {
    process.env = {CDN_HOST: 'badhost', S3_BUCKET: 'test'};
    const cdn = 'http://testing.com';
    const engine = ImageStorageEngine(s3, {cdn});
    engine.options.cdn.should.be.equal(cdn);
  });
  it('Constructing with new bucket from env', () => {
    const engine = ImageStorageEngine(s3);
    engine.options.bucket.should.be.equal(process.env.S3_BUCKET);
  });
  it('Constructing with default and no bucket in env', () => {
    process.env = {};
    (() => ImageStorageEngine(s3)).should.throw();
  });
  it('Constructing with an override bucket', () => {
    const bucket = 'bucket';
    const engine = ImageStorageEngine(s3, {bucket});
    engine.options.bucket.should.be.equal(bucket);
  });
  it('Constructing with new s3 path from env', () => {
    process.env = {S3_BUCKET: 'test-bucket', S3_PATH: 'test-path'}
    const engine = ImageStorageEngine(s3);
    engine.options.s3Path.should.be.equal(process.env.S3_PATH);
  });
  it('Constructing with an override s3 path', () => {
    const path = 'path';
    const engine = ImageStorageEngine(s3, {s3Path: path});
    engine.options.s3Path.should.be.equal(path);
  });
  it('Constructing with default s3 path', () => {
    process.env = {S3_BUCKET: 'test'};
    const engine = ImageStorageEngine(s3);
    engine.options.s3Path.should.be.equal('');
  });
  it('Constructing with defaults.', () => {
    const storage = ImageStorageEngine(s3);
    storage.options.rotate.should.equal(defaultOptions.rotate);
    storage.options.sizes.should.equal(defaultOptions.sizes);
    storage.options.acl.should.equal(defaultOptions.acl);
    storage.options.webP.should.equal(defaultOptions.webP);
    storage.options.fit.should.be.equal(defaultOptions.fit);
  });
  it('Constructing with global fit override.', () => {
    const storageEngine = ImageStorageEngine(s3, {fit: 'inside'});
    storageEngine.options.fit.should.equal('inside');
  });
  it('Constructing with invalid global fit override.', () => {
    (() => ImageStorageEngine(s3, {fit: 'test'})).should.throw();
  });
  it('Constructing with override webP.', () => {
    const storageEngine = ImageStorageEngine(s3, {webP: true});
    storageEngine.options.webP.should.be.true;
  });
  it('Constructing without s3', () => {
    (() => ImageStorageEngine()).should.throw();
  });
  it('Constructing with s3', () => {
    const s3 = new Aws.S3;
    const storageEngine = ImageStorageEngine(s3);
    storageEngine.s3.should.equal(s3);
  });
});

describe('ImageStorageEngine _handleFile', () => {
  const transformer = require('../../../utils/imageTransformer');
  const generalError = new Error('general error');
  const forceTransform = { force: true  };
  const forceUploadFail = 'error-upload';
  const forceGetUploadException = 'error-get-upload';
  const forceUploadSuccess = 'success';
  const generalS3Response = {
    ETag: 'e-tag',
    Location: 'http://this-is-a-url.com/filename.jpg'
  };

  let filename;
  let fileInput;
  let s3;
  let getUpload;
  let readStream;
  let transformToPeriodStream;
  let transformPassStream;
  let writeStream;
  let successPromise;
  let fileOutput;

  beforeEach(() => {
    s3 = new Aws.S3;
    filename = `${Date.now().toString()}.jpg`;
    sandbox.stub(fileHelper, 'getName').yields(null, filename);
    getUpload = sandbox.stub(awsHelper, 'getUploadWriteStream');

    // Setting up a fake file stream to read from
    readStream = new stream.Readable({
      read(){}
    });
    fileInput = {stream: readStream, originalname: 'original-file-name.jpg' };

    // Setup write stream and upload promise
    fileOutput = '';
    writeStream = new stream.Writable({
      write(chunk, _, callback) {
        fileOutput += chunk;
        callback();
      }
    });

    let successResolve = {};
    successPromise = new Promise((resolve, reject) => successResolve = {resolve, reject});
    getUpload.withArgs(sandbox.match.object, sandbox.match({Bucket: forceUploadSuccess})).returns({
      writeStream,
      promise: successPromise
    });

    writeStream.on('finish', () => {
      successResolve.resolve(generalS3Response);
    });

    // Setup failure case for getting s3Uploads
    getUpload.withArgs(sandbox.match.object, sandbox.match({Bucket: forceGetUploadException})).throws(generalError);

    // Setup transform tests
    transformPassStream = new stream.Transform({
      transform(chunk, _, done){
        done(null, chunk);
      }
    });
    transformToPeriodStream = new stream.Transform({
      transform(chunk, _, done){

        done(null, '.');
      }
    });
    transformPassStream.force = false;
    transformToPeriodStream.force = true;

    const transformStub = sandbox.stub(transformer, 'getTransformStream');
    transformStub.withArgs(sandbox.match.object, sandbox.match.object).returns(transformPassStream);
    transformStub.withArgs(sandbox.match(forceTransform), sandbox.match.object).returns(transformToPeriodStream);

  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Failed to get filename', (done) => {
    const storageEngine = ImageStorageEngine(s3);
    fileHelper.getName.restore();
    sandbox.stub(fileHelper, 'getName').yields(generalError);

    storageEngine._handleFile(null, null, (err) => {
      try{
        err.should.equal(generalError);
        done();
      } catch(err) {done(err);}
    });
  });
  it('Failed to get filename as async', async () => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadFail});
    fileHelper.getName.restore();
    sandbox.stub(fileHelper, 'getName').yields(generalError);

    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));
    try{
      await handleFileAsync(null, null);
    }
    catch(err){
      err.should.equal(generalError);
    }
  });
  it('Handel saving only the original file', (done) => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess});

    readStream.push(null);
    storageEngine._handleFile(null, fileInput, (err, data) => {
      try{
        should.not.exist(err);
        data.files[0].name.should.equal(filename);
        data.files[0].type.should.equal('original');
        data.files[0].url.should.equal(generalS3Response.Location);
        data.files[0].eTag.should.equal(generalS3Response.ETag);
        done();
      } catch(err) {done(err);}
    });
  });
  it('Returns the filename for single file upload - async', async () => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    readStream.push(null);
    const data = await handleFileAsync(null, fileInput);
    data.files[0].name.should.equal(filename);
    data.files[0].url.should.equal(generalS3Response.Location);
    data.files[0].eTag.should.equal(generalS3Response.ETag);
  });
  it('Returns CDN override version of the URL', async () => {
    const cdn = 'https://cdns-are-dope.com';
    const s3Path ='/testing/path/';
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, s3Path, cdn});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    readStream.push(null);
    const data = await handleFileAsync(null, fileInput);
    data.files[0].url.should.equal(path.join(cdn, s3Path, filename));
  });
  it('Fails getting s3 upload writeStream and promise', (done) => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceGetUploadException});

    storageEngine._handleFile(null, fileInput, (err) => {
      err.should.equal(generalError);
      done();
    });
  });
  it('S3 upload promise failure.', (done) => {
    getUpload.withArgs(sandbox.match.object, sandbox.match({Bucket: forceUploadFail})).returns({
      writeStream,
      promise: Promise.reject(generalError)
    });
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadFail});

    storageEngine._handleFile(null, fileInput, (err) => {
      try{
        err.should.equal(generalError);
        done();
      }catch(err) {done(err);}
    });
  });
  it('Handel no image transformations or saving the original', async () => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, sizes:[]});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    readStream.push(null);
    const data = await handleFileAsync(null, fileInput);
    data.files.should.be.empty;
  });
  it('Handle saving one resize', async () => {
    const sizes = [
      {width: 100}
    ];

    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, sizes});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    readStream.push(null);
    const data = await handleFileAsync(null, fileInput);
    data.files[0].name.should.equal(filename);
  });
  it('Returns the filenames for multiple file and locations size w/o original size', async () => {
    const fileParts = filename.split('.');
    const expectedFilename = fileParts[0];
    const fileExtension = fileParts[1];
    const sizes = [
      {},
      {name: 'test1', width: 100},
      {name: 'test2', width: 200},
      {name: 'test3', width: 300},
      {name: 'test4', width: 300},
      {name: 'test5', width: 300}
    ];

    readStream.push(null);
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, sizes});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    const data = await handleFileAsync(null, fileInput);
    data.files.length.should.equal(sizes.length);
    data.files[0].name.should.equal(filename);
    data.files[0].type.should.equal('original');
    for(let i=1; i< data.files.length; i++) {
      const filenameWithSuffix = expectedFilename + '_' + sizes[i].name + '.' + fileExtension;
      data.files[i].name.should.equal(filenameWithSuffix);
      data.files[i].type.should.equal(sizes[i].name);
    }
  });
  it('Returns the filenames for multiple file and locations size w/o original size', async () => {
    const fileParts = filename.split('.');
    const expectedFilename = fileParts[0];
    const fileExtension = fileParts[1];
    const sizes = [
      {},
      {name: 'test1', width: 100},
      {name: 'test2', width: 200},
      {name: 'test2', width: 300}
    ];

    readStream.push(null);
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, sizes});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    const data = await handleFileAsync(null, fileInput);
    data.files.length.should.equal(sizes.length);
    data.files[0].name.should.equal(filename);
    for(let i=1; i< data.files.length; i++) {
      const filenameWithSuffix = expectedFilename + '_' + sizes[i].name + '.' + fileExtension;
      data.files[i].name.should.equal(filenameWithSuffix);
    }
  });
  it('Handle saving only the original image in WebP format', async () => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, webP: true});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    readStream.push(null);
    const data = await handleFileAsync(null, fileInput);
    data.files.should.not.be.empty;
    data.files[0].name.should.equal(filename);
    data.files[1].name.should.equal(filename.split('.')[0] + '.' + 'webp');
  });
  it('Returns the filenames for multiple file size w/ WebP versions', async () => {
    const fileParts = filename.split('.');
    const expectedFilename = fileParts[0];
    const fileExtension = fileParts[1];
    const sizes = [
      {},
      {name: 'test1', width: 100},
      {name: 'test2', width: 200},
    ];

    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, sizes, webP: true});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    readStream.push(null);
    const data = await handleFileAsync(null, fileInput);
    data.files.length.should.equal(sizes.length*2);
    data.files[0].name.should.equal(filename);
    data.files[1].name.should.equal(filename.split('.')[0] + '.' + 'webp');
    for(let i=2,j=1; i< data.files.length; i+=2, j++) {
      const filenameWithSuffix = expectedFilename + '_' + sizes[j].name + '.' + fileExtension;
      const webpNameWithSuffix = expectedFilename + '_' + sizes[j].name + '.webp';
      data.files[i].name.should.equal(filenameWithSuffix);
      data.files[i+1].name.should.equal(webpNameWithSuffix);
    }
  });
  it('Returns the filenames for multiple file size w/ WebP versions on some', async () => {
    const fileParts = filename.split('.');
    const expectedFilename = fileParts[0];
    const fileExtension = fileParts[1];
    const sizes = [
      {name: 'original' },
      {name: 'test1', width: 100},
      {name: 'test2', width: 200, webP: true},
    ];

    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, sizes});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    readStream.push(null);
    const data = await handleFileAsync(null, fileInput);
    data.files.length.should.equal(sizes.length+1);
    for(let i=0; i< sizes.length+1; i++) {
      const filenameWithSuffix = expectedFilename + '_' + sizes[i].name + '.' + fileExtension;
      data.files[i].name.should.equal(filenameWithSuffix);
      if(sizes[i].webP)
      {
        const webpNameWithSuffix = expectedFilename + '_' + sizes[i].name + '.webp';
        data.files[++i].name.should.equal(webpNameWithSuffix);
      }
    }
  });
  it('Multiple uploads should return different urls and etags', async () => {
    const sizes = [
      {name: 'test1', width: 100},
      {name: 'test2', width: 200},
    ];

    const secondS3Response = {
      ETag: 'second-e-tag',
      Location: 'second-http://this-is-a-url.com/filename.jpg'
    };

    const writeStreamSecond = new stream.Writable({
      write(chunk, _, callback) {
        callback();
      }
    });

    let successResolveSecond = {};
    const successPromiseSecond = new Promise((resolve, reject) => successResolveSecond = {resolve, reject});
    getUpload.restore();
    getUpload = sandbox.stub(awsHelper, 'getUploadWriteStream');
    getUpload.onCall(0).returns({
      writeStream,
      promise: successPromise
    });
    getUpload.onCall(1).returns({
      writeStream: writeStreamSecond,
      promise: successPromiseSecond
    });
    writeStreamSecond.on('finish', () => {
      successResolveSecond.resolve(secondS3Response);
    });

    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, sizes});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));

    readStream.push(null);
    const data = await handleFileAsync(null, fileInput);
    data.files.length.should.equal(sizes.length);
    data.files[0].url.should.equal(generalS3Response.Location);
    data.files[0].eTag.should.equal(generalS3Response.ETag);
    data.files[1].url.should.equal(secondS3Response.Location);
    data.files[1].eTag.should.equal(secondS3Response.ETag);
  });
  it('Read stream data passed to the write stream', async () => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));
    const readData = 'I\'ve got a bad feeling about this...';

    readStream.push(readData);
    readStream.push(null);
    await handleFileAsync(null, fileInput);
    fileOutput.should.equal(readData);
  });
  it('Transforming read stream and verify the write stream ', async () => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, ...forceTransform});
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));
    const readData = 'I\'ve got a bad feeling about this...';

    readStream.push(readData);
    readStream.push(readData);
    readStream.push(readData);
    readStream.push(null);
    await handleFileAsync(null, fileInput);
    fileOutput.should.equal('...');
  });
  it('updateExtension throws an exception', async () => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess, webP: true});
    sandbox.stub(fileHelper, 'updateExtension').throws(generalError);
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));
    try{
      await handleFileAsync(null, fileInput);
    }catch(err){
      err.should.equal(generalError);
    }
  });
  it('addSuffix throws an exception', async () => {
    const storageEngine = ImageStorageEngine(s3, {bucket: forceUploadSuccess});
    sandbox.stub(fileHelper, 'addSuffix').throws(generalError);
    const handleFileAsync = util.promisify(storageEngine._handleFile.bind(storageEngine));
    try{
      await handleFileAsync(null, fileInput);
    }catch(err){
      err.should.equal(generalError);
    }
  });
  it('Collect S3 upload keys and verify path/filename', async () => {
    const sizes = [
      {},
      {name: 'test1', width: 100},
      {name: 'test2', width: 200},
      {name: 'test2', width: 300}
    ];
    const pathTest = 'testing-path';
    const engine = ImageStorageEngine(s3, {sizes, path: pathTest, webP: true});
    const handleFileAsync = util.promisify(engine._handleFile.bind(engine));

    const uploadFake = sandbox.fake.returns({
      writeStream,
      promise: successPromise
    });
    awsHelper.getUploadWriteStream.restore();
    sandbox.replace(awsHelper, 'getUploadWriteStream', uploadFake);

    readStream.push(null);
    await handleFileAsync(null, fileInput);
    for(let i=0; i < sizes.length; i++){
      const testName = path.join(pathTest, fileHelper.addSuffix(filename, sizes[i].name));
      const webpName = fileHelper.updateExtension(testName, 'webp');

      uploadFake.getCall(i*2).calledWith(sandbox.match.object, sandbox.match({Key: testName}));
      uploadFake.getCall(i*2 + 1).calledWith(sandbox.match.object, sandbox.match({Key: webpName}));
    }
  });
  it('Verify saving filename map is empty after successfully saving original', async () => {
    const engine = ImageStorageEngine(s3, {bucket: forceUploadSuccess});
    const handleFileAsync = util.promisify(engine._handleFile.bind(engine));

    readStream.push(null);
    await handleFileAsync(null, fileInput);
    engine.fileMap.should.be.empty;
  });
  it('Verify saving filename map is empty after successfully saving multi-size', async () => {
    const sizes = [
      {},
      {name: 'test1', width: 100},
      {name: 'test2', width: 200},
      {name: 'test2', width: 300}
    ];
    const engine = ImageStorageEngine(s3, {sizes, bucket: forceUploadSuccess});
    const handleFileAsync = util.promisify(engine._handleFile.bind(engine));

    readStream.push(null);
    await handleFileAsync(null, fileInput);
    engine.fileMap.should.be.empty;
  });
  it('Failure causes filename map to maintain the filename created', async () => {
    getUpload.withArgs(sandbox.match.object, sandbox.match({Bucket: forceUploadFail})).returns({
      writeStream,
      promise: Promise.reject(generalError)
    });
    const engine = ImageStorageEngine(s3, {bucket: forceUploadFail});
    const handleFileAsync = util.promisify(engine._handleFile.bind(engine));

    readStream.push(null);
    try{
      await handleFileAsync(null, fileInput);
    } catch (e){
      engine.fileMap[fileInput.originalname][0].should.equal(filename);
    }
  });
  it('Failure causes filename map to maintain the multiple filenames created', async () => {
    const sizes = [
      {},
      {name: 'test1', width: 100},
      {name: 'test2', width: 200},
      {name: 'test2', width: 300}
    ];
    getUpload.withArgs(sandbox.match.object, sandbox.match({Bucket: forceUploadFail})).returns({
      writeStream,
      promise: Promise.reject(generalError)
    });
    const engine = ImageStorageEngine(s3, {sizes, bucket: forceUploadFail});
    const handleFileAsync = util.promisify(engine._handleFile.bind(engine));

    readStream.push(null);
    try{
      await handleFileAsync(null, fileInput);
    } catch (e){
      sizes.forEach((size, index) => {
        engine.fileMap[fileInput.originalname][index].should.equal(fileHelper.addSuffix(filename, size.name));
      });
    }
  });
  it('Failure causes filename map to maintain the multiple filenames created', async () => {
    const sizes = [
      {},
      {name: 'test1', width: 100},
      {name: 'test2', width: 200},
      {name: 'test2', width: 300}
    ];
    getUpload.withArgs(sandbox.match.object, sandbox.match({Bucket: forceUploadFail})).returns({
      writeStream,
      promise: Promise.reject(generalError)
    });
    const engine = ImageStorageEngine(s3, {sizes, webP: true, bucket: forceUploadFail});
    const handleFileAsync = util.promisify(engine._handleFile.bind(engine));

    readStream.push(null);
    try{
      await handleFileAsync(null, fileInput);
    } catch (e){
      let index = 0;
      sizes.forEach((size) => {
        const fileWithSuf = fileHelper.addSuffix(filename, size.name);
        const webpFilename = fileHelper.updateExtension(fileWithSuf, 'webp');
        engine.fileMap[fileInput.originalname][index++].should.equal(fileWithSuf);
        engine.fileMap[fileInput.originalname][index++].should.equal(webpFilename);
      });
    }
  });
});
describe('ImageStorageEngine _removeFile', () => {
  const forceSuccess = 'force-success.jpg';
  const forceException = 'force-exception.jpg';
  let removeStub;
  let s3;

  beforeEach(() => {
    s3 = new Aws.S3;
    removeStub = sandbox.stub(awsHelper, 'removeAsync');
    removeStub.returns(Promise.resolve({}));
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('Failed to remove file', async () => {
    const s3Path = process.env.S3_PATH;
    process.env.S3_PATH='';
    const generalError = new Error('Boom goes the dynamite');
    removeStub.withArgs(sandbox.match.object, sandbox.match({Key: forceException})).returns(Promise.reject(generalError));
    const engine = ImageStorageEngine(s3);
    engine.fileMap[forceException] = [forceException];
    const removeFileAsync = util.promisify(engine._removeFile.bind(engine));

    try{
      await removeFileAsync(null, {originalname: forceException});
    }catch (err){
      err.should.equal(generalError);
    }
    process.env.S3_PATH=s3Path;
  });
  it('No files to remove', async () => {
    const engine = ImageStorageEngine(s3);
    const removeFileAsync = util.promisify(engine._removeFile.bind(engine));

    const data = await removeFileAsync(null, {originalname: forceSuccess});
    data.should.be.true;
  });
  it('One file to remove', async () => {
    const engine = ImageStorageEngine(s3);
    engine.fileMap[forceSuccess] = [forceSuccess];
    const removeFileAsync = util.promisify(engine._removeFile.bind(engine));

    const data = await removeFileAsync(null, {originalname: forceSuccess});
    data.should.be.an('array');
    data.length.should.equal(1);
  });
  it('Multiple files - sizes only', async () => {
    const engine = ImageStorageEngine(s3,);
    engine.fileMap[forceSuccess] = ['test1', 'test2', 'test3', 'test4'];
    const removeFileAsync = util.promisify(engine._removeFile.bind(engine));

    const data = await removeFileAsync(null, {originalname: forceSuccess});
    data.should.be.an('array');
    data.length.should.equal(4);
  });
  it('Multiple file - sizes and webP verify s3 removal', async () => {
    const pathTest = 'testing-path';
    const engine = ImageStorageEngine(s3, {path: pathTest, webP: true});
    const files = ['test1', 'test2', 'test3', 'test4'];
    engine.fileMap[forceSuccess] = Array.from(files);
    const removeFileAsync = util.promisify(engine._removeFile.bind(engine));

    sandbox.restore();
    const removeFake = sandbox.fake.returns(Promise.resolve({}));
    sandbox.replace(awsHelper, 'removeAsync', removeFake);

    await removeFileAsync(null, {originalname: forceSuccess});
    files.forEach((filename, i) => {
      removeFake.getCall(i).calledWith(sandbox.match.object, filename);
    });
  });
});

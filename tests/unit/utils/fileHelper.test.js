const sinon = require('sinon');
const getFileName = require('../../../utils/fileHelper').getName;
const addSuffix = require('../../../utils/fileHelper').addSuffix;
const getExtension = require('../../../utils/fileHelper').getExtension;
const updateExtension = require('../../../utils/fileHelper').updateExtension;
require('chai').should();

describe('fileHelper.getName', () => {
  it('Random name returned', (done) => {
    getFileName(null, null, (_, filename) => {
      filename.length.should.equal(32);
      done();
    });
  });
  it('No Error', function (done) {
    getFileName(null, null, done);
  });
  it('No Collisions', function (done) {
    getFileName(null, null, (_, filename1) => {
      getFileName(null, null, (_, filename2) => {
        filename1.should.not.equal(filename2);
        done();
      });
    });
  });
  it('Crypto Error: pseudoRandomBytes', function (done) {
    const crypto = require('crypto');
    const expectedError = new Error('stub error occurred');
    let cryptoStub = sinon.stub(crypto, 'pseudoRandomBytes');
    cryptoStub.yields(expectedError);

    getFileName(null, null, (err) => {
      err.should.equal(expectedError);
      cryptoStub.restore();
      done();
    });
  });
  it('Crypto Error: createHash', function (done) {
    const crypto = require('crypto');
    const expectedError = new Error('stub error occurred');
    let cryptoStub = sinon.stub(crypto, 'createHash').throws(expectedError);

    getFileName(null, null, (err) => {
      err.should.equal(expectedError);
      cryptoStub.restore();
      done();
    });
  });
  it('Getting with filename extension', (done) => {
    const extension = 'test';
    const filename = 'hello-world';
    getFileName(null, {originalname: filename + '.' + extension}, (_, data) => {
      const split = data.split('.');
      split[1].should.equal(extension);
      done();
    });
  });
  it('Converting .gif extension to png', (done) => {
    const filename = 'hello-world.gif';
    getFileName(null, {originalname: filename}, (_, data) => {
      const split = data.split('.');
      split[1].should.equal('png');
      done();
    });
  });
  it('Converting .svg extension to png', (done) => {
    const filename = 'hello-world.svg';
    getFileName(null, {originalname: filename}, (_, data) => {
      const split = data.split('.');
      split[1].should.equal('png');
      done();
    });
  });
});
describe('fileHelper.addSuffix', () => {
  it('Invalid paramter - null' , () => {
    (() => addSuffix()).should.throw();
  });
  it('Invalid paramter - invalid type' , () => {
    (() => addSuffix(1)).should.throw();
  });
  it('Invalid file format' , () => {
    const name = 'test';
    (() => addSuffix(name,'test')).should.throw();
  });
  it('No suffix provided', () => {
    const name = 'test.jpg';
    addSuffix(name).should.equal(name);
  });
  it('Invalid suffix provided', () => {
    const name = 'test.jpg';
    addSuffix(name,1).should.equal(name);
  });
  it('Undefined suffix provided', () => {
    const name = 'test.jpg';
    addSuffix(name,undefined).should.equal(name);
  });
  it('Add suffix to filename', () => {
    const name = 'luke_skywalker';
    const extension = '.pilot';
    const suffix = 'jedi';

    const updateName = addSuffix(name + extension, suffix);
    updateName.should.equal(name + '_' + suffix + extension);
  });
  it('Add suffix to filename multiple periods', () => {
    const name = 'luke.skywalker.is.a';
    const extension = '.jedi';
    const suffix = 'jedi.master';

    const updateName = addSuffix(name + extension, suffix);
    updateName.should.equal(name + '_' + suffix + extension);
  });
});
describe('fileHelper.getExtension', () => {
  it('Get extension from filename', () => {
    const name = 'luke.';
    const expectedExtension = 'skywalker';

    const extension = getExtension(name + expectedExtension);

    extension.should.equal(expectedExtension);
  });
  it('Invalid file name format, null', () => {
    (() => getExtension()).should.throw();
  });
  it('Invalid file name format, invalid format', () => {
    (() => getExtension(1)).should.throw();
  });
  it('Filename w/o extension"', () => {
    (getExtension('luke') === undefined).should.be.true;
  });
  it('File with more than 1 period', () => {
    const name = 'luke.skywalker.';
    const expectedExtension = 'jedi';

    const extension = getExtension(name + expectedExtension);

    extension.should.equal(expectedExtension);
  });
});
describe('fileHelper.updateExention', () => {
  it('No filename provided', () => {
    (()=> updateExtension()).should.throw();
  });
  it('Invalid filename format provided', () => {
    (()=> updateExtension(1, 'test')).should.throw();
  });
  it('No extension provided', () => {
    (()=> updateExtension('test')).should.throw();
  });
  it('No extension format provided', () => {
    (()=> updateExtension('test', 3)).should.throw();
  });
  it('Filename w/o current extension - should add if doesn\'t exist', () => {
    const filename = 'darth';
    const extension = 'vader';
    updateExtension(filename, extension).should.equal(filename + '.' + extension);
  });
  it('Filename /w extension', () => {
    const filename = 'darth';
    const extension = 'vader';
    const newExtension = 'sith';
    updateExtension(filename + '.' + extension, newExtension).should.equal(filename + '.' + newExtension);
  });
  it('Filename /w multiple periods and extension', () => {
    const filename = 'darth.vader.is.a';
    const extension = 'sith_loard';
    const newExtension = 'jedi_master';
    updateExtension(filename + '.' + extension, newExtension).should.equal(filename + '.' + newExtension);
  });
});

'use strict';
const crypto = require('crypto');

const convertToPng = ['gif', 'svg'];

const getName = (req, file, cb) => {
  crypto.pseudoRandomBytes(32, (err, raw) => {
    if (err) cb(err);
    let filename;
    try{
      let extension = file ? getExtension(file.originalname) : undefined;
      if(convertToPng.includes(extension)) extension='png';
      filename = crypto.createHash('MD5').update(raw).digest('hex') + (extension ? '.' + extension : '');
    } catch(err) {
      cb(err);
      return;
    }
    if(filename){
      cb(null, filename);
    } else {
      cb(new Error('failed to create filename'));
    }
  });
};

const getExtension = (filename) => {
  if(!filename && typeof filename != 'string'){
    throw new Error(Object.keys({filename})[0] + ' must be provided and a valid string');
  }
  const split = filename.split('.');
  if(split.length < 2) return undefined;

  return split[split.length-1];
};

const updateExtension = (name, extension) => {
  if(!name || typeof name !== 'string'){
    throw new Error(Object.keys({name})[0], ' must be provided and a valid string');
  }
  if(!extension || typeof extension !== 'string'){
    throw new Error(Object.keys({extension})[0] + ' must be provided and a valid string;');
  }

  const parts = name.split('.');
  if(parts.length < 2) return name + '.' + extension;

  // Remove the extension
  parts.pop();
  const filename = parts.join('.');
  return filename + '.' + extension;
};

const addSuffix = (name, suffix) => {
  if(!name || typeof name !== 'string'){
    throw new Error(Object.keys({name})[0], ' must be provided and a valid string');
  }
  if(!suffix || typeof suffix !== 'string'){
    return name;
  }

  const parts = name.split('.');
  if (parts.length < 2){
    throw new Error('The name must be a file format (e.g. filename.jpg)');
  }

  const extension = parts.pop();
  const filename = parts.join('.');
  return filename + '_' + suffix + '.' + extension;
};

module.exports = {
  getName,
  addSuffix,
  getExtension,
  updateExtension
};

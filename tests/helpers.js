const fs = require('fs');
const path = require('path');

const awaitWriteStream = (stream) => new Promise((resolve) => {
  stream.on('finish', () => {
    resolve('complete!');
  });
});

const getTempDir = () => {
  const dir = path.join(__dirname, '..', 'tmp');
  !fs.existsSync(dir) && fs.mkdirSync(dir);
  return dir;
};

module.exports = {
  awaitWriteStream,
  getTempDir
};

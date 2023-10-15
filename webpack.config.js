const path = require('path');

module.exports = {
  entry: {
    lib: './ui_src/lib.js',
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'lib.min.js',
  },
  mode: 'production',
};

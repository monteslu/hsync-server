import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  entry: {
    lib: './ui_src/lib.js',
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'lib.min.js',
  },
  mode: 'production',
};

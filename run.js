import run from './index.js';

run().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

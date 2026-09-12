const path = require('node:path');

const releaseId = process.env.B2C_RELEASE_ID || 'v15-silver-glass';
if (releaseId.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(releaseId)) {
  throw new Error('B2C_RELEASE_ID must be a release directory name such as v15-silver-glass, not a path or URL.');
}

module.exports = {
  releaseId,
  releaseDirectory: path.resolve(process.env.B2C_RELEASE_ROOT || path.join(__dirname, '../../docs/releases'), releaseId),
  assetBase: `https://creative-aigent.github.io/B2CAssets/releases/${releaseId}/`,
};

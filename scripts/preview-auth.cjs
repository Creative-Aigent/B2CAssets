#!/usr/bin/env node
// Local-only synthetic preview. Never serves a live identity page or accepts a form submission.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { cases, platformBootstrap } = require('../tests/browser/fixtures');
const { releaseId, releaseDirectory, assetBase } = require('../tests/browser/release');

const manifest = JSON.parse(fs.readFileSync(path.join(releaseDirectory, 'release-manifest.json'), 'utf8'));
const types = {
  '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain',
};
const localize = text => text.replaceAll(assetBase, '/assets/');
const server = http.createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; form-action 'none'; connect-src 'none'; frame-ancestors 'none'");
  if (request.method !== 'GET') {
    response.writeHead(405).end('Synthetic preview: submissions are not accepted.');
    return;
  }
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/') {
    const links = cases.map(fixture => `<li>${fixture.name}: ${['light', 'dark'].map(theme =>
      `<a href="/${fixture.name}?aiman_theme=${theme}">${theme}</a>`).join(' / ')}</li>`).join('');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
      <title>Synthetic B2C preview</title><h1>${releaseId}</h1>
      <p>Local synthetic fixtures only. No login, OTP, account data, or tenant connection.</p><ul>${links}</ul></html>`);
    return;
  }
  const fixture = cases.find(item => `/${item.name}` === url.pathname);
  if (fixture) {
    const template = fs.readFileSync(path.join(releaseDirectory, fixture.template), 'utf8');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(localize(template.replace('<div id="api"></div>',
      `<div id="api">${fixture.markup}</div>${platformBootstrap}`)));
    return;
  }
  const asset = url.pathname.startsWith('/assets/') ? url.pathname.slice('/assets/'.length) : '';
  const type = types[path.extname(asset)];
  if (type && Object.hasOwn(manifest.files, asset)) {
    const bytes = fs.readFileSync(path.join(releaseDirectory, asset));
    response.setHeader('Content-Type', type);
    response.end(['.css', '.svg'].includes(path.extname(asset)) ? localize(bytes.toString('utf8')) : bytes);
    return;
  }
  response.writeHead(404).end('Unknown synthetic fixture or bundled asset.');
});
server.listen(Number(process.env.B2C_PREVIEW_PORT || 4317), '127.0.0.1', () => {
  console.log(`Synthetic ${releaseId} preview: http://127.0.0.1:${server.address().port}`);
});

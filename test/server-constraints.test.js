/**
 * Project 6 constraints, checked in the source:
 *   C1 no Express or framework router (only node: built-ins and our files),
 *   C3 no blocking file operations in request handling (no *Sync calls in
 *      server/ or in the promise half of src/storage.js).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');

function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const serverFiles = fs.readdirSync(SERVER_DIR).filter((f) => f.endsWith('.mjs'));

test('server/ has the expected modules', () => {
  assert.deepStrictEqual(serverFiles.sort(), ['api.mjs', 'app.mjs', 'http-json.mjs', 'main.mjs', 'static.mjs']);
});

for (const file of serverFiles) {
  const code = codeOnly(fs.readFileSync(path.join(SERVER_DIR, file), 'utf8'));

  test(`server/${file}: imports only node: built-ins and files in this repo`, () => {
    const specifiers = [
      ...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
      ...code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]);
    for (const spec of specifiers) {
      assert.match(spec, /^(?:node:|\.\.?\/)/, `server/${file} imports "${spec}"`);
    }
  });

  test(`server/${file}: no blocking (*Sync) calls`, () => {
    assert.doesNotMatch(code, /\b\w+Sync\s*\(/);
  });
}

test('src/storage.js: the promise API uses no *Sync calls', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'storage.js'), 'utf8');
  const marker = source.indexOf('Promise-based API (Project 6)');
  assert.ok(marker > 0, 'marker comment present');
  assert.doesNotMatch(codeOnly(source.slice(marker)), /\b\w+Sync\s*\(/);
});

test('package.json has no dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.dependencies, undefined);
  assert.strictEqual(pkg.devDependencies, undefined);
});

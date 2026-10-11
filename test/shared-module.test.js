/**
 * Project 5: the calculation module is shared by Node and the browser.
 *
 * R1 says the browser copy must not import Node-only modules. Because it is
 * the same file Node uses, these checks guard both directions:
 *   - Node can load it (through the src/calculation.js bridge and directly);
 *   - its source uses nothing that exists in only one runtime.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SHARED = path.join(__dirname, '..', 'web', 'js', 'calculation.mjs');

// Strip comments so explanatory prose ("no require()") is not mistaken for code.
function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('the CommonJS bridge and the ES module expose the same functions', async () => {
  const viaBridge = require('../src/calculation');
  const direct = await import(SHARED);
  assert.deepStrictEqual(Object.keys(viaBridge).sort(), Object.keys(direct).sort());
  for (const name of Object.keys(direct)) {
    assert.strictEqual(viaBridge[name], direct[name], `${name} is a different function`);
  }
});

test('the shared module has no Node-only or browser-only dependencies', () => {
  const code = codeOnly(fs.readFileSync(SHARED, 'utf8'));
  const forbidden = [
    [/\brequire\s*\(/, 'require() (CommonJS, Node only)'],
    [/\bmodule\.exports\b|\bexports\./, 'module.exports (CommonJS, Node only)'],
    [/\bimport\b/, 'import (the module must stay dependency-free)'],
    [/\bprocess\b/, 'process (Node only)'],
    [/\b__dirname\b|\b__filename\b/, '__dirname/__filename (Node only)'],
    [/\bBuffer\b/, 'Buffer (Node only)'],
    [/\b(?:window|document|localStorage|sessionStorage)\b/, 'browser globals'],
    [/\bconsole\./, 'console output (pure functions do no I/O)'],
  ];
  for (const [pattern, what] of forbidden) {
    assert.doesNotMatch(code, pattern, `web/js/calculation.mjs uses ${what}`);
  }
});

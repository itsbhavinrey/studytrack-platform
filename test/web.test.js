// Project 4: every local resource a published page references must exist in web/.
//
// GitHub Pages publishes web/ as https://<user>.github.io/studytrack-platform/,
// so an href/src is checked the way a browser would resolve it there:
//   - "styles.css"                    -> relative to the page's folder
//   - "/studytrack-platform/x.css"    -> root-relative, mapped back to web/x.css
//   - "https://...", "#id", "mailto:" -> not a file in this site, skipped
// This catches the Project 4 break-it fault (a wrong stylesheet path) before deploy.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB_DIR = path.join(__dirname, '..', 'web');
const SITE_PATH = '/studytrack-platform/';

function htmlFiles() {
  return fs.readdirSync(WEB_DIR).filter((f) => f.endsWith('.html'));
}

function localReferences(html) {
  const refs = [];
  const attr = /\s(?:href|src)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = attr.exec(html)) !== null) {
    const url = m[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) continue; // scheme, protocol-relative, fragment
    refs.push(url);
  }
  return refs;
}

function resolveToFile(pageFile, url) {
  const clean = url.split(/[?#]/)[0];
  if (clean.startsWith('/')) {
    if (!clean.startsWith(SITE_PATH)) return null; // outside this site
    const rest = clean.slice(SITE_PATH.length);
    return path.join(WEB_DIR, rest === '' ? 'index.html' : rest);
  }
  const resolved = path.join(path.dirname(path.join(WEB_DIR, pageFile)), clean);
  return clean.endsWith('/') ? path.join(resolved, 'index.html') : resolved;
}

test('web/ contains the published pages', () => {
  const files = htmlFiles();
  assert.ok(files.includes('index.html'), 'web/index.html is missing');
});

for (const page of htmlFiles()) {
  test(`${page}: every local href/src points at a file in web/`, () => {
    const html = fs.readFileSync(path.join(WEB_DIR, page), 'utf8');
    const refs = localReferences(html);
    for (const url of refs) {
      const file = resolveToFile(page, url);
      assert.ok(file, `${page}: "${url}" points outside ${SITE_PATH}`);
      assert.ok(fs.existsSync(file), `${page}: "${url}" -> ${path.relative(WEB_DIR, file)} does not exist`);
    }
  });

  test(`${page}: links exactly one stylesheet`, () => {
    const html = fs.readFileSync(path.join(WEB_DIR, page), 'utf8');
    const sheets = html.match(/<link\s+rel="stylesheet"[^>]*>/g) || [];
    assert.strictEqual(sheets.length, 1);
  });
}

test('404.html uses root-relative URLs (it is served at arbitrary paths)', () => {
  const html = fs.readFileSync(path.join(WEB_DIR, '404.html'), 'utf8');
  for (const url of localReferences(html)) {
    assert.ok(url.startsWith(SITE_PATH), `404.html: "${url}" must start with ${SITE_PATH}`);
  }
});

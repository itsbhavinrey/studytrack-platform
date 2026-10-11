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

// Project 5: the browser modules in web/js/.

const JS_DIR = path.join(WEB_DIR, 'js');

function jsModules() {
  return fs.readdirSync(JS_DIR).filter((f) => f.endsWith('.mjs'));
}

// Comments explain forbidden APIs by name; check code only.
function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('index.html loads the planner as one module script', () => {
  const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
  const scripts = html.match(/<script\b[^>]*>/g) || [];
  assert.deepStrictEqual(scripts, ['<script type="module" src="js/planner.mjs">']);
});

for (const page of htmlFiles()) {
  test(`${page}: no inline event-handler attributes`, () => {
    const html = fs.readFileSync(path.join(WEB_DIR, page), 'utf8');
    assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i);
  });
}

for (const file of jsModules()) {
  test(`js/${file}: every relative import resolves to a file in web/js/`, () => {
    const code = codeOnly(fs.readFileSync(path.join(JS_DIR, file), 'utf8'));
    const specifiers = [...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of specifiers) {
      // Browsers need a full relative URL with the extension: no bare
      // specifiers like 'calculation' and no Node-style extension guessing.
      assert.match(spec, /^\.\.?\/.+\.mjs$/, `js/${file}: import "${spec}" is not a relative .mjs URL`);
      assert.ok(fs.existsSync(path.join(JS_DIR, spec)), `js/${file}: import "${spec}" does not exist`);
    }
  });

  test(`js/${file}: no HTML insertion and no browser storage`, () => {
    const code = codeOnly(fs.readFileSync(path.join(JS_DIR, file), 'utf8'));
    assert.doesNotMatch(code, /\.(?:innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write/);
    assert.doesNotMatch(code, /\b(?:localStorage|sessionStorage|indexedDB)\b|document\.cookie/);
  });
}

test('planner.mjs registers one listener per action, once', () => {
  const code = codeOnly(fs.readFileSync(path.join(JS_DIR, 'planner.mjs'), 'utf8'));
  const registrations = [...code.matchAll(/addEventListener\(\s*['"](\w+)['"]/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(registrations, ['reset', 'submit']);
  const wiringCalls = code.match(/^\s*wirePlanner\(/gm) || [];
  assert.strictEqual(wiringCalls.length, 1, 'wirePlanner() must be called exactly once');
});

// Project 6: the shared study log page.

test('log.html loads the study log as one module script', () => {
  const html = fs.readFileSync(path.join(WEB_DIR, 'log.html'), 'utf8');
  const scripts = html.match(/<script\b[^>]*>/g) || [];
  assert.deepStrictEqual(scripts, ['<script type="module" src="js/study-log.mjs">']);
});

test('study-log.mjs registers one listener per action, once', () => {
  const code = codeOnly(fs.readFileSync(path.join(JS_DIR, 'study-log.mjs'), 'utf8'));
  const registrations = [...code.matchAll(/(\w+)\.addEventListener\(\s*['"](\w+)['"]/g)].map((m) => `${m[1]}:${m[2]}`).sort();
  assert.deepStrictEqual(registrations, ['form:submit', 'refreshButton:click', 'retryButton:click']);
  assert.strictEqual((code.match(/^\s*wireStudyLog\(/gm) || []).length, 1, 'wireStudyLog() must be called exactly once');
});

test('only sessions-api.mjs calls fetch(), and every fetch has a timeout', () => {
  for (const file of jsModules()) {
    const code = codeOnly(fs.readFileSync(path.join(JS_DIR, file), 'utf8'));
    const calls = (code.match(/\bfetch\(/g) || []).length;
    if (file === 'sessions-api.mjs') {
      assert.strictEqual(calls, 1);
      assert.match(code, /signal:\s*AbortSignal\.timeout\(/);
    } else {
      assert.strictEqual(calls, 0, `js/${file} calls fetch() directly`);
    }
  }
});

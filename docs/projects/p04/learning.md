# Project 4 learning notes - First website on the internet

These notes explain what Project 4 changed and why, using this repository's own files and the evidence in [`report.md`](report.md). Read them next to the code.

Public page: https://itsbhavinrey.github.io/studytrack-platform/

## 1. The whole journey in one picture

When you type `https://itsbhavinrey.github.io/studytrack-platform/` into a browser:

1. **URL parsing (browser).** Scheme `https`, host `itsbhavinrey.github.io`, implied port 443, path `/studytrack-platform/`.
2. **DNS (resolver).** The browser asks "what addresses does `itsbhavinrey.github.io` have?" and gets four A records (`185.199.108-111.153`) and four AAAA records (`2606:50c0:8000-8003::153`). See report section 3.
3. **TCP connection** to one of those addresses on port 443 (curl and Chrome both used `2606:50c0:8002::153`).
4. **TLS handshake.** The browser sends the host name (SNI), and the server presents a certificate for `*.github.io` issued by Let's Encrypt. The browser checks the name, the dates and the chain, and the two sides agree on keys. HTTP/2 is negotiated through ALPN.
5. **HTTP request** `GET /studytrack-platform/` with `Host: itsbhavinrey.github.io`.
6. **HTTP response** `200`, `content-type: text/html; charset=utf-8`, then the HTML.
7. The browser parses the HTML, finds `<link rel="stylesheet" href="styles.css">`, resolves it against the page URL to `https://itsbhavinrey.github.io/studytrack-platform/styles.css`, and repeats steps 5-6 on the same connection: `200 text/css`.
8. The CSS is applied and the page renders.

Step 2 has to happen once, before anything else. Steps 5-7 repeat for every resource. A broken page is usually a failure in one specific step, so the skill this project trains is to name the step and show the evidence for it.

## 2. New topics, explained against this code

### 2.1 Networking: URLs, DNS, HTTP/HTTPS, requests, responses, status codes

**URL anatomy.** `https://itsbhavinrey.github.io/studytrack-platform/styles.css#x` splits into scheme (`https`), host (`itsbhavinrey.github.io`), port (443, implied by `https`), path (`/studytrack-platform/styles.css`) and fragment (`#x`). Only the host goes to DNS. The path goes to the web server in the request line. The fragment never leaves the browser, which is why the P3 nav links (`#goal`, `#plan`) produce no network requests at all.

**DNS.** A distributed lookup from names to records. The records seen here:

- `A`: an IPv4 address. `AAAA`: an IPv6 address.
- `CNAME`: "this name is an alias for another name". There is none for `itsbhavinrey.github.io`, so `dig ... CNAME` returned `NOERROR` with no answer lines.
- `3600` is the TTL: resolvers may cache the answer for an hour.

There are four addresses because GitHub runs the same service from several front-end addresses for redundancy. Any of them can serve any `*.github.io` site, because the server picks the site from the host name the client sends, not from the address.

**HTTP.** A request is a method + path + headers (`GET /studytrack-platform/ HTTP/2`, `Host: ...`). A response is a status code + headers + body. The status codes seen in this project:

| Code | Where we saw it | Meaning |
| --- | --- | --- |
| 200 OK | `/studytrack-platform/`, `styles.css`, `version.txt` | Here is the resource. |
| 301 Moved Permanently | `http://...` → `https://...`; `/studytrack-platform` → `/studytrack-platform/` | Go to the `Location` header instead. |
| 404 Not Found | `css/styles.css` in the drill; `/no/such/page`; `/favicon.ico` | The server has nothing at this path. A 404 still has a body (an HTML error page). |

The second 301 matters for relative URLs. Without the trailing slash, the page's "folder" would be `/`, and `styles.css` would resolve to `/styles.css`, the wrong place. GitHub Pages redirects to the slash form first, so relative URLs resolve inside `/studytrack-platform/`.

**`Content-Type`.** This header tells the browser how to interpret the bytes. `text/html` for the page, `text/css` for the stylesheet. GitHub Pages picks it from the file extension. In the drill, the 404 response for `css/styles.css` had `content-type: text/html` (the error page), and no CSS was applied.

**HTTPS.** HTTP inside TLS. TLS gives three things: **encryption** (others on the network cannot read the traffic), **integrity** (they cannot change it undetected) and **authentication** (the certificate proves the server is entitled to `*.github.io`). `openssl s_client` showed `Verify return code: 0 (ok)`, the subject `CN=*.github.io`, the issuer Let's Encrypt `YR1`, and validity dates. The wildcard `*.github.io` matches exactly one label, so it covers `itsbhavinrey.github.io` but would not cover `a.b.github.io`. Pages has "Enforce HTTPS" on (`"https_enforced":true`), which produced the `http → https` 301.

**Caching.** Responses carry `cache-control: max-age=600`: a browser or CDN may reuse them for 10 minutes. This is why the checks used `?t=<random>` query strings, and why a real visitor may see an old page for a few minutes after a deploy or rollback.

### 2.2 Deployment: publishing a static artifact

A **static artifact** is a set of files served as they are: no server code runs per request. Here, the artifact is the contents of `web/` plus a generated `version.txt`. The GitHub Actions workflow builds it (`_site/`), uploads it as a Pages artifact (a tar file), and `deploy-pages` tells GitHub Pages to serve that artifact. The server then just maps a request path to a file in it.

Three ideas carry over to every later deployment project:

- **Build once, deploy that exact artifact.** The thing that is tested (`npm test` in the build job) is the thing that is uploaded.
- **Know what is live.** `version.txt` lets the public site report the exact commit it serves. Report section 2 shows why this is needed: GitHub's own deployment record stores the commit of the *workflow*, which was `main` even while the drill branch and the rollback were live.
- **Verification is separate from deployment.** A green deploy job only proves the upload worked. The `verify` job (and `scripts/check-site.mjs`) asks the public site.

### 2.3 GitHub: remote branches, pull requests, merge workflow

- A **remote branch** (`origin/p04/publish-github-pages`) is your local Git's record of where that branch was on GitHub the last time you fetched or pushed. `git status -sb` compares the local branch with it (`[ahead 2]`, `[behind 1]`, or nothing when equal). `git log origin/main..HEAD` lists commits you have that `origin/main` does not.
- A **pull request** asks to merge one branch into another. On GitHub it shows the diff, the commits and the checks. We inspected the diff with `gh pr diff 1 --name-only` before merging, which showed only the two intended files.
- **Merge methods.** "Create a merge commit" (used here) keeps the branch commits and adds a merge commit whose message names the PR (`Merge pull request #1 ...`). "Squash" would turn the PR into one commit, and "rebase" would replay the commits onto `main`. Merge commits make "which PR shipped this deploy?" a one-step lookup.
- After a merge happens on GitHub, your local `main` is behind. `git pull --ff-only` fast-forwards it, and refuses (instead of creating a surprise merge) if local `main` has diverged.

## 3. Reinforced topics

- **P3 relative URLs after publication.** On disk the page was `file:///.../web/index.html` and `styles.css` resolved to `file:///.../web/styles.css`. On Pages it resolves to `https://itsbhavinrey.github.io/studytrack-platform/styles.css`. It works in both places because it is relative, and because the workflow makes `web/` the site root. An absolute path like `/styles.css` would have broken on Pages (it points at the host root, outside the project site). The 404 page is the opposite case, explained in section 4.
- **P1 Git: local vs remote.** Report section 1 records `git status -sb` and `git rev-parse` for the branch and its remote copy.
- **P2 README: reproducible procedure.** The README now has publish, verify and rollback commands that someone else can run.

## 4. Walkthrough of every new or changed file

### `.github/workflows/pages.yml` (new)

- **`on:`**. `push` to `main` with a `paths` filter (`web/**` and the workflow itself), so a docs-only commit does not redeploy and change the live commit for no reason. `workflow_dispatch` with an optional `ref` input lets a person deploy any commit, branch or tag. This is the rollback button, and it is how the drill published a branch.
- **`permissions: contents: read`** at the top. Every job gets only read access unless it asks for more. Only `deploy` asks for `pages: write` (to publish) and `id-token: write`, which lets `deploy-pages` prove to GitHub Pages, with a short-lived OIDC token, which workflow run is deploying.
- **`concurrency: pages`, `cancel-in-progress: false`.** Two deploys never run at the same time, and a deploy already in progress is not cancelled halfway.
- **`build` job.**
  - `actions/checkout` with `ref: ${{ inputs.ref || github.sha }}`. For a push, `inputs.ref` is empty, so it checks out the pushed commit. For a manual run it checks out whatever was asked for.
  - `setup-node` (Node 24) and `npm test`. The P1-P3 tests and the new web link test must pass before anything is uploaded.
  - "Assemble the site": `cp -R web/. _site/` copies the *contents* of `web/` (the trailing `/.`), so `index.html` sits at the site root. It then writes `version.txt` from `git rev-parse HEAD` (the commit actually checked out) and exports it as a job output for `verify`. The user-supplied `ref` reaches the script through an `env:` variable instead of `${{ }}` inside the script text. That is the GitHub-recommended way to keep input text from being executed as shell code.
  - `configure-pages` and `upload-pages-artifact` package `_site/` as the Pages artifact.
- **`deploy` job.** `environment: github-pages`, so GitHub records a deployment with the page URL. `deploy-pages` publishes the uploaded artifact.
- **`verify` job** (added in PR #2). It polls `version.txt` (up to 30 × 10 s) until the public site reports the expected commit, then checks: the document is `200 text/html`, the stylesheet is `200 text/css`, a missing path is `404`, and every local `href`/`src` in the served HTML returns 200. Two details:
  - `curl -w '%{http_code} %{content_type}\n'` needs the trailing `\n`. Without it, `read` hits end-of-file and returns non-zero, and under `bash -e` the script exits silently. This bug happened when the step was first dry-run locally and was fixed before the commit.
  - Polling is needed because Pages and its CDN take a few seconds to switch to the new artifact.
- **Action pins.** Each `uses:` names a full commit SHA with the version tag in a comment. A tag like `v5` can be moved to different code later; a SHA cannot.

### `web/index.html` (changed)

Two sentences changed: the goal card now says Project 4 published the page and Project 5 is next, and the footer says the page is published with GitHub Pages. The structure, the landmarks, the keyboard route and the stylesheet link are unchanged from P3. This visible text change is what made the rollback observable (`grep 'Next up'` before and after).

### `web/404.html` (new, stretch goal)

GitHub Pages serves `404.html` with status 404 for **any** missing path, at that path's own URL. Requested as `/studytrack-platform/plans/week-9`, a relative `styles.css` would resolve to `/studytrack-platform/plans/styles.css`, which is itself missing. So this page uses **root-relative** URLs that start with the site's path: `/studytrack-platform/styles.css` and `/studytrack-platform/`. The report shows it rendering styled at that nested path. It reuses the P3 header/footer classes and has one `h1`, landmarks and a meaningful link ("Go to the StudyTrack learner profile").

### `test/web.test.js` (new)

This test resolves every local `href`/`src` in `web/*.html` the way a browser on Pages would, and asserts that the target file exists in `web/`:

- It skips URLs with a scheme (`https:`, `mailto:`), protocol-relative URLs (`//`) and fragments (`#...`), because those are not files in this site.
- Root-relative URLs must start with `/studytrack-platform/`, which maps back to `web/`. Anything else points outside the project site and fails.
- Relative URLs resolve against the page's folder.
- Each page must link exactly one stylesheet, and `404.html` must use only root-relative URLs.

It runs as part of `npm test`, so it runs in the workflow's build job before upload. Report section 8 shows it failing on the drill's `css/styles.css`.

Limitation: it reads HTML with a regular expression, which is good enough for these hand-written pages with double-quoted attributes. It is not a general HTML parser. `srcset`, CSS `url()` and single-quoted attributes are not checked.

### `scripts/check-site.mjs` (new)

This is a dependency-free Chrome DevTools Protocol client (Node 22+ has `fetch` and `WebSocket` built in):

1. `launchChrome` starts headless Chrome with `--remote-debugging-port=0` (any free port) and a throwaway profile, and reads the `DevTools listening on ws://...` line to learn the port.
2. `openPage` creates a tab with `PUT /json/new` and talks JSON-RPC over its WebSocket: each command has an `id`, and the reply carries the same `id`. Events (`Network.responseReceived` etc.) have a `method` instead.
3. `checkWidth` enables the Network domain, disables the cache, sets an exact viewport with `Emulation.setDeviceMetricsOverride`, navigates, and waits for `Page.loadEventFired`. From the events it records each request's type, status, `Content-Type`, protocol, remote address and TLS details. That is the data the Network panel shows. In the page it measures `scrollWidth` against `clientWidth`, lists the stylesheets with their rule counts, and can save a full-page screenshot.
4. It exits 1 if any required request failed (a status outside 200-399 or a network error) or the page scrolls sideways. `/favicon.ico` is reported but treated as optional, because the browser requests it on its own, at the host root.

### `package.json` (changed)

It adds `test:web` (just the web test) and `check:site` (run the script). `npm test` is unchanged and already picks up `test/web.test.js` through its `test/*.test.js` glob.

## 5. Concepts to read up on, mapped to this project

| Concept | Where it shows up here |
| --- | --- |
| DNS resolution | `dig` output, report section 3; the A/AAAA records and TTL above |
| URL hostname vs path | Report section 9; the 404 drill (same host, wrong path) |
| HTTP request/response, status, content-type | `curl -sI` and Network events, report sections 5 and 8 |
| HTTPS certificate overview | `openssl s_client` output, report section 4 |
| GitHub branches and pull requests | PRs #1 and #2, report section 1 |
| Static hosting | `pages.yml`: artifact = `web/` + `version.txt`; no code runs per request |

## 6. Answer: which part DNS resolves and which part the web server handles

DNS resolves only the **host name**, `itsbhavinrey.github.io`, into IP addresses (`185.199.108.153` ... and `2606:50c0:8000::153` ...). It knows nothing about the scheme, the port, the path or the page. The browser then connects to one of those addresses and sends the host name again (in TLS SNI and in the HTTP `Host`/`:authority` header) together with the **path** `/studytrack-platform/styles.css`. The **web server** (GitHub Pages) uses the host name to pick the site and the path to pick the file. It decides the status code (200, 301, 404) and the headers (`Content-Type`, `Cache-Control`). The fragment (`#plan`) is handled only by the browser. In the drill, DNS and TLS were identical for the broken and the fixed page: the server's answer for the path was the only thing that changed.

## 7. Self-quiz

1. `dig itsbhavinrey.github.io` returns four A records. Why can any of them serve *your* site rather than someone else's `*.github.io` site?
2. Why does `https://itsbhavinrey.github.io/studytrack-platform` (no slash) get a 301 before the page loads, and what would break if it did not?
3. The broken drill deployment ran green in GitHub Actions. Which evidence showed the page was broken, and at what layer was the fault?
4. During the drill, `/studytrack-platform/styles.css` still returned 200. Why does that not contradict the 404 you saw?
5. Why does `404.html` use `/studytrack-platform/styles.css` while `index.html` uses `styles.css`?
6. What does GitHub's deployments API record as the deployment SHA for a `workflow_dispatch -f ref=<old sha>` rollback, and how did this project find out which commit was really live?
7. What three guarantees does TLS give, and which part of the `openssl s_client` output shows the certificate is valid for this host?
8. What does `cache-control: max-age=600` mean for a visitor right after a rollback?
9. What does `git log origin/main..p04/publish-github-pages` show, and what does `git status -sb` print when a local branch has two commits its remote copy does not have?
10. Why does the workflow pass `inputs.ref` to the shell through `env:` instead of writing `${{ inputs.ref }}` directly in the `run:` script?
11. Why does Chrome request `https://itsbhavinrey.github.io/favicon.ico`, and why is its 404 not a required-resource failure for this page?

<details>
<summary>Answers</summary>

1. The addresses are shared GitHub Pages front ends. The client sends the host name in TLS SNI and in the HTTP `Host`/`:authority` header, and the server uses that name, not the IP address, to choose the site (name-based virtual hosting).
2. GitHub Pages redirects a directory path to its slash form. Relative URLs resolve against the "folder" of the page URL. Without the slash, the folder would be `/`, so `styles.css` would be requested as `/styles.css`, outside the project site, and would 404.
3. The public site itself: Chrome's Network events (`Stylesheet 404 text/html .../css/styles.css`), `curl -sI` returning 404 for that URL, the unstyled screenshot, and `version.txt` naming the drill commit. The fault was in the HTML's resource URL (the HTTP path), not in DNS, TLS or the upload.
4. The file was never missing. The page asked for the wrong path. The server answers per path: `/studytrack-platform/styles.css` exists, `/studytrack-platform/css/styles.css` does not.
5. GitHub Pages serves `404.html` at whatever missing URL was requested, possibly several folders deep, so a relative URL would resolve to a different, missing path. `index.html` is always served at `/studytrack-platform/`, so a relative URL is correct there, and it also works when opened from disk.
6. The commit the workflow ran on (`main`'s head, `c797230`), not the commit that was uploaded (`e413661`). The workflow writes `version.txt` from `git rev-parse HEAD` of the checked-out tree, and `curl .../version.txt` asks the live site directly.
7. Confidentiality (encryption), integrity (tampering is detected) and authentication (the server proves its identity). `Verify return code: 0 (ok)` shows the chain verified, `subject=/CN=*.github.io` plus the SAN list cover the host, and `notBefore`/`notAfter` include today's date.
8. A browser or cache that already has the page may keep using its copy for up to 600 seconds without asking the server, so the visitor may see the pre-rollback page for up to 10 minutes.
9. It lists the commits reachable from the branch but not from `origin/main`, which is what the PR would add. `git status -sb` would print `## branch...origin/branch [ahead 2]`.
10. `${{ }}` is substituted into the script text before bash runs it, so crafted input (for example `; rm -rf ...` or `$(...)`) would become shell code. Through `env:`, it arrives as the value of a variable and is never parsed as code.
11. Browsers ask for `/favicon.ico` at the host root by default when a page declares no icon. That URL belongs to the `itsbhavinrey.github.io` user site, which does not exist. The page does not reference it, and rendering does not depend on it.

</details>

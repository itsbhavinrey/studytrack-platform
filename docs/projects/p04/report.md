# Project 4 report - First website on the internet

All outputs below were captured on 2026-10-11 from macOS with `dig` 9.10.6, `curl` 8.7.1, LibreSSL `openssl`, Node v24.14.0 and Google Chrome 155.0.8059.39 (headless, driven over the Chrome DevTools Protocol). GitHub Actions output is copied from the run logs. Nothing here was typed by hand; long outputs are trimmed to the relevant lines, and trimming is marked.

## 1. Public URL, repository and PRs

| Item | Value |
| --- | --- |
| Public URL | https://itsbhavinrey.github.io/studytrack-platform/ |
| Repository | https://github.com/itsbhavinrey/studytrack-platform (public) |
| Publication PR | [#1 Publish the study profile to GitHub Pages](https://github.com/itsbhavinrey/studytrack-platform/pull/1): branch `p04/publish-github-pages`, commits `864ae83` (prd) and `4803870` (workflow), merge commit `e413661` |
| Follow-up PR | [#2 Verify the published site and add a 404 page](https://github.com/itsbhavinrey/studytrack-platform/pull/2): branch `p04/verify-and-404`, 5 commits, merge commit `c797230` |
| Docs PR | [#3 P4 docs: report, learning notes, README publishing procedure, .gitignore](https://github.com/itsbhavinrey/studytrack-platform/pull/3): branch `p04/docs`. Docs and `.gitignore` only, so the workflow's `paths` filter does not redeploy and the served commit stays `c797230` |
| Branch cleanup | After PRs #1 and #2 merged, `p04/publish-github-pages` and `p04/verify-and-404` were deleted on GitHub (`git push origin --delete ...`); the merged PRs still record them |
| Deployed commit now | `c79723033d224484b6edb408c4fabe457fdae3f0` (merge of PR #2), served by Actions run 38146012159 |
| Site files | `web/index.html`, `web/styles.css`, `web/404.html`; the workflow adds `version.txt` |
| Workflow | `.github/workflows/pages.yml` |

### Branch, PR and merge workflow (R2)

1. Created `p04/publish-github-pages` from `main`, committed the prd and the workflow, and pushed it. Comparing the local branch with its remote copy after the push:

   ```text
   $ git status -sb
   ## p04/publish-github-pages...origin/p04/publish-github-pages
   $ git log --oneline origin/main..p04/publish-github-pages
   4803870 ci: publish web/ to GitHub Pages with a rollback-capable workflow
   864ae83 docs(p04): restate Project 4 brief as a checklist with publishing decisions
   $ git rev-parse p04/publish-github-pages origin/p04/publish-github-pages
   4803870a077875379cc225c06d7c6b5cb15419cb
   4803870a077875379cc225c06d7c6b5cb15419cb
   ```

   No `[ahead N]` marker and identical SHAs mean the remote branch holds exactly the local commits. `origin/main..branch` lists what the PR will add.
2. Enabled Pages with the Actions source: `gh api -X POST repos/itsbhavinrey/studytrack-platform/pages -f build_type=workflow` answered `"build_type":"workflow"`, `"html_url":"https://itsbhavinrey.github.io/studytrack-platform/"`, `"https_enforced":true`.
3. Opened PR #1 and inspected its diff before merging:

   ```text
   $ gh pr view 1 --json ...
   {"additions":162,"baseRefName":"main","changedFiles":2,"commits":["864ae83","4803870"],"deletions":0,
    "headRefName":"p04/publish-github-pages","number":1,"state":"OPEN", ...}
   $ gh pr diff 1 --name-only
   .github/workflows/pages.yml
   docs/projects/p04/prd.md
   ```

   The diff touched only the two intended files. `web/` was unchanged, so the first published page is byte-for-byte the P3 page.
4. Merged with a merge commit (`gh pr merge 1 --merge`), giving `e413661 Merge pull request #1 from itsbhavinrey/p04/publish-github-pages`, then `git pull --ff-only` so local `main` equals `origin/main` (`## main...origin/main`).
5. PR #2 followed the same route (6 files: `web/index.html`, `web/404.html`, `test/web.test.js`, `scripts/check-site.mjs`, `package.json`, the workflow).

## 2. Deployment record

Every run of `Publish study profile` in this project (from `gh run list`):

| Time (UTC) | Run | Trigger | Workflow commit | Commit actually served (`version.txt`) | Purpose |
| --- | --- | --- | --- | --- | --- |
| 14:00:08 | 38145403518 | push | e413661 | e413661 | First publication (PR #1 merge) |
| 14:02:21 | 38145564140 | dispatch `ref=drill/p04-wrong-stylesheet` | e413661 | fdc0109 | Break-it: wrong stylesheet path |
| 14:03:22 | 38145632026 | dispatch `ref=bd59e6e...` | e413661 | bd59e6e | Break-it: repaired path |
| 14:04:07 | 38145681246 | dispatch `ref=main` | e413661 | e413661 | Back to `main` |
| 14:06:56 | 38145871389 | push | c797230 | c797230 | PR #2 merge |
| 14:08:06 | 38145950551 | dispatch `ref=e413661...` | c797230 | e413661 | **Rollback** to the PR #1 page |
| 14:09:03 | 38146012159 | dispatch `ref=main` | c797230 | c797230 | Roll forward |

All seven runs concluded `success`. The two "commit" columns are different, and that matters:

```text
$ gh api repos/itsbhavinrey/studytrack-platform/deployments --jq '.[0:6][]|.created_at+" "+.sha[0:7]+" "+.environment+" "+.ref'
2026-10-11T14:09:19Z c797230 github-pages main
2026-10-11T14:08:19Z c797230 github-pages main     <- the rollback: GitHub records c797230, the site served e413661
2026-10-11T14:07:12Z c797230 github-pages main
2026-10-11T14:04:20Z e413661 github-pages main
2026-10-11T14:03:33Z e413661 github-pages main     <- the repaired drill: GitHub records e413661, the site served bd59e6e
2026-10-11T14:02:34Z e413661 github-pages main     <- the broken drill: GitHub records e413661, the site served fdc0109
```

(The `<-` notes were added to the output.) GitHub's deployment record stores the commit the *workflow* ran on, which is always `main` for a manual run. It does not store the commit that was checked out and uploaded. That is why the workflow writes `version.txt` from `git rev-parse HEAD` of the checked-out tree, and why "which commit is live?" is answered by asking the public site:

```text
$ curl -s https://itsbhavinrey.github.io/studytrack-platform/version.txt
commit: c79723033d224484b6edb408c4fabe457fdae3f0
ref: main
run: 38146012159
```

## 3. DNS evidence (R3)

```text
$ dig itsbhavinrey.github.io A +noall +answer
itsbhavinrey.github.io.	3600	IN	A	185.199.109.153
itsbhavinrey.github.io.	3600	IN	A	185.199.111.153
itsbhavinrey.github.io.	3600	IN	A	185.199.110.153
itsbhavinrey.github.io.	3600	IN	A	185.199.108.153
$ dig itsbhavinrey.github.io AAAA +noall +answer
itsbhavinrey.github.io.	3600	IN	AAAA	2606:50c0:8003::153
itsbhavinrey.github.io.	3600	IN	AAAA	2606:50c0:8000::153
itsbhavinrey.github.io.	3600	IN	AAAA	2606:50c0:8002::153
itsbhavinrey.github.io.	3600	IN	AAAA	2606:50c0:8001::153
$ dig itsbhavinrey.github.io CNAME +noall +comments +answer   (trimmed: header only, no answer lines)
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 25884
```

Reading it (C3): the question was the **name** `itsbhavinrey.github.io`. The answer is four IPv4 **addresses** (A records) and four IPv6 addresses (AAAA records), each cacheable for 3600 seconds. There is no CNAME: the name maps directly to GitHub Pages' shared front-end addresses. DNS never saw `https://`, `/studytrack-platform/` or `styles.css`, because those are not part of a DNS question.

## 4. HTTPS evidence (R4)

The TLS handshake and certificate, from `openssl s_client -connect itsbhavinrey.github.io:443 -servername itsbhavinrey.github.io` (trimmed):

```text
    Protocol  : TLSv1.3
    Verify return code: 0 (ok)
subject= /CN=*.github.io
issuer= /C=US/O=Let's Encrypt/CN=YR1
notBefore=Aug  2 23:38:02 2026 GMT
notAfter=Oct 31 23:38:01 2026 GMT
    X509v3 Subject Alternative Name:
        DNS:*.github.com, DNS:*.github.io, DNS:*.githubusercontent.com, DNS:github.com, DNS:github.io, DNS:githubusercontent.com
```

The certificate is valid today, chains to a trusted root (`Verify return code: 0`), and `*.github.io` covers the hostname. Plain HTTP is redirected to HTTPS:

```text
$ curl -sI http://itsbhavinrey.github.io/studytrack-platform/
HTTP/1.1 301 Moved Permanently
Location: https://itsbhavinrey.github.io/studytrack-platform/
```

The full request path from `curl -sv` (trimmed to the connection, TLS and request lines):

```text
* Host itsbhavinrey.github.io:443 was resolved.
*   Trying [2606:50c0:8002::153]:443...
* Connected to itsbhavinrey.github.io (2606:50c0:8002::153) port 443
* ALPN: curl offers h2,http/1.1
* SSL connection using TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256 / [blank] / UNDEF
* ALPN: server accepted h2
> GET /studytrack-platform/ HTTP/2
> Host: itsbhavinrey.github.io
> User-Agent: curl/8.7.1
> Accept: */*
< HTTP/2 200
```

## 5. HTTP evidence: document, stylesheet, status codes (R3)

Command-line client (`curl -sI`, header lines trimmed to status, type and caching), taken against the first publication `e413661`:

```text
$ curl -sI https://itsbhavinrey.github.io/studytrack-platform
HTTP/2 301
location: https://itsbhavinrey.github.io/studytrack-platform/

$ curl -sI https://itsbhavinrey.github.io/studytrack-platform/
HTTP/2 200
server: GitHub.com
content-type: text/html; charset=utf-8
cache-control: max-age=600
content-length: 6077

$ curl -sI https://itsbhavinrey.github.io/studytrack-platform/styles.css
HTTP/2 200
server: GitHub.com
content-type: text/css; charset=utf-8
cache-control: max-age=600
content-length: 10026

$ curl -sI https://itsbhavinrey.github.io/studytrack-platform/does-not-exist
HTTP/2 404
content-type: text/html; charset=utf-8
```

**Browser network evidence.** `scripts/check-site.mjs` loads the page in headless Chrome and records the DevTools Protocol `Network` events. These are the same data the DevTools Network panel shows. The panel UI itself cannot be opened headlessly, so the rows are recorded as text. Run against the current deployment `c797230` at 1280px (reformatted onto fewer lines):

```json
{
  "url": "https://itsbhavinrey.github.io/studytrack-platform/",
  "checkedAt": "2026-10-11T14:07:49.483Z",
  "width": 1280,
  "requests": [
    { "url": "https://itsbhavinrey.github.io/studytrack-platform/", "method": "GET", "type": "Document",
      "status": 200, "contentType": "text/html; charset=utf-8", "protocol": "h2",
      "remoteAddress": "[2606:50c0:8002::153]:443", "securityState": "secure",
      "certificateSubject": "*.github.io", "certificateIssuer": "YR1" },
    { "url": "https://itsbhavinrey.github.io/studytrack-platform/styles.css", "method": "GET", "type": "Stylesheet",
      "status": 200, "contentType": "text/css; charset=utf-8", "protocol": "h2",
      "remoteAddress": "[2606:50c0:8002::153]:443", "securityState": "secure",
      "certificateSubject": "*.github.io", "certificateIssuer": "YR1" }
  ]
}
```

The browser connected to `2606:50c0:8002::153`, one of the AAAA addresses from section 3. The DNS answer, the TCP connection and the HTTP response line up.

## 6. Public page verification (R4)

`node scripts/check-site.mjs https://itsbhavinrey.github.io/studytrack-platform/ --screenshots ...` against `c797230` exited 0. Per width:

| Width | `scrollWidth` / `clientWidth` | Horizontal scroll | Stylesheet loaded | Required-resource failures |
| --- | --- | --- | --- | --- |
| 360 | 360 / 360 | no | `styles.css`, 55 rules, body background `rgb(245, 247, 250)` | 0 |
| 1280 | 1280 / 1280 | no | `styles.css`, 55 rules | 0 |

Screenshots of the public page: `screenshots/public-360.jpg`, `screenshots/public-1280.jpg`.

All resource links:

- Local resources: the only `href`/`src` that loads a file is `styles.css` (200 `text/css`). The other in-page links are `#fragment` links. The browser handles them without a request.
- External links (the three resources) point to other hosts. The page does not load them; they are plain navigation links.
- One extra request is not made by the page. Chrome asks for `/favicon.ico` at the **host root**, `https://itsbhavinrey.github.io/favicon.ico`, and gets 404. The page does not reference a favicon, and the 404 does not affect rendering. That URL belongs to the `itsbhavinrey.github.io` user site (which does not exist), not to this project site. The checker reports it but does not count it as a required resource.

Since PR #2, the workflow's `verify` job also checks every deployment against the public site. From run 38145871389:

```text
Site: https://itsbhavinrey.github.io/studytrack-platform/  expected commit: c79723033d224484b6edb408c4fabe457fdae3f0
GET https://itsbhavinrey.github.io/studytrack-platform/ -> 200 text/html; charset=utf-8
GET https://itsbhavinrey.github.io/studytrack-platform/styles.css -> 200 text/css; charset=utf-8
GET https://itsbhavinrey.github.io/studytrack-platform/no/such/page -> 404 text/html; charset=utf-8
resource styles.css -> 200
```

### Stretch: static 404 page

`https://itsbhavinrey.github.io/studytrack-platform/plans/week-9` returns **404** with our `404.html` (title "Page not found - StudyTrack learner profile"). Its stylesheet loads with 200 even at that nested path, because `404.html` uses the root-relative URL `/studytrack-platform/styles.css`:

```text
Document   404 text/html; charset=utf-8  https://itsbhavinrey.github.io/studytrack-platform/plans/week-9
Stylesheet 200 text/css; charset=utf-8   https://itsbhavinrey.github.io/studytrack-platform/styles.css
```

Screenshot: `screenshots/notfound-1280.jpg`. The status stays 404 (not 200), so search engines and tools still see a missing page.

## 7. Rollback (R5)

The known-good earlier page is `e413661` (PR #1, the unchanged P3 page, verified in sections 5 and 6). The current page is `c797230` (PR #2, with changed goal text and the custom 404 page). Procedure and real output (`<-` notes added):

```text
# before rollback
$ curl -s https://itsbhavinrey.github.io/studytrack-platform/version.txt
commit: c79723033d224484b6edb408c4fabe457fdae3f0
$ curl -s https://itsbhavinrey.github.io/studytrack-platform/ | grep -A1 'Project 4'
          Project 4 published this page on the internet. Next up: the
          interactive weekly planner in Project 5.
$ gh workflow run pages.yml --ref main -f ref=e4136617459b048ca91ce491428918917b19b46d
https://github.com/itsbhavinrey/studytrack-platform/actions/runs/38145950551
run 38145950551: success build=success,deploy=success,verify=success
# after rollback
$ curl -s https://itsbhavinrey.github.io/studytrack-platform/version.txt
commit: e4136617459b048ca91ce491428918917b19b46d
ref: e4136617459b048ca91ce491428918917b19b46d
run: 38145950551
$ curl -s https://itsbhavinrey.github.io/studytrack-platform/ | grep -A1 'Next up'
          Next up: publishing this page on the internet in Project 4.
$ curl -sI https://itsbhavinrey.github.io/studytrack-platform/no/such/page
HTTP/2 404
content-length: 9379          <- GitHub's generic 404; e413661 had no 404.html
check-site on rolled-back page: exit=0 ok=true
$ gh workflow run pages.yml --ref main -f ref=main   # roll forward
run 38146012159: success build=success,deploy=success,verify=success
# after roll-forward
commit: c79723033d224484b6edb408c4fabe457fdae3f0
HTTP/2 404
content-length: 1129          <- our 404.html is back
```

The rollback restored the previous page's text and behaviour (no custom 404), and the browser check passed on it. Before the run went green, the `verify` job confirmed that the public site served exactly `e413661`. Rolling forward restored `c797230`. The procedure is in the README.

## 8. Failure report: deliberately wrong stylesheet path

- **Fault.** On the temporary branch `drill/p04-wrong-stylesheet`, commit `fdc0109` changed `<link rel="stylesheet" href="styles.css">` to `href="css/styles.css"` (no such folder). It was published with `gh workflow run pages.yml --ref main -f ref=drill/p04-wrong-stylesheet` (run 38145564140). The build and deploy jobs both **succeeded**: a green deploy says nothing about whether the page works (C2).
- **Symptom.** The page rendered as unstyled HTML: Times font, transparent background, bulleted nav, default table (`screenshots/drill-broken-1280.jpg`, `screenshots/drill-broken-360.jpg`).
- **Evidence.** Network events from headless Chrome (both widths showed the same; trimmed):

  ```text
  GET Document   200 text/html; charset=utf-8  https://itsbhavinrey.github.io/studytrack-platform/
  GET Stylesheet 404 text/html; charset=utf-8  https://itsbhavinrey.github.io/studytrack-platform/css/styles.css  net::ERR_ABORTED
  stylesheets: [{"href":".../studytrack-platform/css/styles.css","rules":0}]  bodyBackground: rgba(0, 0, 0, 0)  bodyFontFamily: Times
  failures [[404,"https://itsbhavinrey.github.io/studytrack-platform/css/styles.css"]]   (check-site exit 1)
  ```

  And with curl:

  ```text
  $ curl -s https://itsbhavinrey.github.io/studytrack-platform/version.txt
  commit: fdc0109bfc4d724dfdf87f2560d41d7316fb5911
  ref: drill/p04-wrong-stylesheet
  $ curl -s https://itsbhavinrey.github.io/studytrack-platform/ | grep stylesheet
    <link rel="stylesheet" href="css/styles.css">
  $ curl -sI https://itsbhavinrey.github.io/studytrack-platform/css/styles.css
  HTTP/2 404
  content-type: text/html; charset=utf-8
  $ curl -sI https://itsbhavinrey.github.io/studytrack-platform/styles.css
  HTTP/2 200
  content-type: text/css; charset=utf-8
  ```

  Diagnosis: the document itself was fine (200). The browser resolved the relative `css/styles.css` against the page URL `.../studytrack-platform/` and asked for `/studytrack-platform/css/styles.css`. The server had no file at that path, so it answered 404 with an HTML error page. The Network event shows Chrome aborted that load (`net::ERR_ABORTED`), and no CSS rules were applied. The file was still there at the right path (`styles.css` → 200): the fault was the URL, not a missing file.
- **Repair.** Commit `bd59e6e` on the same branch restored `href="styles.css"`, making the branch's `web/` identical to `main`. It was deployed with run 38145632026.
- **Verification.** `version.txt` reported `bd59e6e`. Chrome recorded `Stylesheet 200 text/css; charset=utf-8 .../studytrack-platform/styles.css`, 55 rules and background `rgb(245, 247, 250)`, and check-site exited 0 (`screenshots/drill-repaired-1280.jpg`). `main` was then redeployed (run 38145681246, `version.txt` = `e413661`). The drill branch was deleted locally and on GitHub (`git ls-remote --heads origin` no longer lists it).
- **Prevention (added after the drill).** `test/web.test.js` checks that every local `href`/`src` in `web/*.html` resolves to a file in `web/`, and the workflow runs `npm test` before uploading. With the drill's `href` put back temporarily:

  ```text
  $ npm run test:web   (with href="css/styles.css")
  ✖ index.html: every local href/src points at a file in web/
  ℹ tests 6
  ℹ pass 5
  ℹ fail 1
    AssertionError [ERR_ASSERTION]: index.html: "css/styles.css" -> css/styles.css does not exist
  ```

  The same fault would now stop in the build job and never be uploaded. If a bad path reached the site some other way, the `verify` job would turn the run red.

## 9. Which part DNS resolves and which part the web server handles

Take `https://itsbhavinrey.github.io/studytrack-platform/styles.css`:

| Part | Value | Who handles it |
| --- | --- | --- |
| Scheme | `https` | The browser: use TLS, on port 443 by default. |
| Host name | `itsbhavinrey.github.io` | **DNS** turns it into addresses (`185.199.108-111.153`, `2606:50c0:800x::153`). The name is sent again inside the TLS handshake (SNI) and in the HTTP `Host`/`:authority` header, so the shared GitHub server knows which site is wanted. |
| Port | `443` (implied) | TCP: the browser connects to address:443. |
| Path | `/studytrack-platform/styles.css` | **The web server** (GitHub Pages): it maps the path to a file in the deployed artifact and answers with a status code and headers such as `Content-Type`. |
| Fragment (e.g. `#plan`) | after `#` | The browser only. It is never sent to DNS or the server. |

DNS does not return a URL or a page. It answers "what addresses does this name have?" Everything after the host name is decided by the web server, including whether `/studytrack-platform/css/styles.css` exists (404) or not. The drill shows this: DNS and TLS were identical for the broken and the fixed page. Only the HTTP path and the server's status changed.

## 10. Definition of done

- [x] Public HTTPS page works with no required-resource failures: document 200 `text/html`, stylesheet 200 `text/css`, valid `*.github.io` certificate, HTTP redirects to HTTPS, no horizontal scroll at 360 or 1280 (sections 4-6).
- [x] PR and deployed commit are identifiable: PR #1 → `e413661`, PR #2 → `c797230`. `version.txt` on the public site names the served commit (sections 1-2).
- [x] DNS and HTTP evidence is recorded (sections 3-5).
- [x] Broken-asset diagnosis and rollback are demonstrated (sections 7-8).

## 11. Not observed, or left for the owner

- No human opened the DevTools Network **panel**. The same request/response data was captured from the DevTools Protocol. To see it yourself, open https://itsbhavinrey.github.io/studytrack-platform/ with DevTools → Network ("Disable cache" ticked) and reload; it shows the same two rows.
- GitHub Pages sends `cache-control: max-age=600`. The checks above used cache-busting query strings, or a fresh browser profile with caching disabled. A normal visitor's browser may show the previous version for up to 10 minutes after a deploy or rollback.
- All measurements were taken from one network, which preferred IPv6. Other networks get the same DNS answer but may connect over IPv4.

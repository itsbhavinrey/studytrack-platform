# PROJECT 4 - First website on the internet

**Size:** 2 weeks, 20-30 hours total | **Mode:** Extends Project 3.

Source: *sixty-week-spine* curriculum, section "PROJECT 4 - First website on the internet". This file restates the brief as a checklist and records the decisions taken while building it.

## Why now

Opening `web/index.html` from disk (P3) hides the request and deployment path. Publishing the same small page lets us trace a real browser request (DNS lookup, TLS, HTTP request, response status and headers) without any backend.

## New topics

- Common > Fundamentals > Networking: HTTP/HTTPS, URLs, DNS, requests, responses, and status codes.
- Common > Dev environment and deployment: publishing a static artifact.
- Common > VCS and hosting > GitHub: remote branches, a pull request, and merge workflow.

## Reinforced topics

- P3 HTML/CSS: correct relative resource URLs after publication (the page moves from `file:///.../web/` to `https://<host>/studytrack-platform/`).
- P1 Git: compare local commits with the remote branch (`git status -sb`, `git log origin/main..main`).
- P2 README: a reproducible publishing and rollback procedure.

## The build

A publicly reachable study profile with a working browser-to-host request path.

## Requirements checklist

- [ ] R1. Publish the P3 static page on a static host (GitHub Pages, provider subdomain `itsbhavinrey.github.io`).
- [ ] R2. Make the publication change on a branch, open a PR, inspect its diff, then merge it.
- [ ] R3. Record the hostname's DNS answer, the document's HTTP status, and the `Content-Type` of the stylesheet (command-line client and browser network events).
- [ ] R4. Verify HTTPS, all resource links, and both P3 viewport sizes (360px, 1280px) at the public URL.
- [ ] R5. Record the deployed commit and prove the previous known-good page can be restored.

## Constraints checklist

- [ ] C1. No custom domain purchase and no backend: static files only, provider subdomain.
- [ ] C2. A successful upload is not verification: inspect the public page itself (status codes, headers, rendered page).
- [ ] C3. Distinguish names, addresses and HTTP paths: DNS answers `itsbhavinrey.github.io` with IP addresses; `/studytrack-platform/styles.css` is an HTTP path the web server handles.

## Break it on purpose

- [ ] Publish a deliberately wrong stylesheet path. Observe its 404 in the network events and the unstyled page; repair the path, redeploy, verify a 200. Record fault, symptom, evidence, repair, verification.

## Definition of done

- [ ] Public HTTPS page works with no required-resource failures.
- [ ] PR and deployed commit are identifiable.
- [ ] DNS and HTTP evidence is recorded.
- [ ] Broken-asset diagnosis and rollback are demonstrated.

## Stretch goal

- [ ] Optional: a useful static 404 page.

## Report back with

- Public URL, repository, and PR.
- Network-panel evidence for document and stylesheet; DNS output.
- Deployment/rollback notes and failure report.
- Explain which part DNS resolves and which part the web server handles.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Host | GitHub Pages on the provider subdomain: `https://itsbhavinrey.github.io/studytrack-platform/` | The brief's default; free for a public repo; HTTPS certificate is provided for `*.github.io`; no domain purchase (C1). |
| Publishing source | A GitHub Actions workflow (`.github/workflows/pages.yml`) that uploads **only `web/`** as the Pages artifact | "Deploy from a branch" can only publish the repository root or `/docs`. The root would also publish the CLI, tests and docs, and the page would live at `/studytrack-platform/web/`. `/docs` is already used for project documentation. A workflow lets `web/` become the site root without moving files, so P3's relative URL `styles.css` keeps working unchanged. |
| Action versions | `actions/checkout` v7.0.1, `actions/setup-node` v7.0.0, `actions/configure-pages` v6.0.0, `actions/upload-pages-artifact` v5.0.0, `actions/deploy-pages` v5.0.1, each pinned to its full commit SHA with the tag in a comment | All are GitHub's own maintained actions and each release is more than two weeks old. A SHA cannot be moved the way a tag can, so the build is reproducible. |
| Tests before deploy | The build job runs `npm test` before uploading | A broken commit should not reach the public site. |
| Deployed-commit marker | The workflow writes `version.txt` (commit SHA, ref, run id) into the artifact | Lets anyone ask the *public site* which commit it is serving (`curl .../version.txt`), independent of what GitHub's UI says (C2). GitHub's deployments API records the same SHA as a second source. |
| Trigger | `push` to `main` touching `web/**` or the workflow, plus `workflow_dispatch` with an optional `ref` input | Doc-only commits do not redeploy (so the recorded deployed commit stays meaningful). The `ref` input deploys any earlier commit: this is the **rollback** mechanism, and it is how the break-it drill publishes a branch. The workflow file itself always runs from `main`, so the `github-pages` environment's branch rule still applies. |
| Merge method | "Create a merge commit" | The merge commit (`Merge pull request #N ...`) names the PR, so the deployed SHA leads straight back to the PR. |
| Rollback procedure | Primary: `gh workflow run pages.yml -f ref=<known-good-sha>`; then roll forward with `-f ref=main`. Permanent alternative: `git revert` on a branch + PR | Re-deploying a known-good commit is fast and does not rewrite history. If the bad change must not come back on the next push, a revert PR makes the fix permanent. |
| Break-it drill | A temporary branch with a wrong stylesheet `href`, deployed with `workflow_dispatch -f ref=<branch>`; repaired on the branch and redeployed; then `main` redeployed and the branch deleted | Publishes a real fault without merging a broken commit into `main` (owned, disposable environment). |
| Evidence tools | `dig`, `curl -sv`/`curl -I`, `openssl s_client`, and headless Chrome driven over the DevTools Protocol (Network domain events and `Emulation.setDeviceMetricsOverride` at 360 and 1280) | The Network domain is exactly the data the DevTools Network panel displays. The panel UI itself cannot be opened headlessly, so the events are recorded as text instead of a picture of the panel. |
| Published content | Same neutral sample learner as P3, no personal data | The page is now public; nothing personal is published. |

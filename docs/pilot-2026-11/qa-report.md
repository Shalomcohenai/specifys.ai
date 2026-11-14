# Pilot QA report, 14 November 2026

Independent QA of the unmerged improvement pilot. Nothing in this round was merged, pushed to `main`, or deployed. Preview deployments are behind Vercel SSO, so every runtime check used a local production build (`npm run build:css:min`, then `bundle exec jekyll build`) served by `python3 -m http.server` on `127.0.0.1`. That server does not gzip and does not speak HTTP/2, so absolute Lighthouse numbers are harsher than production, especially on mobile. The paired delta against a local build of `main` is the comparison that this report uses.

Base commit for every PR: `3e89318f` (`main`).

GitHub CI is green on PRs #18–#25 (Lint, Build, Test, Vercel, Vercel Preview Comments). That green does not mean the tests ran. `.github/workflows/ci.yml` sets `continue-on-error` on `npm run build:vite` and `bundle exec jekyll build`, and the Test job runs `npm test || echo "Tests not configured"`. The root `test` script is `echo "Error: no test specified" && exit 1`.

## Per-PR results

| PR | Branch | Verdict | Payments, permissions, or data shape | Rollback |
|---|---|---|---|---|
| [#18](https://github.com/Shalomcohenai/specifys.ai/pull/18) | `cursor/improvement-pilot-2026-11-8487` @ `81feee18` | Pass, with a QA commit | No | Revert the merge commit |
| [#19](https://github.com/Shalomcohenai/specifys.ai/pull/19) | `cursor/security-audit-8487` | Pass as docs. Redundant with #20 | No code change | Revert the merge commit, or close without merging |
| [#20](https://github.com/Shalomcohenai/specifys.ai/pull/20) | `cursor/ux-review-8487` | Pass with one environment failure | No | Revert the merge commit |
| [#21](https://github.com/Shalomcohenai/specifys.ai/pull/21) | `cursor/accessibility-improvements-8487` | Pass locally. Owner must accept the colour | No | Revert the merge commit |
| [#22](https://github.com/Shalomcohenai/specifys.ai/pull/22) | `cursor/loading-empty-error-states-b111` @ `504ffc16` | Pass, with a QA commit. Conflicts with #23 | No payment or schema change. Notice copy around the existing paywall | Revert the merge commit |
| [#23](https://github.com/Shalomcohenai/specifys.ai/pull/23) | `cursor/homepage-performance-22d4` @ `e1628249` | Pass, finished in this QA. Conflicts with #22 | No payment, auth-mechanism, or rules change. Analytics load is delayed | Revert the merge commit |
| [#24](https://github.com/Shalomcohenai/specifys.ai/pull/24) | `cursor/security-headers-22d4` | Pass on build and code review. Headers not observed live | No | Revert the merge commit |
| [#25](https://github.com/Shalomcohenai/specifys.ai/pull/25) | `cursor/firestore-contact-rules-22d4` | Left draft. Not approved | Yes. Firestore rules for `contactSubmissions`, plus a lockfile rewrite | Do not merge. If rules were ever deployed, roll them back with a rules deploy. This round did not deploy them |

### #18 Build fix and Mermaid smoke

Not redundant with later PRs. `vite.config.js` is the only change that removes `firebase/app`, `firebase/auth`, and `firebase/firestore` from Vite `manualChunks`. On `main`, `npm run build:vite` still fails with `Could not resolve entry module "firebase/app"`. On this branch the Vite build completed in 1.69s. The empty `core`, `auth`, and `blog` chunks are a pre-existing warning. Jekyll does not ship the Vite bundles (`_config.yml` excludes `assets/dist`, and `build:vercel` ignores a Vite failure), so this fix does not change the live site until something starts consuming the Vite output. It is still the build break on `main`.

QA commit `81feee18`:

- Restored the 11 tracked `_site` files to `main`. The branch had committed a Jekyll snapshot that mixed `http://localhost:4000` into `og:image`, the feed, and JSON-LD. Vercel rebuilds `_site`, so those files should not be part of the PR.
- The smoke test had been relaxed to `toBeGreaterThanOrEqual(0)`, which passes when Mermaid never loads. It is `toBeGreaterThan(0)` again.

Tests run:

- `npm run build:vite` on the branch: pass, 1.69s. The new commit does not touch `vite.config.js`.
- `npx playwright test tests/e2e/spec-viewer.spec.js` against the local `main` site at `http://127.0.0.1:4173`: 1 passed, 1.1s, after the assertion was tightened.
- Backend `node --test server/*.test.js` from `backend/` on `main`: 6 files passed, 0 failed, 387ms. This PR does not change backend source, so that run covers it.

Not run: a fresh Jekyll build after the `_site` revert. That commit only puts generated HTML back to `main` and edits the Playwright file. The site source of this PR is otherwise docs plus `vite.config.js`.

Risk: the wait in the smoke test still succeeds if `window.mermaid` is set. The current mock sets that flag inside the loader that increments the counter, so a passing wait implies a load. A future mock that sets `window.mermaid` without loading would hide a regression.

### #19 Security audit docs

Docs only (`docs/improvement-rounds/2026-11-security-audit.md`). No build, payment, permission, or schema change. Jekyll was not repeated; the site source matches `main`.

`docs/improvement-rounds/2026-11-security-audit.md` is blob `5f8aafac` on both #19 and #20. Merging #20 already brings that file. #19 can be merged first (clean) or closed as redundant after #20 merges.

### #20 UX review docs and Playwright

Docs plus `tests/ux-review/ux-review.spec.js` and `playwright.ux-review.config.js`. No product code.

Tests run against the local `main` build, not production and not the SSO preview:

`UX_REVIEW_URL=http://127.0.0.1:4173 npx playwright test --config=playwright.ux-review.config.js`

12 passed, 1 failed, 42.5s. The failure is `UX Review - Empty States › Check for empty state messaging`. It died in `page.screenshot` with `Protocol error (Page.captureScreenshot): Unable to capture screenshot` while opening `/pages/user-dashboard.html`. The test does not assert that an empty state exists; it only logs a count and takes a screenshot. This is an environment failure of the screenshot call, not a product assertion. The earlier "12/13" claim is reproduced as a pass count, with a different failure mode than a missing empty state.

Console-error test logged 9 messages, all `404` or `ERR_CONNECTION_REFUSED` against the local static server (no API). The test does not fail on those.

Not run: the suite against production. Backend tests are unchanged from the `main` run above.

### #21 Accessibility and the orange

Local Lighthouse 12, accessibility category only, on the branch's Jekyll build at `http://127.0.0.1:4175/`:

- Mobile: 100, no failing audits
- Desktop: 100, no failing audits

A full four-category run of `main` and of #23 still scores accessibility 74, because those builds do not contain this PR. The 100 is real for this branch under an accessibility-only audit. It was not re-checked as part of a performance run.

The visible change is the hero **Start free** button and **See example** text, plus matching spots in the value section, from `#FF6B35` to `#B33A00` (hover around `#9A3412`). White on `#B33A00` is about 6:1. The header **Pricing** button and most of the rest of the site stay `#FF6B35`, so the homepage uses two oranges until the owner picks one palette.

Screenshots (local build, 1440 and 390) are attached to the QA pull request: `homepage_main_cta_desktop_1440.png`, `homepage_pr21_cta_desktop_1440.png`, `homepage_main_mobile_390.png`, `homepage_pr21_mobile_390.png`.

No new unit test. No payment, permission, or schema change.

Owner decision: accept `#B33A00` on those controls, or keep the brand orange and fix contrast another way. Do not merge #21 until that choice is made.

### #22 Progress, empty, and error states

The branch adds `assets/js/features/spec-flow-feedback.js` and `assets/css/components/flow-states.css`, and wires them into the homepage generation flow, profile, and spec viewer.

QA commit `504ffc16`: after a credit stop, `showPaywall()` or the pricing redirect already tells the visitor what to do. The code then also called `reportGenerationStop('credits')`, which replaced the progress card with a second "no credits" alert. The progress host is now cleared when the paywall or the redirect runs. The alert remains only if the redirect throws. Credit consume, the paywall function, and the pricing URL are unchanged.

Tests run after that commit:

- `node --test assets/js/features/spec-flow-feedback.test.js`: 5 passed
- `npx playwright test tests/e2e/spec-flow-feedback.spec.js`: 1 passed, 590ms
- `node --check` on the edited `index.js`: pass
- Jekyll build of the branch: pass (output used for screenshots)

Not run: a logged-in generation against Firebase or the API. The states in the screenshots are rendered by the helper with dummy copy, the same way the Playwright spec drives them. There is no automated test that a credit stop no longer double-paints. Backend tests are the `main` run; this PR does not change `backend/`.

Screenshots: `spec_flow_states_pr22_desktop_1440.png` and `spec_flow_states_pr22_mobile_390.png`. Homepage shots at both widths are attached as `homepage_pr22_*`. The progress card repeats "Saving your brief" as the title and the current step. That matches the helper's current copy.

### #23 Homepage performance

This was the interrupted PR. Two gaps were finished on the branch:

1. `generateSpecification` and `saveSpecToFirebase` called `firebase.firestore()` without waiting. The homepage now loads Auth immediately and Firestore only through `window.__specifysEnsureFirestore`, and the Start click fired that loader without awaiting it. A fast generate, or a slow network, threw. Both paths now `await ensureFirestoreForSave()` after the credit check and before the write.
2. Desktop TBT did not move until Vanta was deferred. The hero is on screen at first paint, so the intersection observer loaded Three.js and `vanta.net.min.js` during the Lighthouse window (about 2.4s of main-thread bootup). Vanta now starts on the first pointer, key, touch, or wheel event, or 20 seconds after `load` if the visitor never interacts. The hero already has a solid `#333333` background, and `#vanta-net` stays at opacity 0 until the animation starts.

What was already on the branch, and is still there: deferred Firebase Auth, Firestore only on demand, the RelayDesk diagram inlined as SVG, gtag delayed until interaction or 20 seconds (measurement IDs unchanged), deferred `localStorage-safe.js` and the contact modal, homepage utility CSS no longer blocking first paint.

Lighthouse 12, simulated throttling, headless Chrome, local production build, 14 November 2026.

`main` at `http://127.0.0.1:4173/`:

| | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed index |
|---|---|---|---|---|---|---|---|---|---|
| Mobile | 49 | 74 | 71 | 92 | 5.1 s | 6.0 s | 670 ms | 0.009 | 5.1 s |
| Desktop | 64 | 74 | 70 | 92 | 1.0 s | 1.2 s | 990 ms | 0.031 | 2.1 s |

#23 after the Vanta defer, at `http://127.0.0.1:4174/`:

| | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed index |
|---|---|---|---|---|---|---|---|---|---|
| Mobile | 70 | 74 | 93 | 92 | 3.9 s | 5.6 s | 0 ms | 0.009 | 3.9 s |
| Desktop | 97 | 74 | 93 | 92 | 0.9 s | 1.1 s | 0 ms | 0.031 | 0.9 s |

The same #23 build before the Vanta defer already had mobile TBT at 0 ms and performance 70, because Lighthouse's mobile user agent never starts Vanta. Desktop was performance 66 and TBT 1,070 ms, with `vanta.net.min.js` at 2,417 ms of bootup. That is the gap the defer closes.

User-supplied production baseline, not re-measured here: mobile performance 66, desktop 64, TBT about 1.1–1.2 s. Local desktop `main` matched that 64. Local mobile `main` scored 49 rather than 66 because the static server is slow under simulated mobile throttling and does not compress text (Lighthouse's top opportunity). Do not treat 70 or 97 as the production score. Re-measure production after a deploy.

The PR body reports a Vercel preview of mobile 94 / desktop 78 / desktop TBT 470 ms, and says the animation was left unchanged. Those preview numbers were not reproduced. The preview is behind SSO, and the animation is no longer unchanged.

Screenshots of the local #23 build show the solid hero (the net is deferred) and the inlined diagram already painted at 390px, where the `main` first viewport still had an empty diagram well. Files: `homepage_pr23_desktop_1440.png`, `homepage_pr23_mobile_390.png`, `homepage_pr23_diagram_desktop_1440.png`, plus the `main` pair.

Not run: a signed-in save that proves the Firestore await against a live project. The helper throws if Firestore never arrives, which is the previous failure mode made explicit. No pricing, Lemon Squeezy, auth mechanism, or rules change. Delaying gtag means a bounce with no interaction inside 20 seconds is not counted. That is a measurement tradeoff, left as the branch already designed it.

### #24 Security headers

`vercel.json` adds three headers on `/(.*)`:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN`

There is no `Content-Security-Policy` and no `frame-ancestors`.

`node` parsed `vercel.json`. `bundle exec jekyll build` of this branch succeeded (3.8s). The local static server does not send these headers, so they were not observed on a response. They appear on the next Vercel deployment. This QA did not deploy.

Embed check, from the code on the branch:

- Lemon Squeezy checkout is an overlay whose iframe is on `lemonsqueezy.com`. `X-Frame-Options` on our response does not stop us from framing their origin. It stops other origins from framing `specifys.ai`.
- Google sign-in uses `signInWithPopup` (a popup). The Firebase auth helper iframe is on the `firebaseapp.com` auth domain, not a frame of our document.
- The admin email and newsletter previews are same-origin iframes with `sandbox`. SAMEORIGIN allows them.
- No page was found that needs a third-party site to embed `specifys.ai`.

`strict-origin-when-cross-origin` sends the origin, not the full URL, on cross-origin requests. Checkout and analytics still receive the origin. Worth a look at referrer-dependent dashboards after deploy, not a reason to block the header.

No payment, permission, or schema change.

### #25 Firestore contact rules (draft)

Left as a draft. Not merged, not deployed, rules tests not re-run (they need the Firestore emulator and a JDK). The diff adds a `contactSubmissions` match: admin read, client create/update/delete denied. It also rewrites `backend/package-lock.json` (about 9,631 insertions and 1,793 deletions) and adds emulator test dependencies. Client writes to that collection are denied even for a signed-in user. Reads use the existing client `isAdmin()` email check, so a browser session for that admin can read submissions after a rules deploy. The Admin SDK path is separate and is not changed by rules. Do not `firebase deploy`. Owner decision, and the lockfile rewrite is an extra reason to keep it out of this round.

## Lighthouse before and after

Same machine, Lighthouse 12, simulated throttling, local Jekyll output, no compression.

| | Mobile perf | Mobile TBT | Desktop perf | Desktop TBT | Accessibility |
|---|---|---|---|---|---|
| Production baseline (given, not re-run) | 66 | ~1.1–1.2 s | 64 | ~1.1–1.2 s | 74 (claimed) |
| Local `main` | 49 | 670 ms | 64 | 990 ms | 74 |
| Local #23 before Vanta defer | 70 | 0 ms | 66 | 1,070 ms | 74 |
| Local #23 finished | 70 | 0 ms | 97 | 0 ms | 74 |
| Local #21, accessibility category only | — | — | — | — | 100 / 100 |

Best practices on the finished #23 build are 93, up from 71 mobile and 70 desktop, because gtag and the other deferred third parties stay out of the initial load. SEO stays 92. Accessibility stays 74 until #21.

## Merge order

`git merge-tree --write-tree` between the current PR heads. Do not merge any of these from this report.

Clean against each other: #18, #19, #20, #21, #24, and #25, in every pair that was checked, including #21 with #22 and #21 with #23. `index.html` auto-merges for #22 and #23. The one real conflict is #22 with #23 in `assets/js/features/index/index.js` (two hunks). Both hunks are additive. Keep both:

- #22's `reportGenerationStop`, `markGenerationStage`, `startGenerationProgress()`, and `markGenerationStage(1)`
- #23's `ensureFirestoreForSave` and `await ensureFirestoreForSave()` immediately before the queue write

Then load the homepage and a credit-stop path on that combined tree before the second of those two merges. This QA did not boot that combined tree, because the conflict has no clean automatic result.

Suggested order, each one a production deploy:

1. #19, then #20. Or merge only #20 and close #19, since the audit file is the same blob. Docs only, but `main` still rebuilds and deploys.
2. #18. Unique Vite fix. The `_site` snapshot is gone.
3. #24. Headers only, after the embed review above.
4. #21 only after the owner accepts `#B33A00`.
5. #22, then #23 with the `index.js` resolution above (or #23 first, then #22, with the same resolution). Re-test the combined homepage before the second merge.
6. #25 stays draft. It is not in this order.

#18 does not conflict with the later code PRs and is not replaced by them. Revert of any single merge commit is the rollback. A revert also deploys.

## Owner decisions

- **#21 colour.** `#B33A00` on the hero Start button, See example, and parts of the value section. The rest of the site, including header Pricing, stays `#FF6B35`. Local accessibility-only Lighthouse is 100. Merge only if the darker orange is the intended brand on those controls.
- **#23 animation.** The net background now waits for a first input or 20 seconds. Desktop TBT on the local build went from 990 ms to 0 ms because of that. Confirm that the delayed animation is acceptable.
- **#23 analytics.** gtag waits for interaction or 20 seconds. Short bounces are missed.
- **#25 rules.** Draft. Admin-only read of `contactSubmissions`, client writes denied, large lockfile rewrite. Do not merge and do not deploy rules until the owner wants that permission change.

## Open issues for the next round

- Resolve #22 and #23 in `index.js` and run the homepage plus a credit-stop on the combined build. Neither the Firestore await nor the paywall dismiss has an automated test that drives the real page.
- Re-measure production Lighthouse after #23 is deployed. Do not quote the local 70 / 97 as production.
- CI should fail when Vite fails, and the Test job should run the node and Playwright tests that exist. Today a green check swallows both.
- Mobile header at 390px crowds "Log in/Sign up" against the wordmark. Present on `main`, so it is not a regression from these PRs.
- #21's contrast fix is partial. A palette decision should cover the header Pricing button and the remaining `#FF6B35` text on white.
- #20's empty-state test should assert something, and the screenshot helper failed once in this environment.
- The Mermaid smoke wait still treats `window.mermaid` as success. Safe with the current mock; brittle if the mock changes.
- #25's lockfile rewrite should be split from the rules change, and the rules emulator should be run by the owner in a non-production project before any deploy.
- Text-compression warnings in the local Lighthouse runs are the Python static server, not a product defect.

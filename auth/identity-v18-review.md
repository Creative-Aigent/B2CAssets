# AIMAN Identity v18: Local Review

Validated September 30, 2026 (EDT). Local candidate only.

## Candidate And Ownership

- Candidate: `docs/releases/v18-aiman-identity/`, 33 bundled files plus manifest.
- Manifest status: `not-activated`; no publication, tenant activation, commit or push.
- Repository HEAD: `5df89db3219f027004e2f7662dfb7dbf6ee3b129`.
- Pinned template source: `5537be973028caae05cfb60e2fd23dc557fbf40a`.
- Changes are confined to B2CAssets. The app repo was read only.
- Existing dirty theme/build/material-test work was continued, not discarded.
- Existing untracked v16/v17 bundles and Jakarta 400/700/800 fonts/license were preserved.
- Root `docs/`, v13-v17 releases, policies, localization, `auth/theme.js`,
  package files and CI workflow remain unchanged.

## Appearance Changes

- Supplied full `aiman.svg`, byte-identical to the app asset, appears once in
  the existing decorative slot. No duplicated mark/wordmark or floating header.
- Licensed Plus Jakarta Sans 400/600/700/800, bundled locally. No font service.
- Warm light surfaces; deep neutral/ocean dark surfaces. Ocean actions and
  high-contrast keyboard outlines. Sunflower is exclusive to native successful
  verification, not informational or pending messages.
- Opaque forms/errors, 20px panels, 12px controls, compact 14px labels.
- 48px fields/buttons and at least 44px links/associated checkbox-label targets.
- Native select remains a select, with `menulist-button` appearance and 48px
  height so WebKit does not shrink it. Options, sentinel order and handlers
  are unchanged.
- Short-height padding and CSS scroll allowances keep complete keyboard-focused
  controls reachable without custom focus or scroll code.
- Existing script retains validated, per-tab light/dark hints, blocked-storage
  behavior and OS fallback. Native visibility/required/disabled states remain
  provider-owned.

## Commands And Results

Run from the B2CAssets repository:

| Command | Result |
| --- | --- |
| `python3 -B scripts/build-auth-release.py --release-id v18-aiman-identity --source-ref 5537be973028caae05cfb60e2fd23dc557fbf40a --with-theme` | Passed; immutable candidate generated |
| `python3 -B scripts/build-auth-release.py --verify-existing` | Passed; all six releases, v13-v18 |
| `python3 -B -m unittest discover -s tests -p 'test_auth_release.py'` | 58 passed |
| `npm run test:unit` | 15 passed |
| `B2C_RELEASE_ID=v18-aiman-identity npm run test:browser -- --reporter=line` | 271 passed, 1 skipped, no failures; Chromium and macOS WebKit |
| `B2C_RELEASE_ID=v15-silver-glass npm run test:browser -- --reporter=line` | 211 passed, 1 skipped in the retained original viewport scope |
| `git diff --check` | Passed |

The existing skip is WebKit forced-colors emulation; Chromium exercises it.
v18 covers all five templates, both appearances, 320/390/430/768px widths,
1440px desktop, 360x480 short-height approximation, native keyboard navigation,
contrast, reduced motion/transparency, forced colors, invalid hints, blocked
storage, no JavaScript, native handlers/visibility and synthetic existing
provider/password-control compatibility. Synthetic English fixtures and
RTL/enlarged text checks do not establish tenant localization acceptance.

The initial v18 draft found WebKit's undersized country selector and stale
old-logo assertions. The second draft found six partial-field keyboard-scroll
failures. All were corrected in the final candidate without weakening target,
focus, contrast or viewport assertions.

The expanded 320px matrix also found two partial-field WebKit focus failures
in unchanged v15. v15 remains immutable and its original acceptance matrix
still passes. The new 320/430/768px full-template matrix is v18-specific;
the older 320px provider/password compatibility tests remain for both releases.
This is not a claim that v15 passes the expanded matrix.

Local tool versions: Node 22.23.2, Python 3.13.15, Playwright 1.58.1,
Darwin arm64. Logs and synthetic screenshots are ignored under `test-results/`.
Final logs: `identity-uplift/final-v18-browser.log`,
`identity-uplift/retained-v15-original-scope.log`,
`identity-uplift/packaging-final.log`, `identity-uplift/theme-unit-final.log`.

The existing preview launcher was checked on an automatically assigned,
loopback-only port. The template, CSS, logo and font returned HTTP 200 with
their expected MIME types. A body-free synthetic POST returned HTTP 405 and
the preview CSP retained `form-action 'none'` and `connect-src 'none'`.
The owned preview process was stopped. No human browser was manipulated.

## Acceptance State

**Ready for local visual review; not production-accepted.**

Still required under a separately authorized release:

- Record actual tenant page mappings, selected layout versions, JavaScript,
  localization, claims and session/recovery settings before any activation.
- Publish only with explicit approval; verify hosted assets, font MIME and CORS.
- Use an authorized candidate flow and controlled test accounts/phone numbers
  to verify actual sign-in, registration, SMS send/resend/expiry/error paths,
  recovery and return to the same existing application account.
- Verify explicit app hints survive the real B2C loader across OTP/recovery,
  including opposite OS preferences. The local fixtures do not run the tenant
  sanitizer; historical script exclusion remains an open gate.
- Verify actual localized pages, enabled provider controls, assistive
  technologies, physical-device keyboards and Linux WebKitGTK.
- Rehearse restoring the complete prior tenant configuration.

No external credential was required for local verification. Authorized tenant
administration and controlled SMS/recovery test access are prerequisites for
the live checks, not credentials to embed in this repository or a reason to
change identity policies.

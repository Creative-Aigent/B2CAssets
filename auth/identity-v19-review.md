# AIMAN Iris v19: Local Review

Validated October 1, 2026 (EDT). Local candidate only.

## Candidate And Ownership

- Candidate: `docs/releases/v19-aiman-iris/`, 32 bundled files plus manifest.
- Manifest status: `not-activated`; no publication, tenant activation, commit or push.
- Repository HEAD: `5df89db3219f027004e2f7662dfb7dbf6ee3b129`.
- Pinned template source: `5537be973028caae05cfb60e2fd23dc557fbf40a`.
- Work was local to `Creative-Aigent/B2CAssets`, except screenshots saved under
  the app repo session artifact path requested by the reviewer.
- The pre-existing dirty Journey/Identity work was backed up to
  `/Users/ilias/.copilot/session-state/beb47746-a2dd-4d14-b63b-79d11b54d2fe/files/b2c-backup/`
  and preserved. Retained `v13`-`v18` release directories and root `docs/`
  assets were not edited or removed.
- `auth/theme.js` stays functionally unchanged: a valid per-tab
  `aiman_theme=light|dark` hint wins; otherwise CSS follows the OS.

## Appearance Changes

- Replaced the Journey/Identity authoring CSS with the approved Iris language:
  neutral flat light/dark surfaces, no blur, no glass, no decorative banner,
  no shadowed panel material and no action gradients.
- Kept violet only for the primary action fill, links and the 3px / 2px-offset
  keyboard focus ring. Secondary verification controls are neutral.
- Kept the single full AIMAN wordmark in `#api::before` as a theme-coloured
  mask. No duplicate mark, floating header or B2C DOM rewrite.
- Switched headings to local Outfit 700 and interface/body/labels/inputs to
  local Inter Tight. Added `auth/fonts/outfit-latin-wght-normal.woff2` and
  `auth/fonts/OFL-Outfit.txt`; v19 bundles Outfit + Inter Tight and does not
  bundle or request Plus Jakarta Sans.
- Preserved 48px field/button geometry, native WebKit select
  `menulist-button`, >=44px links/checkbox labels, short-height scroll padding,
  forced-colors, reduced-motion and increased-contrast branches.
- Native success/confirmed verification is green; warning is amber; errors are
  red. Informational and pending messages are neutral and never use success
  green.

## Commands And Results

Run from the B2CAssets repository:

| Command | Result |
| --- | --- |
| `python3 -B scripts/build-auth-release.py --release-id v19-aiman-iris --source-ref 5537be973028caae05cfb60e2fd23dc557fbf40a --with-theme` | Passed; immutable candidate generated |
| `python3 -B scripts/build-auth-release.py --verify-existing` | Passed; all seven releases, v13-v19 |
| `python3 -B -m unittest discover -s tests -p 'test_auth_release.py'` | 59 passed |
| `npm run test:unit` | 15 passed |
| `B2C_RELEASE_ID=v19-aiman-iris npm run test:browser -- --reporter=line` | 271 passed, 1 skipped, no failures; Chromium and macOS WebKit |
| `B2C_RELEASE_ID=v18-aiman-identity npm run test:browser -- --reporter=line` | 271 passed, 1 skipped, no failures; retained-release regression |
| `git diff --check` | Passed |

The existing skip is WebKit forced-colors emulation; Chromium exercises the
forced-colors branch. Browser coverage remains offline and synthetic: five B2C
layouts, explicit light/dark hints and opposite OS preferences, no JavaScript,
blocked storage, hidden/visible platform states, native validation and handlers,
320/390/430px mobile, 768px tablet, 360x480 short-height approximation,
desktop, compatibility fixtures, RTL/enlarged text, contrast, focus, reduced
motion and fallback material branches.

## Screenshots

Representative local preview screenshots were captured to
`/Users/ilias/Repos/creativeaigent-app/.playwright-mcp/iris/b2c/`:

- v19 unified sign-in, phone sign-up, OTP and self-asserted pages in light and
  dark at `1440x900` and `390x844`.
- v18 unified sign-in light at `1440x900` and `390x844` for before/after review.

The files are named `v19-aiman-iris-<page>-<theme>-<viewport>.png` and
`v18-aiman-identity-unified-signin-light-<viewport>.png`.

## Acceptance State

**Ready for local visual review; not production-accepted.**

Still required under a separately authorized release:

- Commit/publish to GitHub Pages and verify hosted asset responses, font MIME
  types and CORS.
- Record current tenant page mappings, layout versions, JavaScript setting,
  claims, localization and session/recovery settings before any activation.
- Apply the v19 URLs only on a candidate flow with compatible settings; do not
  change policies, callbacks, issuer, scopes, account IDs, recovery or session
  behavior in this appearance release.
- Verify real sign-in, sign-up, SMS send/resend/expiry/error paths, recovery,
  explicit app hints across the real B2C loader, localization, assistive
  technologies, physical-device keyboards and rollback.

No external credential was required for local verification. Tenant
administration and controlled phone/SMS test access remain separate gates.

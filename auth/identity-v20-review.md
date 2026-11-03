# AIMAN Personal Edition v20: Local Review

At the November 3, 2026 pre-publication review, this candidate had been
validated locally only.

## Candidate And Ownership

- Candidate: `docs/releases/v20-personal-edition/`, 31 bundled files plus manifest.
- Manifest status: `not-activated`; publication and tenant activation had not
  occurred at review time.
- Base commit: `4c455c20356d0baec216b8b272e2c5cdcfe788cb`.
- Pinned template source: `5537be973028caae05cfb60e2fd23dc557fbf40a`.
- Retained `v13`-`v19` release directories and root `docs/` assets were not
  edited or removed (`--verify-existing` passes for all eight releases).
- `auth/theme.js` is unchanged: a valid per-tab `aiman_theme=light|dark` hint
  wins; otherwise CSS follows the OS.

## Tenant Observation

On November 3, 2026, read-only portal inspection found the five customer-flow
custom page URLs using `v14-theme-4`, with JavaScript enabled. Several
tenant-selected layout versions differ from the template metadata; see the
[inventory](README.md#source-and-served-surface-inventory). The existing v14
templates have the same metadata, but neither that observation nor the
fixture results establishes v20 compatibility with the actual layouts.
The tenant was not changed. Record and recheck the actual configuration,
including language overrides, before a candidate-flow rehearsal or activation.

## Appearance Changes

- Replaced the Iris authoring CSS with Personal Edition tokens from the app's
  `ux/DESIGN.md`: white / near-black flat surfaces, black ink, electric blue
  `#0648FF` for primary action, links and focus (`#8AA8FF` dark links/focus).
- Primary buttons keep white labels in both themes. Secondary/native
  verification controls (`#sendNewCode`, `#cancel`, phone and social buttons)
  are outlined with panel fill, strong border and ink text.
- Headings switched from Outfit to Inter Tight (h1 `-0.03em`, h2/h3
  `-0.02em`); the Outfit `@font-face` was removed. Panels use 12px corners,
  dialogs 16px; inputs keep 12px / 48px; buttons remain pills.
- Confirmed is green, needs-review amber, error red; informational and pending
  messages stay neutral. Added an explicit selection text token.
- Preserved the single `#api::before` wordmark, native WebKit select, >=44px
  link/checkbox targets, short-height scroll padding, forced-colors,
  reduced-motion and increased-contrast branches.

## Commands And Results

| Command | Result |
|---|---|
| `python3 scripts/build-auth-release.py --release-id v20-personal-edition --source-ref 5537be973028caae05cfb60e2fd23dc557fbf40a --with-theme` | Built and verified, 31 files |
| `python3 scripts/build-auth-release.py --verify-existing` | Passed, v13-v20 |
| `python3 -m unittest discover -s tests -p 'test_auth_release.py'` | 60 passed |
| `node --test tests/theme-script.test.cjs` | 15 passed |
| `B2C_RELEASE_ID=v20-personal-edition npx playwright test` | 271 passed, 1 skipped (WebKit forced-colors) |
| `B2C_RELEASE_ID=v19-aiman-iris npx playwright test` | 271 passed, 1 skipped (regression) |

Local browser checks ran on macOS Chromium and WebKit. Linux WebKitGTK was not
run; the CI configuration selects v20 on Linux Chromium and macOS WebKit.

## Still Required Before Use

Publication to the Pages host and tenant activation are separate, authorized
operations (see [README](README.md#activation-is-a-separate-operation)). These
fixture checks are not live tenant acceptance, real OTP/recovery tests or
assistive-technology testing.

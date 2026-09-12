# AIMAN authentication appearance and releases

These assets enhance the existing B2C phone journey. They do not replace
Microsoft's controls, change required fields, enroll recovery methods, or
change authentication/session policy.

Customer sign-in remains phone-only (`B2C_1_signupsigninphone`). The separate
email-only `B2C_1_signin_ci` flow is for testing. Recovery email, when enrolled,
does not introduce email sign-in. GitHub Pages hosts these assets; GitHub is
not a customer identity provider. Azure Portal's administrator login is also
separate from the customer experience.

## Appearance contract

The application sends `aiman_theme=light` or `aiman_theme=dark` in MSAL
`extraQueryParameters`. It resolves the displayed theme at click time, so an
explicit choice wins over the operating system preference. Sign-up retains
`option=SignUp`; interactive token renewal carries the appearance hint too.

`auth/theme.js` accepts exactly one of those two values. It only sets
`data-aiman-theme` on the root element and stores the validated enum under
`aiman.auth.theme` in same-origin, per-tab `sessionStorage`. It never stores
an authorization code, token, phone number or account identifier. Later
sign-up, verification and recovery pages can reuse the appearance in that
tab. Storage being unavailable does not prevent applying an explicit hint.
Without a valid hint or saved preference, the **new v15 candidate** leaves the
root attribute unset and follows `prefers-color-scheme` in CSS. OS changes remain
live and are never persisted as an explicit choice. This also works when B2C
excludes the script; an explicit app choice cannot be honored in that case.
The root/v13 assets and earlier v14 candidate retain their original dark fallback.

B2C is a separate origin. It cannot read the app's localStorage or automatically
inherit the app's Glass/Solid preference. No new query parameter, storage key,
analytics request, or authentication behavior is introduced.

The script belongs in the HTML head with `defer`. Do not enable or reference
the legacy `docs/b2c-base.js` or `docs/unified-clean.js`; they manipulate
Microsoft's injected controls and are not part of these releases.

## Silver & Glass material contract

`auth/theme.css` aligns with the approved application identity at
[`creativeaigent.app` commit `6e20173`](https://github.com/Creative-Aigent/creativeaigent.app/commit/6e20173e606a0fd1c10d251d56163f906b674e83),
not the earlier purple candidate. It uses the canonical lighting, inset,
panel-elevation and action-shadow formulas: luminous silver in light mode,
smoked graphite in dark mode, neutral glossy primary actions and a restrained
link/focus accent.

The existing `#api::before` brand pseudo-element is a separate shell header
above the form. Only this header receives the reflective rim and
`blur(20px) saturate(1.12)`; the `#api` form, fields, errors and dialogs stay
opaque. Existing controls are never moved or recreated. Panels have 22px
corners, controls 13px and dialogs 24px. Display headings use Inter Tight at
550 weight; body/inputs are 16px, labels 14px and metadata at least 12px.
Existing 48px primary/field targets are retained, with 44px help/recovery links.
Button transitions affect shadows only, not color interpolation or position.

Unsupported backdrop filtering, reduced transparency and increased contrast
use solid chrome with no canvas lighting. Forced colors retain system colors,
native controls and visible focus. Reduced motion disables animation and
transitions. Explicit `:focus` styling also covers native WebKit focus.

`auth/fonts/` contains unmodified normal/italic Inter Tight variable WOFF2
files from the application's `ux/src/fonts`, distributed with the Inter Project
copyright and SIL OFL 1.1 in `OFL-InterTight.txt`. They are bundled under the
same release asset origin as the CSS; no external font service is called.
The app's Latin subsets fall back to Segoe UI/Arial/system glyphs for scripts
they do not contain, including Arabic. Existing AIMAN dark/white SVGs have
the same path geometry as the official application logotype and are retained.
Older Lora/Outfit files remain in the pinned baseline inventory for provenance,
but the v15 stylesheet does not request them.

## Source and served-surface inventory

The pinned source is deployed v13 commit
`5537be973028caae05cfb60e2fd23dc557fbf40a`. Mutable root `docs/` assets and
`docs/releases/v13-baseline/` are deliberately unchanged. `v14-theme-4` is a
historical, never-activated candidate; it is not overwritten. The new candidate
is **`docs/releases/v15-silver-glass/`**, marked `not-activated`.

| Template | Existing layout contract | Shared stylesheet route |
|---|---|---|
| `unified-clean.html` | `unifiedssp:2.1.9` | `unified-clean.css` imports `b2c-base.css` |
| `signin-phone-clean.html` | `selfasserted:2.1.21` | `b2c-base.css` |
| `phone-signup-clean.html` | `selfasserted:2.1.21` | `phone-signup-clean.css` imports `b2c-base.css` |
| `phone-otp-clean.html` | `multifactor:1.2.9` | `b2c-base.css` |
| `selfasserted-clean.html` | `selfasserted:2.1.21` | `selfasserted-clean.css` imports `b2c-base.css` |

Each generated template still has exactly one empty `<div id="api"></div>`,
the same layout metadata and no added form or body script. All five load the
same `auth-theme.css` and deferred head-only `auth-theme.js`. Absolute template
asset URLs, CSS imports, relative CSS font/logo URLs and manifest hashes resolve
inside the selected immutable release. The real tenant mappings are not inferred
from these files and were not inspected or changed for v15.

## Activation is a separate operation

Nothing in the build command changes Azure, publishes Pages, or changes the
working five page-layout URLs. Each manifest deliberately records
`activationStatus: "not-activated"`; it is a build artifact, not live tenant
state.

**v15 deployment implications:** publication requires a separately reviewed
commit/push to the configured HTTPS Pages host, followed by verifying asset
responses, font MIME types and CORS. Tenant activation requires a separately
authorized administrator to record the existing configuration and apply all five
URLs from the v15 manifest on a candidate flow with compatible layout/JavaScript
settings. Neither publication nor activation is performed by the local build or
preview. No policies, claims, tenant settings or localization overrides are
changed by this appearance release. Its locale files are byte-identical to v13;
do **not** upload them as part of this visual-only change. Keep the complete
existing localization/session/recovery configuration.

Historical v14 investigation (not a v15 live test): an isolated unauthenticated
probe of the existing phone flow confirmed the
initial B2C document retains `aiman_theme=light`. A browser-local substitution
adding the head script did not result in script execution; sign-in remained
usable. The current JavaScript/layout configuration therefore remains an
activation gate, not a completed handoff.

The full candidate was also substituted through the native loader in an
isolated browser: its CSS loaded, but the native sanitizer excluded `script`
and no theme script was requested. Azure CLI access to this tenant's user
flows returns `403` for missing `IdentityUserFlow.Read.All` or
`IdentityUserFlow.ReadWrite.All`. Requesting the read-only scope through Azure
CLI returns `AADSTS65002` (first-party preauthorization). Do not grant broad
permissions, switch application identities, or bypass the sanitizer to work
around this. Use an authenticated tenant-administrator Azure Portal session
for the supported setting below.

Before enabling a candidate:

1. Record the actual five page mappings, layout versions, localized strings,
   JavaScript setting, claims and session/recovery configuration.
2. Publish the baseline and candidate bundles without altering the existing
   root assets. Require reviewed changes and release checks on the publishing
   branch; a workflow alone does not protect an unprotected branch.
3. Use a candidate user flow with matching authentication settings. In Azure
   AD B2C, inspect **User flows > Properties > Enable JavaScript**, and the
   versions under **Page layouts**. A `pageLayout` meta tag is not proof of
   the actual selected tenant version.
4. Apply the five candidate URLs from `release-manifest.json`. Do not
   upgrade page-layout versions in the same release or change callback,
   issuer, scope, account-ID, session or recovery behavior.
5. Confirm both explicit themes, opposite OS preferences, native validation,
   sign-up, OTP and recovery on the actual B2C pages. Confirm the same account
   returns to the same existing application data. Use controlled test users
   and phone numbers; fixture tests do not perform real authentication.
6. For a separately approved localization release, apply its full localization
   JSONs through supported B2C
   language customization only after reviewing the legal destinations. A
   JSON file being published does not apply it to the tenant. Preserve
   configured countries and required fields. Do not use the legacy SMS
   custom-policy upload helper for this built-in user flow. This step is not
   part of v15 Silver & Glass.

If the hint becomes unavailable, the host changes, or tab storage is blocked,
do not claim cross-page appearance continuity. Do not guess `SETTINGS`
properties, repurpose `ui_locales`, or replace the authentication flow to
hide that limitation.

Microsoft references:

- [Custom JavaScript and page layouts](https://learn.microsoft.com/en-us/azure/active-directory-b2c/javascript-and-page-layout?pivots=b2c-user-flow)
- [Custom HTML loading](https://learn.microsoft.com/en-us/azure/active-directory-b2c/customize-ui-with-html)
- [Phone-flow consent/localization](https://learn.microsoft.com/en-us/azure/active-directory-b2c/phone-authentication-user-flows)

## Build and verify

Run from this repository; the source Git object is the deployed v13 commit,
not the possibly older checked-out `docs/` files:

```bash
python3 scripts/build-auth-release.py \
  --release-id v13-baseline \
  --source-ref 5537be973028caae05cfb60e2fd23dc557fbf40a

python3 scripts/build-auth-release.py \
  --release-id v15-silver-glass \
  --source-ref 5537be973028caae05cfb60e2fd23dc557fbf40a \
  --with-theme

python3 scripts/build-auth-release.py --verify-existing
python3 -m unittest discover -s tests -p 'test_auth_release.py'
node --test tests/theme-script.test.cjs
npm ci
npx playwright install chromium webkit
B2C_RELEASE_ID=v15-silver-glass npm run test:browser
npm run preview
```

The preview binds only `127.0.0.1:4317`; use `B2C_PREVIEW_PORT` for another
owned local port. It serves the generated release with synthetic injected
fixtures, rewrites release asset URLs to its own `/assets/` route, blocks
submissions with CSP and a 405 response, and never connects to B2C. Open `/`
for links to every template in both themes, or
`http://127.0.0.1:4317/phone-entry?aiman_theme=light`. No app dev server is used.
`B2C_RELEASE_ROOT` can select an isolated draft's `docs/releases` directory
during authoring; it is not a tenant/production configuration.

Browser tests fulfill all identity/asset requests offline. Chromium and WebKit
cover five layouts, light/dark and opposite-OS explicit hints, no-JavaScript and
blocked storage, native visibility/validation and handlers, 390px mobile,
360px short-height keyboard approximation, desktop, and 320px compatibility
fixtures for existing password/reveal/cancel/provider markup. These extra
fixtures do not add customer sign-in methods. RTL/enlarged text, loading,
disabled/hover/pressed states, focus and contrast are covered. macOS WebKit uses
Option-Tab to traverse all controls; Linux WebKit and Chromium use Tab. The same
reachability and focus assertions apply. Native scrolling is allowed to settle
before checking viewport bounds.

Increased contrast is browser-emulated. Reduced transparency and unsupported
backdrop support are checked by activating the **shipped CSS branches** in the
offline response because Playwright cannot emulate those native conditions.
Forced colors are emulated in Chromium; WebKit has no Windows forced-colors
emulation. Screenshots in ignored `test-results/` contain only synthetic data;
copy representative captures to session artifacts, not tracked assets.
These checks are not live tenant acceptance, real OTP/recovery tests, assistive
technology testing or a physical-device keyboard test.

Earlier never-published drafts were
archived outside the publishable `docs/` tree: dark borders and hover text
needed stronger contrast, and adjacent recovery/help links needed spacing.
They are not activation targets.

The historical v14 legal destinations are existing public **beta summaries**, not a newly
approved full privacy policy or terms of service. Deploy the corresponding
application privacy wording before any separately approved legal overrides.

Every bundle contains the five templates, CSS, logos, fonts and licenses,
localization files, and a manifest of SHA-256 hashes and byte sizes. All
loaded asset references stay inside that release. Candidates include only
the theme script; the rollback baseline contains no custom scripts.

An existing ID can be rebuilt only when every byte matches. After changing
source, choose a new ID; do not edit a generated bundle or its manifest.
Candidate CSS leaves positive `display` declarations at normal priority so
B2C's inline `display:none` continues to work, and preserves native `hidden`
and `aria-hidden` states.

## Rollback

Restore the complete prior configuration snapshot: all five layout URLs,
localized overrides and JavaScript setting. Use the published immutable
`v13-baseline` URLs, not an old query string on a mutable root filename.
Retain old bundles while sessions may still refer to them, and account for
provider/CDN caches. Rehearse rollback on the candidate flow before changing
the working flow.

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
Without a valid hint or saved preference, the existing dark appearance wins.

The script belongs in the HTML head with `defer`. Do not enable or reference
the legacy `docs/b2c-base.js` or `docs/unified-clean.js`; they manipulate
Microsoft's injected controls and are not part of these releases.

## Activation is a separate operation

Nothing in the build command changes Azure, publishes Pages, or changes the
working five page-layout URLs. Each manifest deliberately records
`activationStatus: "not-activated"`; it is a build artifact, not live tenant
state.

An isolated unauthenticated probe of the existing phone flow confirmed the
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
6. Apply the candidate's full localization JSONs through supported B2C
   language customization only after reviewing the legal destinations. A
   JSON file being published does not apply it to the tenant. Preserve
   configured countries and required fields. Do not use the legacy SMS
   custom-policy upload helper for this built-in user flow.

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
  --release-id v14-theme-4 \
  --source-ref 5537be973028caae05cfb60e2fd23dc557fbf40a \
  --with-theme --legal-origin https://dev.agentaiman.com

python3 scripts/build-auth-release.py --verify-existing
python3 -m unittest discover -s tests -p 'test_auth_release.py'
node --test tests/theme-script.test.cjs
npm ci
B2C_RELEASE_ID=v14-theme-4 npm run test:browser
```

The current candidate is `v14-theme-4`. Earlier never-published drafts were
archived outside the publishable `docs/` tree: dark borders and hover text
needed stronger contrast, and adjacent recovery/help links needed spacing.
They are not activation targets.

The legal destinations are existing public **beta summaries**, not a newly
approved full privacy policy or terms of service. Deploy the corresponding
application privacy wording before activating the new legal overrides.

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

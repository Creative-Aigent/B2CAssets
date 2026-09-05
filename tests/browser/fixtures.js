// Synthetic platform markup: no real account, policy, verification, or authentication.
const countryOptions = `
  <option value="__platform_sentinel__" selected disabled>Choose country / region</option>
  <option value="ZZ">Test region (+999)</option>
  <option value="CA">Canada (+1)</option>
  <option value="US">United States (+1)</option>
  <option value="GB">United Kingdom (+44)</option>
  <option value="">Platform empty value</option>`;

const errors = `
  <div id="pageError" class="error pageLevel" aria-hidden="true" role="alert">
    <p>Fixture only: the entered code could not be verified. Try another synthetic code.</p>
  </div>
  <div id="nativeError" class="error itemLevel" hidden role="alert">
    <p>Fixture only: native hidden validation message.</p>
  </div>
  <div id="inlineError" class="error itemLevel" style="display: none" role="alert">
    <p>Fixture only: inline hidden validation message.</p>
  </div>`;

const hiddenControls = `
  <div class="attrEntry">
    <input id="nativeHiddenControl" type="text" value="native-hidden-sentinel" hidden>
    <input id="ariaHiddenControl" type="text" value="aria-hidden-sentinel" aria-hidden="true">
    <input id="inlineHiddenControl" type="text" value="inline-hidden-sentinel" style="display: none">
  </div>`;

const platformLinks = `
  <div class="links">
    <a id="forgotPassword" href="https://identity.example.test/authorize?step=recovery">Recover access</a>
    <a id="helpLink" class="helpLink" href="https://identity.example.test/help">What is this?</a>
  </div>`;

const rememberMe = `
  <div class="rememberMe">
    <input id="rememberMe" type="checkbox" name="rememberMe" checked>
    <label for="rememberMe">Keep me signed in on this device</label>
  </div>`;

function field(id, label, type = 'text', value = '', required = true) {
  return `<li><div class="attrEntry">
    <label for="${id}">${label}</label>
    <input id="${id}" name="${id}" type="${type}" value="${value}" ${required ? 'required aria-required="true"' : ''}>
  </div></li>`;
}

const countryField = `<li><div class="attrEntry">
  <label for="countryCode">Country / region</label>
  <select id="countryCode" name="countryCode" required>${countryOptions}</select>
</div></li>`;

function selfAsserted(title, introduction, fields, additional = '') {
  return `<div class="heading"><h1>${title}</h1></div>
  <form id="attributeVerification" action="/platform-submit" method="post">
    <div class="intro"><p>${introduction}</p></div>
    ${errors}
    <div id="attributeList" class="attr"><ul>${fields}</ul></div>
    ${additional}
    ${hiddenControls}
    <div class="buttons"><button id="continue" type="submit">Continue</button></div>
    ${platformLinks}
  </form>`;
}

const cases = [
  {
    name: 'unified-signin',
    template: 'unified-clean.html',
    layout: 'urn:com:microsoft:aad:b2c:elements:contract:unifiedssp:2.1.9',
    input: '#phoneNumber',
    primary: '#next',
    markup: `<div class="heading"><h1>Welcome back</h1></div>
      <form id="localAccount" class="localAccount" action="/platform-submit" method="post">
        <div class="intro"><h2>Sign in with your phone number to continue your journey.</h2></div>
        ${errors}
        <div class="entry">
          <div class="entry-item">
            <label for="phoneNumber">Phone number</label>
            <input id="phoneNumber" name="phoneNumber" type="tel" required aria-required="true" value="5550100">
          </div>
        </div>
        ${rememberMe}
        ${hiddenControls}
        <div class="buttons"><button id="next" type="submit">Sign in</button></div>
        ${platformLinks}
        <div class="create"><p>New here? <a id="createAccount" href="/authorize?step=signup">Create an account</a></p></div>
      </form>`,
  },
  {
    name: 'phone-entry',
    template: 'signin-phone-clean.html',
    layout: 'urn:com:microsoft:aad:b2c:elements:contract:selfasserted:2.1.21',
    input: '#phoneNumber',
    primary: '#continue',
    markup: selfAsserted(
      'Sign in',
      'Enter a phone number to receive your verification code.',
      countryField + field('phoneNumber', 'Phone number', 'tel', '5550100'),
      rememberMe,
    ),
  },
  {
    name: 'long-signup',
    template: 'phone-signup-clean.html',
    layout: 'urn:com:microsoft:aad:b2c:elements:contract:selfasserted:2.1.21',
    input: '#displayName',
    primary: '#continue',
    markup: selfAsserted(
      'Create your account',
      'Build your professional identity. Complete the fields below and verify your phone number to continue.',
      field('displayName', 'Display name', 'text', 'Synthetic Example')
        + field('givenName', 'First name', 'text', 'Synthetic')
        + field('surname', 'Last name', 'text', 'Example')
        + field('email', 'Recovery email address', 'email', 'fixture@example.test')
        + countryField
        + `<li class="verificationControl"><div id="phoneVerificationControl" class="verificationControl">
          <ul>${field('phoneNumber', 'Phone number', 'tel', '5550100')}
          ${field('verificationCode', 'Verification code', 'text', '000000')}</ul>
          <div class="buttons">
            <button id="phoneVerificationControl_but_send_code" type="button">Send verification code</button>
            <button id="phoneVerificationControl_but_verify_code" type="button" aria-hidden="true">Verify code</button>
            <button id="phoneVerificationControl_but_send_new_code" type="button" style="display: none">Send new code</button>
            <button id="phoneVerificationControl_but_change_claims" type="button" hidden>Change phone number</button>
          </div>
        </div></li>`,
      `<div class="form-group checkbox">
        <input id="termsConsent" type="checkbox" required>
        <label for="termsConsent">I agree to the terms and privacy notice for this synthetic form.</label>
      </div>`,
    ),
  },
  {
    name: 'multifactor-otp',
    template: 'phone-otp-clean.html',
    layout: 'urn:com:microsoft:aad:b2c:elements:contract:multifactor:1.2.9',
    input: '#verificationCode',
    primary: '#verifyCode',
    markup: `<div class="heading"><h1>Enter verification code</h1></div>
      <form id="multifactor" action="/platform-submit" method="post">
        <div class="intro"><p>Enter the synthetic verification code. No message has been sent.</p></div>
        ${errors}
        <div class="phoneNumbers"><span id="phoneNumber">Synthetic phone ending in 0100</span></div>
        <div class="entry-item">
          <label for="verificationCode">Verification code</label>
          <input id="verificationCode" name="verificationCode" type="text" inputmode="numeric" autocomplete="one-time-code" value="000000" required>
        </div>
        ${hiddenControls}
        <div class="buttons">
          <button id="verifyCode" type="submit">Verify code</button>
          <button id="sendNewCode" type="button" style="display: none">Send new code</button>
        </div>
        ${platformLinks}
      </form>`,
  },
  {
    name: 'selfasserted-recovery',
    template: 'selfasserted-clean.html',
    layout: 'urn:com:microsoft:aad:b2c:elements:contract:selfasserted:2.1.21',
    input: '#email',
    primary: '#continue',
    markup: selfAsserted(
      'Recover access',
      'Add a recovery email so you can regain access to your account.',
      field('email', 'Recovery email address', 'email', 'fixture@example.test')
        + field('emailVerificationCode', 'Email verification code', 'text', '000000'),
      `<div class="buttons"><button id="emailVerificationControl_but_send_code" type="button">Send verification code</button></div>`,
    ),
  },
];

// Runs as the synthetic platform, after #api insertion and before deferred theme code.
const platformBootstrap = `<script>
  (() => {
    const api = document.getElementById('api');
    const state = window.__platformFixture = { submits: 0, clicks: 0, inputEvents: 0, listenerClicks: 0 };
    state.nodes = Array.from(api.querySelectorAll('*'));
    state.parents = state.nodes.map(node => node.parentElement);
    state.controls = Array.from(api.querySelectorAll('input, select, button, textarea'));
    state.controlState = state.controls.map(node => ({
      id: node.id, value: node.value, required: node.required, checked: node.checked,
      disabled: node.disabled, name: node.name, type: node.type
    }));
    state.links = Array.from(api.querySelectorAll('a'));
    state.hrefs = state.links.map(node => node.getAttribute('href'));
    state.clickHandler = function(event) { event.preventDefault(); state.clicks++; };
    state.inputHandler = function() { state.inputEvents++; };
    state.submitHandler = function(event) { event.preventDefault(); state.submits++; };
    state.links.forEach(node => {
      node.onclick = state.clickHandler;
      node.addEventListener('click', () => state.listenerClicks++);
    });
    state.controls.forEach(node => { node.oninput = state.inputHandler; });
    api.querySelector('form').onsubmit = state.submitHandler;
    state.html = api.innerHTML;
  })();
</script>`;

module.exports = { cases, platformBootstrap };

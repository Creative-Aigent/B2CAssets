/* AIMAN B2C Unified Sign-in/Sign-up — v5 clean JS */
(function () {
  'use strict';

  /* ── Help link patterns to remove ── */
  var HELP_PATTERNS = [
    /what\s+is\s+this\??/i,
    /qu[eé]\s+es\s+esto\??/i,
    /qu['']?est[-\s]?ce\s+que\s+c['']?est\??/i,
    /was\s+ist\s+das\??/i,
    /これは何ですか\??/i
  ];

  /* ── Remove "What is this?" links and text nodes ── */
  function removeHelpLinks(root) {
    if (!root) return;
    // Remove link elements
    root.querySelectorAll('a[href*="what"], a[href*="help"], a[href*="info"], .help-link, .info-link, .what-is-this').forEach(function (el) {
      el.remove();
    });
    // Remove matching text nodes
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var toRemove = [];
    var node;
    while ((node = walker.nextNode())) {
      var text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text && HELP_PATTERNS.some(function (p) { return p.test(text); })) {
        toRemove.push(node);
      }
    }
    toRemove.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
  }

  /* ── Fix "Don't have an account?Sign up now" spacing ── */
  function fixTextSpacing(api) {
    var createSection = api.querySelector('.create p') || api.querySelector('.create');
    if (!createSection || createSection.dataset.spacingFixed) return;
    var link = createSection.querySelector('a');
    if (link && link.previousSibling && link.previousSibling.nodeType === 3) {
      var text = link.previousSibling.textContent;
      if (text && !text.endsWith(' ')) {
        link.previousSibling.textContent = text + ' ';
      }
    }
    createSection.dataset.spacingFixed = 'true';
  }

  /* ── Force-remove underlines from all links (B2C injects inline styles) ── */
  function cleanLinks(api) {
    api.querySelectorAll('a').forEach(function (link) {
      link.style.setProperty('text-decoration', 'none', 'important');
      link.style.setProperty('border', 'none', 'important');
      link.style.setProperty('border-bottom', 'none', 'important');
      link.style.setProperty('outline', 'none', 'important');
      link.style.setProperty('box-shadow', 'none', 'important');
    });
  }

  /* ── Prioritise common countries in <select> dropdowns ── */
  function prioritizeCountries(api) {
    api.querySelectorAll('select').forEach(function (select) {
      if (select.dataset.prioritized) return;
      var opts = Array.from(select.options);
      if (opts.length < 10) return;
      var names = ['United States', 'Canada', 'United Kingdom', 'France', 'Spain', 'United Arab Emirates'];
      var priority = [];
      names.forEach(function (name) {
        var opt = opts.find(function (o) { return o.textContent.indexOf(name) >= 0; });
        if (opt) priority.push(opt);
      });
      if (!priority.length) return;
      var currentValue = select.value;
      var placeholder = opts.find(function (o) { return !o.value || o.value === ''; });
      while (select.firstChild) select.removeChild(select.firstChild);
      if (placeholder) select.appendChild(placeholder);
      priority.forEach(function (opt) { select.appendChild(opt); });
      var sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
      select.appendChild(sep);
      opts.forEach(function (opt) {
        if (priority.indexOf(opt) < 0 && opt !== placeholder) select.appendChild(opt);
      });
      select.value = currentValue;
      select.dataset.prioritized = 'true';
    });
  }

  /* ── Main customisation pass ── */
  function applyCustomizations() {
    var api = document.getElementById('api');
    if (!api) return;
    removeHelpLinks(api);
    fixTextSpacing(api);
    cleanLinks(api);
    prioritizeCountries(api);
  }

  /* ── Bootstrap: run immediately, on load, and watch for B2C DOM mutations ── */
  applyCustomizations();
  document.addEventListener('DOMContentLoaded', applyCustomizations);
  window.addEventListener('load', applyCustomizations);

  // MutationObserver to catch B2C late DOM injections
  function tryObserve() {
    var api = document.getElementById('api');
    if (!api) return false;
    var observer = new MutationObserver(applyCustomizations);
    observer.observe(api, { childList: true, subtree: true });
    applyCustomizations();
    return true;
  }

  if (!tryObserve()) {
    var poll = setInterval(function () {
      if (tryObserve()) clearInterval(poll);
    }, 150);
  }
})();

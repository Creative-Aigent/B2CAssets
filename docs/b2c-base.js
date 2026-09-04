/* B2C DOM enhancements. Styling remains in b2c-base.css. */
(function () {
  "use strict";

  var helpSelectors = [
    'a[href*="what"]',
    'a[href*="help"]',
    'a[href*="info"]',
    'a[href*="learn"]',
    'a[href*="support"]',
    ".help-link",
    ".info-link",
    ".what-is-this",
    ".help-text",
    ".info-text",
    ".what-is-this-text",
    ".what-is-this-link"
  ];
  var helpTextPatterns = [
    /what\s+is\s+this\??/i,
    /qu[eé]\s+es\s+esto\??/i,
    /qu['’]?est[-\s]?ce\s+que\s+c['’]?est\??/i,
    /was\s+ist\s+das\??/i,
    /これは何ですか\??/i
  ];
  var priorityCountries = [
    "United States",
    "Canada",
    "United Kingdom",
    "France",
    "Spain",
    "United Arab Emirates"
  ];

  function removeElement(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  function removeHelpLinks(api) {
    var elements;
    var walker;
    var nodesToRemove = [];
    var node;
    var text;
    var patternIndex;
    var index;

    if (!api) {
      return;
    }

    elements = api.querySelectorAll(helpSelectors.join(","));
    for (index = 0; index < elements.length; index += 1) {
      removeElement(elements[index]);
    }

    walker = document.createTreeWalker(api, NodeFilter.SHOW_TEXT, null, false);
    while ((node = walker.nextNode())) {
      text = (node.textContent || "").replace(/\s+/g, " ").trim();
      for (patternIndex = 0; text && patternIndex < helpTextPatterns.length; patternIndex += 1) {
        if (helpTextPatterns[patternIndex].test(text)) {
          nodesToRemove.push(node);
          break;
        }
      }
    }

    for (index = 0; index < nodesToRemove.length; index += 1) {
      removeElement(nodesToRemove[index]);
    }
  }

  function fixCreateAccountSpacing(api) {
    var create = api && (api.querySelector(".create p") || api.querySelector(".create"));
    var link = create && create.querySelector("a");

    if (!link || !link.previousSibling || link.previousSibling.nodeType !== 3) {
      return;
    }

    if (link.previousSibling.textContent && !/\s$/.test(link.previousSibling.textContent)) {
      link.previousSibling.textContent += " ";
    }
  }

  function findOption(options, country) {
    var index;

    for (index = 0; index < options.length; index += 1) {
      if (options[index].textContent.indexOf(country) >= 0) {
        return options[index];
      }
    }

    return null;
  }

  function prioritizeCountries(api) {
    var selects;
    var selectIndex;
    var select;
    var options;
    var originalOptions;
    var priorityOptions;
    var placeholder;
    var countryIndex;
    var optionIndex;
    var option;
    var separator;
    var selectedValue;

    if (!api) {
      return;
    }

    selects = api.querySelectorAll("select");
    for (selectIndex = 0; selectIndex < selects.length; selectIndex += 1) {
      select = selects[selectIndex];
      if (select.getAttribute("data-aiman-prioritized") === "true" || select.options.length < 10) {
        continue;
      }

      options = Array.prototype.slice.call(select.options);
      priorityOptions = [];
      placeholder = null;
      selectedValue = select.value;

      for (optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
        if (!options[optionIndex].value) {
          placeholder = options[optionIndex];
          break;
        }
      }

      for (countryIndex = 0; countryIndex < priorityCountries.length; countryIndex += 1) {
        option = findOption(options, priorityCountries[countryIndex]);
        if (option) {
          priorityOptions.push(option);
        }
      }

      if (!priorityOptions.length) {
        continue;
      }

      originalOptions = options.slice();
      while (select.firstChild) {
        select.removeChild(select.firstChild);
      }

      if (placeholder) {
        select.appendChild(placeholder);
      }

      for (optionIndex = 0; optionIndex < priorityOptions.length; optionIndex += 1) {
        select.appendChild(priorityOptions[optionIndex]);
      }

      separator = document.createElement("option");
      separator.disabled = true;
      separator.textContent = "------------";
      select.appendChild(separator);

      for (optionIndex = 0; optionIndex < originalOptions.length; optionIndex += 1) {
        option = originalOptions[optionIndex];
        if (option !== placeholder && priorityOptions.indexOf(option) < 0) {
          select.appendChild(option);
        }
      }

      select.value = selectedValue;
      select.setAttribute("data-aiman-prioritized", "true");
    }
  }

  function applyEnhancements() {
    var api = document.getElementById("api");

    removeHelpLinks(api);
    fixCreateAccountSpacing(api);
    prioritizeCountries(api);
  }

  function observeApi() {
    var api = document.getElementById("api");
    var observer;

    if (!api || !window.MutationObserver) {
      return false;
    }

    observer = new MutationObserver(applyEnhancements);
    observer.observe(api, { childList: true, subtree: true });
    applyEnhancements();
    return true;
  }

  applyEnhancements();
  document.addEventListener("DOMContentLoaded", applyEnhancements);
  window.addEventListener("load", applyEnhancements);

  if (!observeApi() && window.MutationObserver) {
    var attempts = 0;
    var poll = window.setInterval(function () {
      attempts += 1;
      if (observeApi() || attempts === 40) {
        window.clearInterval(poll);
      }
    }, 150);
  }
}());

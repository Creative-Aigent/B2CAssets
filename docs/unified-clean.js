  (function() {
    const HELP_SELECTORS = [
      'a[href*="what"]',
      'a[href*="help"]',
      'a[href*="info"]',
      'a[href*="learn"]',
      'a[href*="support"]',
      '.help-link',
      '.info-link',
      '.what-is-this',
      '.help-text',
      '.info-text',
      '.what-is-this-text',
      '.what-is-this-link'
    ];

    const HELP_PARENT_SELECTORS = [
      '.form-group .helpLink',
      '.form-group .helpText',
      '.form-group a[href*="what"]',
      '.form-group a[href*="help"]',
      '.form-group a[href*="info"]',
      '.intro .helpLink',
      '.intro .helpText',
      '.intro a[href*="what"]',
      '.intro a[href*="help"]',
      '.intro a[href*="info"]'
    ];

    const DEFAULT_HELP_TEXT_PATTERNS = [
      /what\s+is\s+this\??/i,
      /qué\s+es\s+esto\??/i,
      /qu['’]?est[-\s]?ce\s+que\s+c['’]?est\??/i,
      /was\s+ist\s+das\??/i,
      /che\s+cosa\s+(?:\u00e8|e)\??/i,
      /o\s+que\s+(?:\u00e9|e)\s+isso\??/i,
      /что\s+это\??/i,
      /這是甚麼\??/i,
      /這是什麼\??/i,
      /這\s*是\s*什麼\??/i,
      /これは何ですか\??/i
    ];

    function escapeRegExp(text) {
      return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function coercePattern(pattern) {
      if (pattern instanceof RegExp) {
        return pattern;
      }

      if (typeof pattern === 'string' && pattern.trim().length > 0) {
        return new RegExp(escapeRegExp(pattern.trim()), 'i');
      }

      return null;
    }

    const HELP_TEXT_PATTERNS = (window.B2C_HELP_TEXT_PATTERNS || DEFAULT_HELP_TEXT_PATTERNS)
      .map(coercePattern)
      .filter(Boolean);

    function hideElements(selectors) {
      const uniqueSelectors = Array.from(new Set(selectors));
      uniqueSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          if (!element.parentNode) {
            return;
          }

          element.style.display = 'none';
          element.style.visibility = 'hidden';
          element.style.width = '0';
          element.style.height = '0';
          element.style.overflow = 'hidden';
          element.style.position = 'absolute';
          element.style.left = '-9999px';
          element.style.opacity = '0';
          element.style.pointerEvents = 'none';
          element.style.zIndex = '-9999';
          element.remove();
        });
      });
    }

    function hideParentElements(selectors) {
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          const parent = element && element.parentNode;
          if (!parent) {
            return;
          }

          parent.style.display = 'none';
          parent.style.visibility = 'hidden';
          parent.style.width = '0';
          parent.style.height = '0';
          parent.style.overflow = 'hidden';
          parent.style.position = 'absolute';
          parent.style.left = '-9999px';
          parent.style.opacity = '0';
          parent.style.pointerEvents = 'none';
          parent.style.zIndex = '-9999';
          parent.remove();
        });
      });
    }

    function normalizeWhitespace(text) {
      return text.replace(/\s+/g, ' ').trim();
    }

    function textMatchesPatterns(text, patterns) {
      if (!text || !patterns.length) {
        return false;
      }

      const normalized = normalizeWhitespace(text);
      if (!normalized) {
        return false;
      }

      return patterns.some(pattern => pattern.test(normalized));
    }

    function removeTextNodesMatching(root, patterns) {
      if (!root) {
        return;
      }

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      const nodesToRemove = [];

      let current;
      while ((current = walker.nextNode())) {
        if (textMatchesPatterns(current.textContent, patterns)) {
          nodesToRemove.push(current);
        }
      }

      nodesToRemove.forEach(node => {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });
    }

    function removeHelpLinks() {
      try {
        hideElements(HELP_SELECTORS);
        hideParentElements(HELP_PARENT_SELECTORS);

        const api = document.getElementById('api');
        if (!api) {
          return;
        }

        api.querySelectorAll('*').forEach(element => {
          if (textMatchesPatterns(element.textContent, HELP_TEXT_PATTERNS)) {
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.width = '0';
            element.style.height = '0';
            element.style.overflow = 'hidden';
            element.style.position = 'absolute';
            element.style.left = '-9999px';
            element.style.opacity = '0';
            element.style.pointerEvents = 'none';
            element.style.zIndex = '-9999';
            element.remove();
          }
        });

        hideParentElements(HELP_PARENT_SELECTORS);
        removeTextNodesMatching(api, HELP_TEXT_PATTERNS);
      } catch (e) {
        console.warn('Error removing help links:', e);
      }
    }
    
    // Unified JavaScript to handle both sign-in and sign-up
    function forceDarkTheme() {
      try {
        // Force background on all elements
        document.body.style.background = 'linear-gradient(135deg, #0b0f1a 0%, #0f172a 40%, #0f1c33 100%)';
        document.documentElement.style.background = 'linear-gradient(135deg, #0b0f1a 0%, #0f172a 40%, #0f1c33 100%)';
        
        // Force API container styling
        const api = document.getElementById('api');
        if (api) {
          api.style.background = 'rgba(17, 25, 40, 0.78)';
          api.style.backdropFilter = 'blur(18px)';
          api.style.border = 'none';
          api.style.borderRadius = '16px';
          api.style.boxShadow = '0 18px 36px rgba(15, 23, 42, 0.32)';
          api.style.padding = '2.25rem';
          api.style.maxWidth = '420px';
          api.style.margin = '2.25rem auto';
          api.style.minHeight = 'auto';
          api.style.overflow = 'visible';
          api.style.maxHeight = 'none';
        }
        
        // Force all containers
        const containers = document.querySelectorAll('.ext-container, .ext-container-margin, .ext-container-padding, [class*="ext-"], [id*="ext-"]');
        containers.forEach(container => {
          container.style.background = 'linear-gradient(135deg, #0b0f1a 0%, #0f172a 40%, #0f1c33 100%)';
        });
        
        // Remove "What is this?" links
        removeHelpLinks();
        
        // Style any new form elements that B2C injects
        const inputs = document.querySelectorAll('#api input, #api select');
        inputs.forEach(input => {
          input.style.background = 'rgba(15, 23, 42, 0.55)';
          input.style.border = '1px solid rgba(148, 163, 184, 0.28)';
          input.style.borderRadius = '12px';
          input.style.color = '#f1f5f9';
          input.style.padding = '0.9rem 1rem';
          input.style.fontSize = '0.95rem';
          input.style.width = '100%';
          input.style.marginBottom = '1rem';
          input.style.boxShadow = 'none';
        });

        const checkboxes = document.querySelectorAll('#api input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
          checkbox.style.width = '16px';
          checkbox.style.height = '16px';
          checkbox.style.margin = '0';
          checkbox.style.marginRight = '0.55rem';
          checkbox.style.border = '1px solid rgba(148, 163, 184, 0.35)';
          checkbox.style.borderRadius = '4px';
          checkbox.style.background = 'rgba(15, 23, 42, 0.45)';
          
          // Ensure checkbox and label are inline
          const label = checkbox.nextElementSibling;
          if (label && label.tagName === 'LABEL') {
            label.style.display = 'inline-flex';
            label.style.alignItems = 'center';
            label.style.marginBottom = '0';
            label.style.marginLeft = '0';
          }
          
          // Wrap checkbox and label in a flex container
          const parent = checkbox.parentNode;
          if (parent && !parent.classList.contains('checkbox-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'checkbox-wrapper';
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.gap = '0.5rem';
            wrapper.style.marginBottom = '1rem';
            
            parent.insertBefore(wrapper, checkbox);
            wrapper.appendChild(checkbox);
            if (label) wrapper.appendChild(label);
          }
        });

        checkboxes.forEach(checkbox => {
          const container = checkbox.closest('.form-group') || checkbox.parentElement;
          if (container && !container.dataset.alignedCheckbox) {
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'auto 1fr';
            container.style.alignItems = 'start';
            container.style.columnGap = '0.55rem';
            container.dataset.alignedCheckbox = 'true';
          }

          const label = container && container.querySelector('label');
          if (label) {
            label.style.margin = '0';
            label.style.lineHeight = '1.3';
            label.style.fontSize = '0.88rem';
          }
        });

        // Style any new buttons that B2C injects
        const buttons = document.querySelectorAll('#api button, #api input[type="submit"]');
        buttons.forEach(button => {
          // Sign-up button gets ghost/outline style
          var isSignUp = button.id === 'createAccount' || button.id === 'signup' || button.classList.contains('accountButton');
          if (isSignUp) {
            button.style.background = 'transparent';
            button.style.border = '1px solid rgba(108, 79, 240, 0.5)';
            button.style.color = '#c4b5fd';
            button.style.boxShadow = 'none';
            button.style.marginTop = '0.75rem';
          } else {
            button.style.background = '#6c4ff0';
            button.style.border = '1px solid rgba(108, 79, 240, 0.5)';
            button.style.boxShadow = '0 6px 14px rgba(108, 79, 240, 0.3)';
            button.style.color = '#f8fafc';
          }
          button.style.borderRadius = '12px';
          button.style.padding = '0.85rem 1.15rem';
          button.style.fontSize = '0.95rem';
          button.style.fontWeight = '600';
          button.style.width = '100%';
          button.style.cursor = 'pointer';
          button.style.marginBottom = '1rem';
          button.style.textTransform = 'none';
        });

      } catch (e) {
        console.warn('Theme force error:', e);
      }
    }
    
    function prioritizeCountries() {
      try {
        const selects = document.querySelectorAll('#api select');
        selects.forEach(function(select) {
          if (select.dataset.prioritized) return;
          var opts = Array.from(select.options);
          if (opts.length < 10) return;
          var names = ['United States', 'Canada', 'United Kingdom', 'France', 'Spain', 'United Arab Emirates'];
          var priority = [];
          names.forEach(function(name) {
            var opt = opts.find(function(o) { return o.textContent.indexOf(name) >= 0; });
            if (opt) priority.push(opt);
          });
          if (priority.length === 0) return;
          var currentValue = select.value;
          var placeholder = opts.find(function(o) { return !o.value || o.value === ''; });
          while (select.firstChild) select.removeChild(select.firstChild);
          if (placeholder) select.appendChild(placeholder);
          priority.forEach(function(opt) { select.appendChild(opt); });
          var sep = document.createElement('option');
          sep.disabled = true;
          sep.textContent = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
          select.appendChild(sep);
          opts.forEach(function(opt) {
            if (priority.indexOf(opt) < 0 && opt !== placeholder) select.appendChild(opt);
          });
          select.value = currentValue;
          select.dataset.prioritized = 'true';
        });
      } catch (e) {
        console.warn('Country priority error:', e);
      }
    }

     function applyCustomizations() {
       forceDarkTheme();
       removeHelpLinks();
       prioritizeCountries();
       ensureProfessionalLayout();
       fixTextSpacing();
     }

     function fixTextSpacing() {
       try {
         // Fix "Don't have an account?Sign up now" — inject space before link
         var createSection = document.querySelector('#api .create p, #api .create');
         if (createSection && !createSection.dataset.spacingFixed) {
           var link = createSection.querySelector('a');
           if (link && link.previousSibling && link.previousSibling.nodeType === 3) {
             var text = link.previousSibling.textContent;
             if (text && !text.endsWith(' ')) {
               link.previousSibling.textContent = text + ' ';
             }
           }
           createSection.dataset.spacingFixed = 'true';
         }
       } catch (e) {
         // silent
       }
     }
     
     function ensureProfessionalLayout() {
       try {
         // Ensure logo is always present and visible
         const api = document.getElementById('api');
         if (api) {
           let logoContainer = document.querySelector('.logo-container');
           
           // If logo container doesn't exist, create it
           if (!logoContainer) {
             logoContainer = document.createElement('div');
             logoContainer.className = 'logo-container';
            logoContainer.style.cssText = 'text-align: center !important; margin-bottom: 1.5rem !important; padding: 0.4rem 0 !important;';
             
             const logoImg = document.createElement('img');
            logoImg.src = 'https://creative-aigent.github.io/B2CAssets/aiman-logo-white.svg';
             logoImg.alt = 'AIMAN';
             logoImg.className = 'logo-icon';
            logoImg.style.cssText = 'width: 150px !important; height: 48px !important; object-fit: contain !important; border-radius: 0 !important;';
             
             logoContainer.appendChild(logoImg);
           }
           
           // Ensure logo is inside the API container
           if (logoContainer.parentNode !== api) {
             api.insertBefore(logoContainer, api.firstChild);
           }
         }
         
         // Force checkbox alignment - B2C compliant approach
         const checkboxes = document.querySelectorAll('#api input[type="checkbox"]');
         checkboxes.forEach(checkbox => {
           const label = checkbox.nextElementSibling;
           if (label && label.tagName === 'LABEL') {
             // Ensure they're in a flex container
             let container = checkbox.parentNode;
             if (!container.classList.contains('checkbox-wrapper')) {
               const wrapper = document.createElement('div');
               wrapper.className = 'checkbox-wrapper';
               wrapper.style.cssText = 'display: flex !important; align-items: center !important; gap: 0.5rem !important; margin-bottom: 1rem !important;';
               
               container.insertBefore(wrapper, checkbox);
               wrapper.appendChild(checkbox);
               if (label) wrapper.appendChild(label);
             }
             
             // Force label styling
             label.style.cssText = 'display: inline-flex !important; align-items: center !important; margin: 0 !important; font-size: 0.9rem !important;';
           }
         });
         
         // Force card styling - using B2C recommended approach
         const api = document.getElementById('api');
         if (api) {
           // Use individual style properties instead of cssText for better B2C compatibility
           api.style.background = 'rgba(17, 25, 40, 0.85)';
           api.style.backdropFilter = 'blur(20px)';
           api.style.border = 'none';
           api.style.borderRadius = '16px';
           api.style.boxShadow = '0 20px 40px rgba(15, 23, 42, 0.4)';
           api.style.padding = '2rem';
           api.style.maxWidth = '400px';
           api.style.margin = '2rem auto';
           api.style.minHeight = 'auto';
           api.style.maxHeight = 'none';
           api.style.overflow = 'visible';
         }
         
         // Hide any unwanted text - B2C compliant approach
         const unwantedTexts = document.querySelectorAll('#api *');
         unwantedTexts.forEach(element => {
           if (element.textContent && (
             element.textContent.includes('AIMAN') ||
             element.textContent.includes('What is this?') ||
             element.textContent.includes('Help')
           )) {
             if (element.tagName !== 'IMG' && !element.classList.contains('logo-icon')) {
               element.style.display = 'none';
             }
           }
         });
         
         // B2C compliant: style links — force remove underlines
         const links = document.querySelectorAll('#api a');
         links.forEach(link => {
           link.style.color = '#c4b5fd';
           link.style.textDecoration = 'none';
           link.style.borderBottom = 'none';
           link.style.setProperty('text-decoration', 'none', 'important');
         });
         
       } catch (e) {
         console.warn('Layout enforcement error:', e);
       }
     }


    
    // Run immediately and on load
    applyCustomizations();
    window.addEventListener('load', () => {
      applyCustomizations();
    });
    
    // Immediate logo check and creation
    function ensureLogoExists() {
      const api = document.getElementById('api');
      console.log('ensureLogoExists called, API element:', api);
      
      if (api) {
        let logoContainer = api.querySelector('.logo-container');
        console.log('Existing logo container:', logoContainer);
        
        if (!logoContainer) {
          console.log('Creating logo immediately...');
          logoContainer = document.createElement('div');
          logoContainer.className = 'logo-container';
          logoContainer.style.cssText = 'text-align: center !important; margin-bottom: 1.5rem !important; padding: 0.4rem 0 !important; display: block !important; visibility: visible !important;';

          const logoImg = document.createElement('img');
          logoImg.src = 'https://creative-aigent.github.io/B2CAssets/aiman-logo-white.svg?v=' + Date.now();
          logoImg.alt = 'AIMAN';
          logoImg.className = 'logo-icon';
          logoImg.style.cssText = 'width: 150px !important; height: 48px !important; object-fit: contain !important; border-radius: 0 !important; display: block !important; visibility: visible !important; margin: 0 auto !important;';

          // Add comprehensive error handling for image loading
          logoImg.onerror = function() {
            console.error('Logo image failed to load:', logoImg.src);
            // Create a fallback text logo
            const fallbackText = document.createElement('div');
            fallbackText.textContent = 'A';
            fallbackText.style.cssText = 'width: 150px !important; height: 48px !important; background: #6c4ff0 !important; color: white !important; display: flex !important; align-items: center !important; justify-content: center !important; border-radius: 0 !important; font-weight: bold !important; font-size: 24px !important; margin: 0 auto !important;';
            logoContainer.appendChild(fallbackText);
          };

          logoImg.onload = function() {
            console.log('Logo image loaded successfully');
            // Remove debug borders once loaded
            logoContainer.style.background = 'transparent';
            logoContainer.style.border = 'none';
            logoImg.style.background = 'transparent';
            logoImg.style.border = 'none';
          };

          logoContainer.appendChild(logoImg);

          if (api.firstChild) {
            api.insertBefore(logoContainer, api.firstChild);
            console.log('Logo inserted before first child');
          } else {
            api.appendChild(logoContainer);
            console.log('Logo appended as first child');
          }

          console.log('Logo created and inserted immediately with debug borders');
          console.log('API container now has', api.children.length, 'children');
        } else {
          console.log('Logo container already exists');
          logoContainer.style.display = 'block';
          logoContainer.style.visibility = 'visible';
          const logoImg = logoContainer.querySelector('.logo-icon');
          if (logoImg) {
            logoImg.src = 'https://creative-aigent.github.io/B2CAssets/aiman-logo-white.svg?v=' + Date.now();
          }
        }
      } else {
        console.log('API element not found');
      }
    }
    
    // Run logo check multiple times with different delays
    ensureLogoExists();
    setTimeout(ensureLogoExists, 100);
    setTimeout(ensureLogoExists, 500);
    setTimeout(ensureLogoExists, 1000);
    setTimeout(ensureLogoExists, 2000);

    // Watch for B2C content changes
    const observer = new MutationObserver(applyCustomizations);

    function tryObserveApi() {
      const api = document.getElementById('api');
      if (!api) {
        return false;
      }

      observer.observe(api, { childList: true, subtree: true });
      applyCustomizations();
      return true;
    }

    if (!tryObserveApi()) {
      const checkApi = setInterval(() => {
        if (tryObserveApi()) {
          clearInterval(checkApi);
        }
      }, 100);
    }
    
     // ULTRA-AGGRESSIVE: Run every 100ms to ensure styling is maintained
     setInterval(applyCustomizations, 150);
     
    // Extra logo enforcement - run every 50ms to catch B2C removals
    setInterval(() => {
      const api = document.getElementById('api');
      if (api) {
        // Check if logo exists anywhere in the API container
        let logoContainer = api.querySelector('.logo-container');
        
        if (!logoContainer) {
          console.log('Logo missing, recreating...');
          logoContainer = document.createElement('div');
          logoContainer.className = 'logo-container';
          logoContainer.style.cssText = 'text-align: center !important; margin-bottom: 1.5rem !important; padding: 0.4rem 0 !important; display: block !important; visibility: visible !important;';
          
          const logoImg = document.createElement('img');
          logoImg.src = 'https://creative-aigent.github.io/B2CAssets/aiman-logo-white.svg?v=' + Date.now();
          logoImg.alt = 'AIMAN';
          logoImg.className = 'logo-icon';
          logoImg.style.cssText = 'width: 150px !important; height: 48px !important; object-fit: contain !important; border-radius: 0 !important; display: block !important; visibility: visible !important; margin: 0 auto !important;';
          
          // Add comprehensive error handling
          logoImg.onerror = function() {
            console.error('Logo image failed to load:', logoImg.src);
            // Create a fallback text logo
            const fallbackText = document.createElement('div');
            fallbackText.textContent = 'A';
            fallbackText.style.cssText = 'width: 150px !important; height: 48px !important; background: #6c4ff0 !important; color: white !important; display: flex !important; align-items: center !important; justify-content: center !important; border-radius: 0 !important; font-weight: bold !important; font-size: 24px !important; margin: 0 auto !important;';
            logoContainer.appendChild(fallbackText);
          };
          
          logoImg.onload = function() {
            console.log('Logo image loaded successfully');
            // Remove debug borders once loaded
            logoContainer.style.background = 'transparent';
            logoContainer.style.border = 'none';
            logoImg.style.background = 'transparent';
            logoImg.style.border = 'none';
          };
          
          logoContainer.appendChild(logoImg);
          
          // Try to insert at the beginning of the API container
          if (api.firstChild) {
            api.insertBefore(logoContainer, api.firstChild);
          } else {
            api.appendChild(logoContainer);
          }
          
          console.log('Logo recreated and inserted with debug borders');
        } else {
          // Logo exists, make sure it's visible
          logoContainer.style.display = 'block';
          logoContainer.style.visibility = 'visible';
          const logoImg = logoContainer.querySelector('.logo-icon');
          if (logoImg) {
            logoImg.style.display = 'block';
            logoImg.style.visibility = 'visible';
            logoImg.src = 'https://creative-aigent.github.io/B2CAssets/aiman-logo-white.svg?v=' + Date.now();
          }
        }
      }
    }, 50);
    
    // Also run on any DOM changes
    document.addEventListener('DOMContentLoaded', applyCustomizations);
    document.addEventListener('DOMNodeInserted', applyCustomizations);
    document.addEventListener('DOMSubtreeModified', applyCustomizations);
  })();

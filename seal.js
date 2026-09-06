/**
 * Seal Rescue Engine - CDN JavaScript SDK
 * Version: 1.0.1
 * 
 * Captures frontend errors and can deliver approved patch candidates to
 * an application-provided handler. It does not evaluate remote code.
 */

(function(window) {
    'use strict';
  
    // Private state
    let config = {
      apiKey: null,
      appName: 'Frontend Client',
      environment: 'production',
      onApprovedPatches: null,
      rescueEngine: false,
      apiEndpoint: 'https://sealengine.desicon.ai/api/v1',
      patchCache: []
    };
  
    let listenersAttached = false;
    const Seal = {
      
      /**
       * Initialize the Seal SDK
       * @param {Object} options Configuration options
       */
      init: function(options) {
        if (!options || !options.apiKey) {
          console.warn('[Seal] API Key is required to initialize the SDK.');
          return;
        }
  
        config = { ...config, ...options };
        
        this.attachGlobalListeners();
        
        console.log(`[Seal] Initialized for ${config.appName}. Watching for errors...`);
  
        if (config.rescueEngine) {
          console.log('[Seal] Fetching approved patch candidates...');
          this.fetchAndApplyPatches();
        }

        // Fetch security policy and render trust badge if enabled
        this.fetchPolicy();
      },
  
      /**
       * Attach window level error and unhandled rejection listeners
       */
      attachGlobalListeners: function() {
        if (listenersAttached) return;
        listenersAttached = true;
        // Preserve existing application handlers.
        window.addEventListener('error', function(event) {
          const { message, filename: source, lineno, colno, error } = event;
          Seal.reportError({
            type: 'TypeError/Error',
            message: message,
            stack: error ? error.stack : '',
            context: { source, lineno, colno }
          });
        });
  
        // Promises
        window.addEventListener('unhandledrejection', function(event) {
          Seal.reportError({
            type: 'UnhandledRejection',
            message: event.reason ? event.reason.message || String(event.reason) : 'Unknown Promise Rejection',
            stack: event.reason && event.reason.stack ? event.reason.stack : '',
            context: { type: 'promise' }
          });
        });
      },
  
      /**
       * Send the error payload to the Seal Backend
       */
      reportError: function(errorData) {
        if (!config.apiKey) return;
  
        const payload = {
          app_name: config.appName,
          environment: config.environment,
          error_type: errorData.type || 'BrowserError',
          error_message: String(errorData.message || 'Unknown browser error'),
          stack_trace: errorData.stack || 'No stack trace available',
          severity: 'fatal',
          code_context: 'Browser error; source context omitted'
        };
  
        return fetch(`${config.apiEndpoint}/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.apiKey
          },
          body: JSON.stringify(payload)
        }).then(response => {
          if (!response.ok) throw new Error('Telemetry delivery failed');
          return response.json();
        }).catch(err => {
          // Silent catch to prevent infinite error loops
          console.error('[Seal] Failed to report error to backend.');
        });
      },
  
      /**
       * Deliver scoped, approved candidates to the host application. No eval/Function.
       * The host must explicitly implement validation, application and rollback.
       */
      fetchAndApplyPatches: function() {
        if (!config.apiKey || !config.rescueEngine || typeof config.onApprovedPatches !== 'function') {
          return Promise.resolve([]);
        }
        const query = `app_name=${encodeURIComponent(config.appName)}&environment=${encodeURIComponent(config.environment)}`;
        return fetch(`${config.apiEndpoint}/projects/rescue-patches?${query}`, {
          headers: { 'X-API-Key': config.apiKey }
        }).then(response => {
          if (!response.ok) throw new Error('Patch delivery failed');
          return response.json();
        }).then(patches => {
          if (!Array.isArray(patches)) return [];
          const candidates = patches.filter(patch => patch && typeof patch.patch_id === 'string'
            && typeof patch.patchCode === 'string' && Number.isInteger(patch.patch_version));
          if (candidates.length) config.onApprovedPatches(candidates);
          return candidates;
        }).catch(() => []);
      },

      /**
       * Fetch security policy and configuration
       */
      fetchPolicy: function() {
        if (!config.apiKey) return;
        fetch(`${config.apiEndpoint}/ingest/policy`, {
          method: 'GET',
          headers: {
            'X-API-Key': config.apiKey
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data && data.status === 'success' && data.policy && data.policy.trustBadge) {
            if (data.policy.trustBadge.enabled) {
              this.renderTrustBadge(data.policy.trustBadge);
            }
          }
        })
        .catch(err => {
           // Silent catch
        });
      },

      /**
       * Render the Trust Badge on the screen based on config
       */
      renderTrustBadge: function(badgeConfig) {
        // Prevent duplicate badges
        if (document.getElementById('seal-trust-badge')) return;

        const badge = document.createElement('a');
        badge.id = 'seal-trust-badge';
        badge.href = 'https://sealplatform.desicon.ai/trust';
        badge.target = '_blank';
        badge.rel = 'noopener noreferrer';
        
        // Base styling
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '8px';
        badge.style.padding = '8px 12px';
        badge.style.borderRadius = '8px';
        badge.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        badge.style.fontSize = '12px';
        badge.style.fontWeight = '600';
        badge.style.textDecoration = 'none';
        badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        badge.style.transition = 'all 0.2s ease';
        badge.style.zIndex = '999999';
        
        // Theme
        if (badgeConfig.theme === 'light') {
          badge.style.backgroundColor = '#ffffff';
          badge.style.color = '#1f2937';
          badge.style.border = '1px solid #e5e7eb';
        } else if (badgeConfig.theme === 'minimal') {
          badge.style.backgroundColor = 'transparent';
          badge.style.color = '#6b7280';
          badge.style.boxShadow = 'none';
        } else { // dark
          badge.style.backgroundColor = '#111827';
          badge.style.color = '#f9fafb';
          badge.style.border = '1px solid #374151';
        }

        // Positioning
        if (badgeConfig.position === 'inline') {
          badge.style.display = 'inline-flex';
          const container = document.getElementById('seal-badge-container');
          if (container) {
            container.appendChild(badge);
          } else {
             badge.style.position = 'fixed';
             badge.style.bottom = '20px';
             badge.style.right = '20px';
             document.body.appendChild(badge);
          }
        } else if (badgeConfig.position === 'footer') {
           const footer = document.querySelector('footer');
           if (footer) {
               badge.style.display = 'inline-flex';
               badge.style.margin = '20px auto';
               footer.appendChild(badge);
           } else {
               badge.style.position = 'fixed';
               badge.style.bottom = '20px';
               badge.style.right = '20px';
               document.body.appendChild(badge);
           }
        } else {
          badge.style.position = 'fixed';
          if (badgeConfig.position === 'bottom_left') {
            badge.style.bottom = '20px';
            badge.style.left = '20px';
          } else if (badgeConfig.position === 'top_right_corner') {
            badge.style.top = '20px';
            badge.style.right = '20px';
          } else { // default bottom_right
            badge.style.bottom = '20px';
            badge.style.right = '20px';
          }
          document.body.appendChild(badge);
        }
        
        // SVG Icon
        badge.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          Protected by Seal
        `;

        // Hover effect
        badge.addEventListener('mouseenter', () => {
           badge.style.transform = 'translateY(-2px)';
           if (badgeConfig.theme !== 'minimal') {
               badge.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
           }
        });
        badge.addEventListener('mouseleave', () => {
           badge.style.transform = 'translateY(0)';
           if (badgeConfig.theme !== 'minimal') {
               badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
           }
        });
      }
    };
  
    // Expose to global window object
    window.Seal = Seal;
  
  })(window);
  

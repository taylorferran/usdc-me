/**
 * USDC-ME Payment Widget
 *
 * Drop-in script for merchants to embed a "Pay with USDC-ME" button.
 *
 * Usage:
 *   <div id="usdcme-pay" data-payment-id="pay_abc123"></div>
 *   <script src="https://your-domain.com/widget.js"></script>
 *
 * Options (data attributes on the container element):
 *   data-payment-id  - (required) The payment request ID from the API
 *   data-label       - Button text (default: "Pay with USDC-ME")
 *   data-theme       - "dark" or "light" (default: "dark")
 *   data-base-url    - Override the USDC-ME app URL (default: same origin or http://localhost:3000)
 */
(function () {
  'use strict';

  var CONTAINER_ID = 'usdcme-pay';
  var DEFAULT_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

  function init() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    var paymentId = container.getAttribute('data-payment-id');
    if (!paymentId) {
      console.error('[USDC-ME] Missing data-payment-id on #usdcme-pay');
      return;
    }

    var label = container.getAttribute('data-label') || 'Pay with USDC-ME';
    var theme = container.getAttribute('data-theme') || 'dark';
    var baseUrl = container.getAttribute('data-base-url') || DEFAULT_BASE;

    // Create button
    var btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'usdcme-btn usdcme-btn--' + theme;
    btn.onclick = function () { openPayment(baseUrl, paymentId); };

    // Inject styles
    if (!document.getElementById('usdcme-widget-styles')) {
      var style = document.createElement('style');
      style.id = 'usdcme-widget-styles';
      style.textContent = [
        '.usdcme-btn {',
        '  display: inline-flex; align-items: center; gap: 8px;',
        '  padding: 12px 24px; border: none; border-radius: 8px;',
        '  font-size: 16px; font-weight: 600; cursor: pointer;',
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
        '  transition: opacity 0.15s;',
        '}',
        '.usdcme-btn:hover { opacity: 0.85; }',
        '.usdcme-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
        '.usdcme-btn--dark { background: #1a1a2e; color: #fff; }',
        '.usdcme-btn--light { background: #f0f0f0; color: #1a1a2e; border: 1px solid #ccc; }',
      ].join('\n');
      document.head.appendChild(style);
    }

    container.appendChild(btn);
  }

  function openPayment(baseUrl, paymentId) {
    var url = baseUrl + '/pay/' + paymentId + '?embed=true';
    var w = 420;
    var h = 650;
    var left = (screen.width - w) / 2;
    var top = (screen.height - h) / 2;
    var popup = window.open(
      url,
      'usdcme_pay',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',toolbar=no,menubar=no'
    );

    // Listen for payment completion from popup
    function onMessage(event) {
      if (!event.data || event.data.type !== 'usdcme:payment_success') return;
      window.removeEventListener('message', onMessage);

      // Dispatch custom event for the merchant's page to handle
      var customEvent = new CustomEvent('usdcme:payment', {
        detail: {
          paymentId: event.data.paymentId,
          intentId: event.data.intentId,
          status: 'paid',
        },
      });
      document.dispatchEvent(customEvent);

      if (popup && !popup.closed) popup.close();
    }

    window.addEventListener('message', onMessage);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function (root) {
  'use strict';
  var operations = {
    formSuccess: 'contact', joinSuccess: 'membership',
    newsletterSuccess: 'newsletter', donateSuccess: 'donation_interest'
  };
  async function submit(form, language) {
    var operation = operations[form.getAttribute('data-success-message')];
    if (!operation) throw new Error('Unknown operation');
    var data = new FormData(form);
    // Privileged fields are never part of the public submission contract.
    ['role', 'status', 'points', 'matricule', 'user_id', 'actor_role'].forEach(function (key) { data.delete(key); });
    if (operation === 'membership') {
      var requested = data.get('membership_type');
      if (!['membre', 'benevole', 'volontaire'].includes(requested)) throw new Error('Invalid requested role');
      data.set('requested_role', requested);
    }
    var config = root.ARDTTEMP_CONFIG || {};
    var endpoint = config.formsEndpoint || form.getAttribute('action');
    if (!endpoint) throw new Error('Submission service unavailable');
    var url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid endpoint');
    if (!config.formsEndpoint && (url.hostname !== 'formspree.io' || !/^\/f\/[a-z0-9]+$/.test(url.pathname))) throw new Error('Invalid fallback');
    var headers = { Accept: 'application/json' };
    var body = data;
    if (config.formsEndpoint) {
      headers['Content-Type'] = 'application/json';
      if (config.publishableKey) headers.apikey = config.publishableKey;
      body = JSON.stringify({ operation: operation, language: language, data: Object.fromEntries(data) });
    }
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch(url.href, { method: 'POST', headers: headers, body: body,
        credentials: 'omit', redirect: 'error', signal: controller.signal });
      if (!response.ok) throw new Error('Submission rejected');
      var result = await response.json();
      if (config.formsEndpoint ? result.ok !== true : result.ok !== true) throw new Error('Submission not confirmed');
      return result;
    } finally { clearTimeout(timer); }
  }
  root.ARDTTEMPForms = Object.freeze({ submit: submit });
})(window);

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(config, result) {
  const calls = [];
  class Data extends Map { constructor(form) { super(Object.entries(form.data)); } }
  const window = { ARDTTEMP_CONFIG: config };
  vm.runInNewContext(fs.readFileSync('js/platform-api.js', 'utf8'), {
    window, FormData: Data, URL, AbortController, setTimeout, clearTimeout,
    fetch: async (...args) => { calls.push(args); return result; }
  });
  return { submit: window.ARDTTEMPForms.submit, calls };
}
function form(kind, data = {}, action = 'https://formspree.io/f/xwvynnjr') {
  return { data, getAttribute: key => key === 'action' ? action : kind };
}
test('rejects admin request before network', async () => {
  const s = setup({}, {});
  await assert.rejects(s.submit(form('joinSuccess', {membership_type:'admin'}), 'fr'));
  assert.equal(s.calls.length, 0);
});
test('strips privileges and preserves public request in server payload', async () => {
  const s = setup({formsEndpoint:'https://example.supabase.co/functions/v1/forms'}, {ok:true,json:async()=>({ok:true})});
  await s.submit(form('joinSuccess', {membership_type:'benevole', role:'super_admin',status:'approved',points:'100'}), 'fr');
  const payload = JSON.parse(s.calls[0][1].body);
  assert.equal(payload.data.requested_role, 'benevole');
  assert.equal(payload.data.role, undefined);
  assert.equal(payload.data.status, undefined);
  assert.equal(payload.data.points, undefined);
  assert.equal(s.calls[0][1].credentials, 'omit');
});
test('server refusal and unconfirmed response never succeed', async () => {
  for (const response of [{ok:false}, {ok:true,json:async()=>({})}]) {
    const s = setup({}, response);
    await assert.rejects(s.submit(form('formSuccess'), 'fr'));
  }
});
test('missing donation endpoint fails without a network call', async () => {
  const s = setup({}, {});
  await assert.rejects(s.submit(form('donateSuccess', {}, null), 'fr'));
  assert.equal(s.calls.length, 0);
});
test('Formspree acceptance returns a confirmed success', async () => {
  const s = setup({}, {ok:true,json:async()=>({ok:true})});
  await s.submit(form('newsletterSuccess',{email:'test@example.org'}),'en');
  assert.equal(s.calls.length,1);
});

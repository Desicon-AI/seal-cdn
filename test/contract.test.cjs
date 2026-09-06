const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'seal.js'), 'utf8');
function fixture() {
  const calls = [], handlers = {};
  const previous = () => {};
  const window = { onerror: previous, addEventListener(name, fn) { (handlers[name] ||= []).push(fn); } };
  const context = { window, console: { log() {}, warn() {}, error() {} }, Promise,
    fetch: async (url, options) => { calls.push({url, options}); return {ok: true, json: async () => url.includes('rescue-patches') ? [{hash:'test', patchCode:'window.executed = true', patch_id:'test-patch', patch_version:1}] : {status:'ok'}}; }};
  vm.runInNewContext(source, context);
  return {seal:window.Seal, calls, window, handlers, previous};
}
test('error payload uses current backend authentication and required fields', async () => {
  const f = fixture(); f.seal.init({apiKey:'synthetic', appName:'Frontend', environment:'staging'});
  await f.seal.reportError({type:'TypeError', message:'Synthetic', stack:'test.js:1:1'});
  const call = f.calls.find(call => call.url.endsWith('/ingest'));
  assert.equal(call.options.headers['X-API-Key'], 'synthetic');
  assert.equal(call.options.headers.Authorization, undefined);
  const payload = JSON.parse(call.options.body);
  for (const key of ['app_name','error_type','error_message','stack_trace','code_context','environment','severity']) assert.equal(typeof payload[key], 'string');
  assert.equal(payload.environment, 'staging');
});
test('enabling rescue alone cannot execute or fetch remote code', async () => {
  const f=fixture(); f.seal.init({apiKey:'synthetic', rescueEngine:true});
  await f.seal.fetchAndApplyPatches();
  assert.equal(f.calls.filter(call => call.url.includes('rescue-patches')).length, 0);
  assert.equal(f.window.executed, undefined);
});
test('explicit handler receives approved candidates scoped by app/environment', async () => {
  const f=fixture(), received=[];
  f.seal.init({apiKey:'synthetic',appName:'Test app',environment:'staging',rescueEngine:true,onApprovedPatches:items=>received.push(items)});
  await f.seal.fetchAndApplyPatches();
  assert.ok(f.calls.some(call=>call.url.endsWith('/projects/rescue-patches?app_name=Test%20app&environment=staging')));
  assert.equal(received[0][0].patch_id,'test-patch');
  assert.equal(f.window.executed,undefined);
});
test('reinitialization preserves existing handlers without duplicate listeners', () => {
  const f=fixture(); f.seal.init({apiKey:'synthetic'}); f.seal.init({apiKey:'synthetic'});
  assert.equal(f.window.onerror, f.previous);
  assert.equal(f.handlers.error.length,1); assert.equal(f.handlers.unhandledrejection.length,1);
});

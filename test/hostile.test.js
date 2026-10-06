import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { CONFIG_LIMITS, JSON_LIMITS, checkText } from '../src/index.js';
import { ASSETS, allowed, asset, cli, config, configText, run, usdc, webhook, withFiles } from './helpers.js';

// Each test builds input meant to make the tool slow or to exhaust the stack or the memory, and checks that it ends with
// an answer in good time. The time allowed is four times as long under coverage (NODE_V8_COVERAGE is set only when
// coverage is on).

function timed(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

test('a thousand assets, each compared with the ones before it for a duplicate, are checked in good time', () => {
  const many = Array.from({ length: CONFIG_LIMITS.maxAssets }, (_, i) => asset({ name: `A${i}` }));
  const { value, ms } = timed(() => checkText(configText(config({ invoice: { expirySeconds: 60, expiryRequires: 'paid', underpaymentTolerance: 0, overpaymentTolerance: 0 } }, many))));
  assert.equal(value.config.assets.length, CONFIG_LIMITS.maxAssets);
  assert.equal(value.findings.filter((f) => f.id === 'invoice-expiry-below-confirmation-time').length, CONFIG_LIMITS.maxAssets);
  assert.ok(ms < allowed(10000), `took ${ms} ms`);
  const same = Array.from({ length: CONFIG_LIMITS.maxAssets }, () => asset());
  const dup = timed(() => checkText(configText(config({}, same))));
  assert.equal(dup.value.findings.filter((f) => f.id === 'asset-duplicate').length, CONFIG_LIMITS.maxAssets - 1);
  assert.ok(dup.ms < allowed(10000), `took ${dup.ms} ms`);
});

test('deep nesting ends with an error finding at the limit, never a stack overflow, and the secret scans do not recurse', () => {
  const deep = `${'['.repeat(100000)}${']'.repeat(100000)}`;
  const { value } = timed(() => checkText(deep));
  assert.equal(value.findings[0].id, 'config-unreadable');
  assert.match(value.findings[0].message, new RegExp(`nested more than ${JSON_LIMITS.maxDepth} deep`));
  const nested = `{"notes": ${'['.repeat(JSON_LIMITS.maxDepth - 1)}"x"${']'.repeat(JSON_LIMITS.maxDepth - 1)}, "checkout": "p", "assets": []}`;
  const r = checkText(nested);
  assert.ok(r.findings.some((f) => f.id === 'field-invalid' && /notes/.test(f.message)));
  const keyed = `{"privateKey": ${'{"a": '.repeat(JSON_LIMITS.maxDepth - 1)}1${'}'.repeat(JSON_LIMITS.maxDepth - 1)}}`;
  assert.equal(checkText(keyed).findings.filter((f) => f.id === 'secret-in-config').length, 1);
  const inline = `{"webhook": {"signingSecret": ${'{"a": '.repeat(JSON_LIMITS.maxDepth - 2)}1${'}'.repeat(JSON_LIMITS.maxDepth - 2)}}}`;
  assert.equal(checkText(inline).findings.filter((f) => f.id === 'secret-in-config').length, 1);
});

test('numbers with very many digits or a huge exponent are refused as a field, not worked out', () => {
  const huge = config({}, [...ASSETS.slice(0, 3), usdc('solana', { depositAddress: 'shared', reference: 'reference-key', decimals: 1e300, maxAmount: 1e300 })]);
  const text = configText(huge).split('1e+300').join(`1${'0'.repeat(5000)}`);
  const { value, ms } = timed(() => checkText(text));
  const f = value.findings.filter((x) => x.id === 'field-invalid');
  assert.equal(f.length, 2);
  assert.match(f[0].message, /The decimals of asset USDC on solana is the number 1000000000000000000000000000000000000\.\.\./);
  assert.ok(ms < allowed(3000), `took ${ms} ms`);
  assert.ok(checkText(configText(config({ invoice: { expirySeconds: 1 } })).replace('"expirySeconds": 1', '"expirySeconds": 1e999999')).findings.some((x) => x.id === 'field-invalid'));
  const amount = checkText(configText(config({}, [asset({ maxAmount: 1 })])).replace('"maxAmount": 1,', `"maxAmount": 0.${'1'.repeat(5000)},`));
  assert.ok(amount.findings.some((x) => x.id === 'field-invalid' && /maxAmount/.test(x.message)));
});

test('long strings and long lines are read in good time', () => {
  const long = configText(config({ notes: 'a '.repeat(200000) }, [...ASSETS, asset({ name: 'n'.repeat(200000) })]));
  const { value, ms } = timed(() => checkText(long));
  assert.deepEqual(value.findings, []);
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
  const contract = checkText(configText(config({}, [...ASSETS, usdc('base', { contract: `0x${'1'.repeat(200000)}` })])));
  const f = contract.findings.find((x) => x.id === 'token-contract-malformed');
  assert.ok(f.message.length < 600);
  const ref = timed(() => checkText(configText(config({ webhook: webhook({ secretRef: 'A'.repeat(500000) }) }))));
  assert.equal(ref.value.findings.filter((x) => x.id === 'secret-in-config').length, 1);
  assert.ok(ref.ms < allowed(3000), `took ${ref.ms} ms`);
});

test('names such as __proto__, constructor and toString are only names', () => {
  const text = configText(config({}, [asset({ name: '__proto__' }), asset({ name: 'constructor', network: 'toString', commitment: undefined, confirmations: 6 }), asset({ name: 'toString' })])).replace('"checkout": "Test Store",', '"checkout": "Test Store", "__proto__": {"polluted": 1}, "hasOwnProperty": 2,');
  const { value } = timed(() => checkText(text));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"__proto__"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'network-not-in-table' && /"toString"/.test(f.message)));
  assert.deepEqual(value.config.assets.map((a) => a.name), ['__proto__', 'constructor', 'toString']);
  assert.equal({}.polluted, undefined);
  assert.equal(checkText(configText(config({}, [asset({ name: 'X' })])), { minConfirmations: { __proto__: 1 } }).findings.length, 0);
});

test('a run leaves the folder as it was: the tool writes nothing', async () => {
  const files = { 'checkout.json': configText(config()) };
  await withFiles(files, async (dir) => {
    const before = (await readdir(dir, { recursive: true })).sort();
    await cli(['checkout.json', '--format', 'sarif'], dir);
    await cli(['checkout.json', '--json', '--explain'], dir);
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
  });
  assert.equal((await run(files, ['checkout.json'])).code, 0);
});

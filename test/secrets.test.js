import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECRET_KEYS, checkText, findSecrets, isInlineSecretKey, isReferenceName, isSecretKey, readJson, secretShape } from '../src/index.js';
import { ASSETS, USDC, addr, config, configText, ofCheck, run, usdc, webhook } from './helpers.js';

// Shapes built from repeated characters, so that no file of the repository holds anything that could be a real seed,
// key or signing secret.
const MNEMONIC = Array.from({ length: 12 }, () => 'lantern').join(' ');
const MNEMONIC_24 = Array.from({ length: 24 }, (_, i) => (i % 2 ? 'harbor' : 'lantern')).join(' ');
const XPRV = `x${'prv'}${'9'.repeat(107)}`;
const HEX = `0x${'ab'.repeat(32)}`;
const WIF = `5${'H'.repeat(50)}`;
const SIGNING = `whsec_${'q'.repeat(24)}`;
const OPAQUE = `${'a1'.repeat(16)}`;

test('secretShape: a mnemonic of 12 to 24 words, an extended private key, a key in hex and a key in WIF', () => {
  assert.equal(secretShape(MNEMONIC), 'a mnemonic');
  assert.equal(secretShape(MNEMONIC_24), 'a mnemonic');
  assert.equal(secretShape(`  ${MNEMONIC}  `), 'a mnemonic');
  assert.equal(secretShape(XPRV), 'an extended private key');
  assert.equal(secretShape(HEX), 'a private key in hex');
  assert.equal(secretShape(HEX.slice(2)), 'a private key in hex');
  assert.equal(secretShape(WIF), 'a private key in WIF');
  assert.equal(secretShape(`K${'z'.repeat(51)}`), 'a private key in WIF');
});

test('secretShape: contract and mint addresses and other near misses are not secrets', () => {
  for (const ok of [addr('1'), USDC.ethereum, USDC.solana, `T${'H'.repeat(33)}`, `0x${'ab'.repeat(31)}`, Array.from({ length: 11 }, () => 'lantern').join(' '), `x${'pub'}${'9'.repeat(107)}`, 'event.id', 'env:CHECKOUT_WEBHOOK_SECRET', 'hmac-sha256', '']) assert.equal(secretShape(ok), null, ok);
});

test('isSecretKey: names of keys and seeds in any case and with any separator, and near misses', () => {
  for (const k of ['privateKey', 'private_key', 'PRIVATE-KEY', 'mnemonic', 'seedPhrase', 'xprv', 'wif', 'secret', 'passphrase', 'password']) assert.ok(isSecretKey(k), k);
  for (const k of ['name', 'contract', 'secretRef', 'signature', 'publicKey', 'idempotencyKey']) assert.ok(!isSecretKey(k), k);
  assert.ok(SECRET_KEYS.includes('privatekey'));
});

test('isInlineSecretKey: a key of the webhook named for a secret, but not secretRef or idempotencyKey', () => {
  for (const k of ['signingSecret', 'webhook_secret', 'SECRET', 'hmacKey', 'signing-key', 'key', 'token', 'apiKey', 'password']) assert.ok(isInlineSecretKey(k), k);
  for (const k of ['secretRef', 'secret_ref', 'idempotencyKey', 'url', 'signature', 'retry']) assert.ok(!isInlineSecretKey(k), k);
});

test('isReferenceName: the name of a reference, and values that are probably the secret itself', () => {
  for (const ok of ['env:CHECKOUT_WEBHOOK_SECRET', 'CHECKOUT_WEBHOOK_SECRET', 'vault:payments/webhook', 'aws-sm:prod/checkout.webhook', '_SECRET']) assert.ok(isReferenceName(ok), ok);
  for (const bad of [SIGNING, `env:${SIGNING}`, `sk_live_${'q'.repeat(20)}`, OPAQUE, 'two words', 'env:', '9STARTS_WITH_DIGIT', `A${'b'.repeat(130)}`]) assert.ok(!isReferenceName(bad), bad);
});

test('secret-in-config: a webhook signing secret under a key named for one, at its line, never shown in any format', async () => {
  const c = config({ webhook: webhook({ signingSecret: SIGNING }) });
  const text = configText(c);
  const f = ofCheck(c, 'secret-in-config');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^The webhook holds the key "signingSecret", a signing secret written into the file\. The value is not shown/);
  assert.equal(f[0].line, text.split('\n').findIndex((l) => l.includes('"signingSecret"')) + 1);
  assert.deepEqual(ofCheck(c, 'field-unknown'), [], 'the key is reported once, as a secret');
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ 'c.json': text }, ['c.json', '--format', format]);
    assert.equal(r.code, 1, format);
    assert.ok(!r.out.includes('qqqq'), format);
  }
});

test('secret-in-config: a secretRef that is not shaped like a reference is the secret itself and is not shown', async () => {
  for (const value of [SIGNING, OPAQUE, `env:${SIGNING}`]) {
    const c = config({ webhook: webhook({ secretRef: value }) });
    const r = checkText(configText(c));
    const f = r.findings.filter((x) => x.id === 'secret-in-config');
    assert.equal(f.length, 1, value);
    assert.match(f[0].message, /^The secretRef of the webhook is not shaped like the name of a reference; it may be the signing secret itself/);
    assert.ok(!r.findings.some((x) => x.message.includes(value)), value);
    const out = await run({ 'c.json': configText(c) }, ['c.json', '--json', '--explain']);
    assert.ok(!out.out.includes(value), value);
  }
  assert.deepEqual(ofCheck(config(), 'secret-in-config'), []);
  assert.deepEqual(ofCheck(config({ webhook: webhook({ secretRef: 7 }) }), 'field-invalid').length, 1);
});

test('secret-in-config: a key named for a private key anywhere, with the value never shown', async () => {
  const c = config({ privateKey: MNEMONIC });
  const text = configText(c);
  const f = ofCheck(c, 'secret-in-config');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /The configuration holds the key "privateKey", which names a seed, a mnemonic or a private key\. The tool never reads one, and the value is not shown\./);
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ 'c.json': text }, ['c.json', '--format', format]);
    assert.ok(!r.out.includes('lantern'), format);
  }
  assert.ok(!findSecrets(readJson(configText(config()))).length, 'a clean configuration has none');
});

test('secret-in-config: a value shaped like a key under any field, the field left out of the checks and never echoed', async () => {
  for (const [shape, value] of [['a mnemonic', MNEMONIC], ['an extended private key', XPRV], ['a private key in hex', HEX], ['a private key in WIF', WIF]]) {
    const c = config({}, [...ASSETS.slice(0, 2), usdc('ethereum', { name: value, contract: value, notes: value }), ASSETS[3]]);
    const r = checkText(configText(c));
    const secrets = r.findings.filter((f) => f.id === 'secret-in-config');
    assert.equal(secrets.length, 3, shape);
    assert.match(secrets[0].message, new RegExp(`is shaped like ${shape}\\. The tool never reads a seed or a key, and the value is not shown\\.`));
    assert.match(secrets[1].message, /^The value of "contract" is shaped like/);
    assert.ok(!r.findings.some((f) => f.message.includes(value)), shape);
    assert.ok(!r.findings.some((f) => f.id === 'token-contract-missing' || f.id === 'token-contract-malformed'), `${shape}: the field is there, but not read`);
    assert.equal(r.analysis.rows[2].asset, 'asset 3 on ethereum');
    const out = await run({ 'c.json': configText(c) }, ['c.json', '--json', '--explain']);
    assert.ok(!out.out.includes(value), shape);
  }
});

test('secret-in-config: a key shaped like a mnemonic is not shown, and a secret in a list or under a secret key is reported once', () => {
  const r = checkText(configText(config({ [MNEMONIC]: 1, extra: [HEX], privateKey: { nested: XPRV } })));
  const secrets = r.findings.filter((f) => f.id === 'secret-in-config');
  assert.equal(secrets.length, 3);
  assert.ok(secrets.some((f) => /a key shaped like a mnemonic/.test(f.message)));
  assert.ok(secrets.some((f) => /^The value of "extra" is shaped like a private key in hex/.test(f.message)));
  assert.ok(secrets.some((f) => /the key "privateKey"/.test(f.message)));
  assert.ok(!r.findings.some((f) => f.message.includes('lantern') || f.message.includes(HEX) || f.message.includes(XPRV)));
  assert.ok(r.findings.some((f) => f.id === 'field-unknown' && /"extra"/.test(f.message)), 'a list under an unknown key is still an unknown key');
});

test('secret-in-config: a secret value under a field that must be a number, or under the assets, is not described', () => {
  const c = config({}, [...ASSETS.slice(0, 3), usdc('solana', { depositAddress: 'shared', reference: 'reference-key', decimals: HEX })]);
  assert.deepEqual(checkText(configText(c)).findings.map((f) => f.id), ['secret-in-config']);
  const whole = checkText(configText(config({ assets: WIF })));
  assert.deepEqual(whole.findings.map((f) => f.id), ['secret-in-config']);
  const hook = checkText(configText(config({ webhook: webhook({ url: HEX }) })));
  assert.deepEqual(hook.findings.map((f) => f.id), ['secret-in-config']);
});

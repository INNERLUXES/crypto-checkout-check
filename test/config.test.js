import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_KEYS, BACKOFFS, CONFIG_LIMITS, DEPOSIT_POLICIES, DESTINATIONS, EXPIRY_REQUIRES, INVOICE_KEYS, KINDS, REFERENCES, REFUND_KEYS, RETRY_KEYS, STRONG_SIGNATURES, TOP_KEYS, WEAK_SIGNATURES, WEBHOOK_KEYS, checkText, cut, describe, readConfig, readJson, suggestKey } from '../src/index.js';
import { ASSETS, USDC, asset, config, configText, idsOf, invoice, lineOf, ofCheck, refunds, usdc, webhook, withAsset } from './helpers.js';

test('readConfig: the checkout, its assets, the invoice, the webhook and the refunds, with every value of each', () => {
  const { config: c, findings } = readConfig(readJson(configText(config({ notes: 'made up' }))));
  assert.deepEqual(findings, []);
  assert.equal(c.checkout, 'Test Store');
  assert.equal(c.currency, 'USD');
  assert.deepEqual(c.assets.map((a) => [a.name, a.network.id, a.kind, a.decimals, a.confirmations, a.commitment, a.depositAddress, a.reference]), [['BTC', 'bitcoin', 'native', 8, 6, null, 'per-invoice', null], ['ETH', 'ethereum', 'native', 18, null, 'finalized', 'per-invoice', null], ['USDC', 'ethereum', 'token', 6, null, 'finalized', 'per-invoice', null], ['USDC', 'solana', 'token', 6, null, 'finalized', 'shared', 'reference-key']]);
  assert.equal(c.assets[2].contract, USDC.ethereum);
  assert.deepEqual(c.assets[1].maxAmount, { int: 25000n, scale: 0 });
  assert.equal(c.assets[1].title, 'ETH on ethereum');
  assert.equal(c.invoice.expirySeconds, 900);
  assert.equal(c.invoice.expiryRequires, 'detected');
  assert.deepEqual(c.invoice.underpaymentTolerance, { int: 5n, scale: 1 });
  assert.equal(c.webhook.scheme, 'https');
  assert.equal(c.webhook.signature, 'hmac-sha256');
  assert.equal(c.webhook.secretRef, 'env:CHECKOUT_WEBHOOK_SECRET');
  assert.equal(c.webhook.timestampTolerance, 300);
  assert.equal(c.webhook.idempotencyKey, 'event.id');
  assert.deepEqual([c.webhook.retry.maxAttempts, c.webhook.retry.backoff], [12, 'exponential']);
  assert.deepEqual([c.refunds.enabled, c.refunds.destination, c.refunds.review], [true, 'customer-provided', true]);
});

test('the lists of keys and values', () => {
  assert.deepEqual(TOP_KEYS, ['checkout', 'currency', 'assets', 'invoice', 'webhook', 'refunds', 'notes']);
  assert.deepEqual(ASSET_KEYS, ['name', 'network', 'kind', 'contract', 'decimals', 'confirmations', 'commitment', 'maxAmount', 'depositAddress', 'reference', 'notes']);
  assert.deepEqual(INVOICE_KEYS, ['expirySeconds', 'expiryRequires', 'rateLockSeconds', 'underpaymentTolerance', 'overpaymentTolerance', 'notes']);
  assert.deepEqual(WEBHOOK_KEYS, ['url', 'secretRef', 'signature', 'timestampTolerance', 'idempotencyKey', 'retry', 'notes']);
  assert.deepEqual(RETRY_KEYS, ['maxAttempts', 'backoff', 'notes']);
  assert.deepEqual(REFUND_KEYS, ['enabled', 'destination', 'review', 'notes']);
  assert.deepEqual(KINDS, ['native', 'token']);
  assert.deepEqual(EXPIRY_REQUIRES, ['detected', 'paid']);
  assert.deepEqual(DEPOSIT_POLICIES, ['per-invoice', 'shared']);
  assert.deepEqual(REFERENCES, ['none', 'memo', 'reference-key']);
  assert.deepEqual(BACKOFFS, ['exponential', 'linear', 'fixed']);
  assert.deepEqual(DESTINATIONS, ['sender', 'customer-provided', 'operator']);
  assert.deepEqual(STRONG_SIGNATURES, ['hmac-sha256', 'hmac-sha512']);
  assert.ok(WEAK_SIGNATURES.includes('hmac-sha1') && WEAK_SIGNATURES.includes('md5'));
  assert.equal(CONFIG_LIMITS.maxAssets, 1000);
  assert.equal(cut('x'.repeat(200)).length, 120);
  assert.equal(describe({ kind: 'number', raw: '7' }), 'the number 7');
  assert.equal(describe({ kind: 'string', secret: true }), 'a value that is not shown');
  assert.equal(describe({ kind: 'null' }), 'null');
  assert.equal(describe({ kind: 'boolean', value: false }), 'false');
});

test('config-unreadable: text that is not JSON and JSON that is not an object; not an object with fields missing', () => {
  for (const text of ['{"checkout": "a",}', '[1, 2]', '"checkout"', '{"a": 1, "a": 2}']) {
    const r = checkText(text);
    assert.deepEqual(r.findings.map((f) => f.id), ['config-unreadable'], text);
    assert.equal(r.config, null);
  }
  assert.match(checkText('[]').findings[0].message, /The file holds a list, not a checkout configuration/);
  assert.ok(!checkText('{}').findings.some((f) => f.id === 'config-unreadable'));
  assert.match(checkText('{"a": 1,\n "b": }').findings[0].message, /at line 2, column 7/);
});

test('field-missing: every part of the configuration, at the line of the object that lacks it', () => {
  for (const key of ['checkout', 'currency', 'assets', 'invoice', 'webhook', 'refunds']) {
    const f = ofCheck(config({ [key]: undefined }), 'field-missing');
    assert.equal(f.length, 1, key);
    assert.match(f[0].message, new RegExp(`^The configuration has no ${key}`), key);
    assert.equal(f[0].line, 1, key);
  }
  assert.match(ofCheck(config({}, []), 'field-missing')[0].message, /an empty list; give at least one asset/);
});

test('field-missing: the fields of an asset, the decimals of a token and what marks an invoice paid', () => {
  for (const key of ['name', 'network', 'kind', 'depositAddress']) {
    const c = withAsset(asset({ [key]: undefined }), 1);
    const f = ofCheck(c, 'field-missing');
    assert.equal(f.length, 1, key);
    assert.match(f[0].message, new RegExp(`^Asset 2 has no ${key}\\.`), key);
    assert.equal(f[0].line, lineOf(configText(c), '\n    {', 2) + 1, key);
  }
  assert.match(ofCheck(withAsset(usdc('ethereum', { decimals: undefined }), 2), 'field-missing')[0].message, /^Asset 3 is a token and has no decimals/);
  assert.match(ofCheck(withAsset(asset({ commitment: undefined }), 1), 'field-missing')[0].message, /^Asset 2 has no confirmations; give confirmations or a commitment/);
  assert.match(ofCheck(withAsset(asset({ network: 'solana', commitment: undefined }), 1), 'field-missing')[0].message, /^Asset 2 has no commitment; give a commitment/);
  assert.match(ofCheck(withAsset(asset({ network: 'bitcoin', commitment: undefined }), 1), 'field-missing')[0].message, /^Asset 2 has no confirmations; give confirmations, what marks/);
  assert.match(ofCheck(withAsset(asset({ network: 'litecoin', commitment: undefined }), 1), 'field-missing')[0].message, /give confirmations or a commitment/);
  assert.deepEqual(ofCheck(withAsset(asset({ kind: 'native', decimals: undefined }), 1), 'field-missing'), [], 'a native asset needs no decimals');
});

test('field-missing: the webhook secret, the retry attempts, the refunds switch and their destination', () => {
  assert.match(ofCheck(config({ webhook: webhook({ secretRef: undefined }) }), 'field-missing')[0].message, /^The webhook is signed with hmac-sha256 but has no secretRef/);
  assert.deepEqual(ofCheck(config({ webhook: webhook({ secretRef: undefined, signature: 'none' }) }), 'field-missing'), [], 'no key, no reference to it');
  assert.match(ofCheck(config({ webhook: webhook({ retry: { backoff: 'fixed' } }) }), 'field-missing')[0].message, /^The retry policy of the webhook has no maxAttempts\./);
  assert.match(ofCheck(config({ refunds: refunds({ enabled: undefined }) }), 'field-missing')[0].message, /^The refunds have no enabled/);
  assert.match(ofCheck(config({ refunds: refunds({ destination: undefined }) }), 'field-missing')[0].message, /^The refunds has no destination\./);
  assert.deepEqual(ofCheck(config({ refunds: { enabled: false } }), 'field-missing'), [], 'no destination when refunds are off');
  assert.match(ofCheck(config({ webhook: webhook({ url: undefined }) }), 'field-missing')[0].message, /^The webhook has no url\./);
});

test('field-unknown: a key the tool does not read, with the key it is probably meant to be', () => {
  const c = withAsset(asset({ Decimals: 18, decimals: undefined }), 1);
  const f = ofCheck(c, 'field-unknown');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^The key "Decimals" of asset 2 is not one the tool reads, so its value was left out of every check\. Did you mean "decimals"\?/);
  assert.equal(f[0].line, lineOf(configText(c), '"Decimals"'));
  assert.match(ofCheck(config({ invoice: invoice({ expiry: 900 }) }), 'field-unknown')[0].message, /Did you mean "expirySeconds"\?/);
  assert.match(ofCheck(config({ webhook: webhook({ idempotency: 'id' }) }), 'field-unknown')[0].message, /Did you mean "idempotencyKey"\?/);
  assert.doesNotMatch(ofCheck(config({ zz: 1 }), 'field-unknown')[0].message, /Did you mean/);
  assert.equal(suggestKey('ab', TOP_KEYS), null);
  assert.equal(suggestKey('CURRENCY', TOP_KEYS), 'currency');
});

test('field-invalid: values of the wrong type or form, each at its line and left out of the checks', () => {
  // The line of the needle, in the second asset when it is a field every asset has.
  const at = (c, needle) => {
    const f = ofCheck(c, 'field-invalid');
    assert.equal(f.length, 1, needle);
    const n = ['"decimals"', '"maxAmount"', '"name"', '"confirmations"'].includes(needle) ? 2 : 1;
    assert.equal(f[0].line, lineOf(configText(c), needle, n), needle);
    return f[0].message;
  };
  assert.match(at(withAsset(asset({ kind: 'erc20' }), 1), '"erc20"'), /The kind of asset ETH on ethereum is "erc20"; it must be native or token\./);
  assert.match(at(withAsset(asset({ decimals: 1.5 }), 1), '"decimals"'), /must be a whole number of decimals from 0 to 36/);
  assert.match(at(withAsset(asset({ decimals: 37 }), 1), '"decimals"'), /from 0 to 36/);
  assert.match(at(withAsset(asset({ commitment: undefined, confirmations: -1 }), 1), '"confirmations"'), /whole number of confirmations/);
  assert.match(at(withAsset(asset({ maxAmount: '25000' }), 1), '"maxAmount"'), /an amount must be a plain decimal number/);
  assert.match(at(withAsset(asset({ maxAmount: -5 }), 1), '"maxAmount"'), /no exponent and no sign/);
  assert.match(at(withAsset(asset({ depositAddress: 'reuse' }), 1), '"reuse"'), /must be per-invoice or shared/);
  assert.match(at(withAsset(asset({ reference: 'tag' }), 1), '"tag"'), /must be none, memo or reference-key/);
  assert.match(at(withAsset(asset({ name: 3 }), 1), '"name"'), /The name of asset 2 is the number 3; it must be text\./);
  assert.match(at(withAsset(asset({ name: ' ' }), 1), '"name"'), /is empty/);
  assert.match(at(withAsset(asset({ notes: 3 }), 1), '"notes"'), /The notes of asset ETH on ethereum are the number 3; they must be text\./);
  assert.match(at(config({ invoice: invoice({ expirySeconds: 'ten' }) }), '"expirySeconds"'), /whole number of seconds/);
  assert.match(at(config({ invoice: invoice({ expiryRequires: 'mined' }) }), '"mined"'), /must be detected or paid/);
  assert.match(at(config({ invoice: invoice({ overpaymentTolerance: 101 }) }), '"overpaymentTolerance"'), /a percent must be at most 100/);
  assert.match(at(config({ invoice: invoice({ overpaymentTolerance: 'one' }) }), '"overpaymentTolerance"'), /a tolerance in percent must be a plain decimal number .* with no exponent, such as 0\.5/);
  assert.match(at(config({ webhook: webhook({ url: 'hooks.example/payments' }) }), '"url"'), /not an absolute URL with a scheme and a host/);
  assert.match(at(config({ webhook: webhook({ retry: 3 }) }), '"retry"'), /The retry of the webhook is the number 3; it must be an object\./);
  assert.match(at(config({ webhook: webhook({ retry: { maxAttempts: 3, backoff: 'random' } }) }), '"random"'), /must be exponential, linear or fixed/);
  assert.match(at(config({ refunds: refunds({ review: 'yes' }) }), '"review"'), /it must be true or false/);
  assert.match(at(config({ refunds: refunds({ destination: 'wallet' }) }), '"wallet"'), /must be sender, customer-provided or operator/);
  assert.match(at(config({ invoice: [] }), '"invoice"'), /The invoice of the configuration is a list; it must be an object\./);
  assert.match(at(config({ notes: {} }), '"notes"'), /The notes of the configuration are an object/);
  assert.match(at(config({ assets: {} }), '"assets"'), /The assets of the configuration are an object; they must be a list of objects\./);
  assert.match(at(config({}, [...ASSETS, 'ETH']), '"ETH"\n'), /Asset 5 of the assets is text; an asset is an object/);
});

test('field-invalid: a field the network of the asset does not take, and two ways of marking an invoice paid', () => {
  const one = (a, id = 'field-invalid') => ofCheck(withAsset(a, 1), id);
  assert.match(one(asset({ network: 'bitcoin', kind: 'token', contract: 'x', decimals: 8, commitment: undefined, confirmations: 6 }))[0].message, /is a token, but the tool reads no token on Bitcoin/);
  assert.match(one(asset({ contract: '0x1' }))[0].message, /is native, and a native asset takes no contract/);
  assert.match(one(asset({ network: 'bitcoin', commitment: 'finalized' }))[0].message, /where a payment is marked paid by confirmations; the network takes no commitment/);
  assert.match(one(asset({ network: 'tron', commitment: 'finalized' }))[0].message, /on Tron, where a payment is marked paid by confirmations/);
  assert.match(one(asset({ commitment: 'safe' }))[0].message, /on an EVM network the only commitment the tool reads is "finalized"/);
  assert.match(one(asset({ network: 'solana', commitment: 'rooted' }))[0].message, /on Solana it must be processed, confirmed or finalized/);
  assert.match(one(asset({ network: 'solana', confirmations: 32 }))[0].message, /on Solana, where a payment is marked paid at a commitment level; give commitment, not confirmations/);
  assert.match(one(asset({ confirmations: 64 }))[0].message, /gives both confirmations and a commitment; give one/);
  assert.deepEqual(one(asset({ network: 'litecoin', commitment: 'whatever' })), [], 'a network out of the table takes either');
  assert.equal(checkText(configText(withAsset(asset({ confirmations: 64 }), 1))).analysis.rows[1].paidAt, null);
});

test('field-invalid: more assets than the limit are reported once and the rest are not read', () => {
  const many = Array.from({ length: CONFIG_LIMITS.maxAssets + 2 }, (_, i) => asset({ name: `A${i}` }));
  const r = checkText(configText(config({}, many)));
  assert.equal(r.config.assets.length, CONFIG_LIMITS.maxAssets);
  assert.match(r.findings.find((f) => f.id === 'field-invalid').message, /1002 assets, more than the limit of 1000; only the first 1000 were read/);
});

test('asset-duplicate: two assets of one name on one network, without case and spaces; the same name on two networks is two assets', () => {
  const c = config({}, [...ASSETS, asset({ name: ' eth ', network: 'ETH' })]);
  const f = ofCheck(c, 'asset-duplicate');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^Asset 5 is  eth  on ETH, as is asset 2 at line \d+; a payment cannot be told apart/);
  assert.deepEqual(ofCheck(config({}, [...ASSETS, asset({ network: 'base', commitment: undefined, confirmations: 12, maxAmount: 1000 })]), 'asset-duplicate'), []);
  assert.deepEqual(idsOf(config({}, [...ASSETS, asset({ name: 'DOGE', network: 'dogecoin', commitment: undefined, confirmations: 6 }), asset({ name: 'doge', network: 'Dogecoin', commitment: undefined, confirmations: 6 })])).filter((id) => id === 'asset-duplicate').length, 1, 'a network out of the table is compared by its name');
});

test('the invoice reads expiryRequires as paid when it is not given', () => {
  const r = readConfig(readJson(configText(config({ invoice: invoice({ expiryRequires: undefined }) }))));
  assert.equal(r.config.invoice.expiryRequires, 'paid');
  assert.equal(r.config.invoice.expiryRequiresEntry, null);
  const neg = readConfig(readJson(configText(config({ invoice: invoice({ underpaymentTolerance: -0 }) }))));
  assert.equal(neg.config.invoice.underpaymentToleranceNegative, false, '-0 is 0');
  assert.equal(readConfig(readJson(configText(config({ invoice: invoice({ underpaymentTolerance: -2.5 }) })))).config.invoice.underpaymentToleranceNegative, true);
});

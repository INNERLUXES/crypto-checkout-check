import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEST, DEFAULT_LARGE_PAYMENT, RULES, analyzeConfig, atOrAbove, checkText, decide, duration, readConfig, readJson, ruleById, span, thresholdOf, timeToPaid } from '../src/index.js';
import { ASSETS, USDC, addr, asset, config, configText, idsOf, invoice, lineOf, ofCheck, refunds, tron, usdc, webhook, withAsset } from './helpers.js';

// The configuration with one more asset after the four of the helpers.
const plus = (a) => withAsset(a);
const BP = /This is a best practice of this tool, not a rule in the pages it cites\./;
const btc = (over = {}) => asset({ name: 'BTC', network: 'bitcoin', decimals: 8, commitment: undefined, confirmations: 6, ...over });
const evm = (network, over = {}) => asset({ name: 'ETH', network, commitment: undefined, confirmations: 12, maxAmount: 1000, ...over });
const sol = (over = {}) => asset({ name: 'SOL', network: 'solana', decimals: 9, ...over });
const paid = (exp, over = {}) => config({ invoice: invoice({ expirySeconds: exp, expiryRequires: 'paid', ...over }) });

test('every check has an id, a level, a kind, a summary and a fix, and the ids are unique', () => {
  assert.equal(RULES.length, 30);
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  for (const r of RULES) {
    assert.ok(['error', 'warning', 'info'].includes(r.severity), r.id);
    assert.ok(['documented', 'best practice', 'input'].includes(r.kind), r.id);
    assert.ok(r.summary.length > 20 && r.fix.length > 20, r.id);
  }
  assert.equal(ruleById('webhook-unsigned').severity, 'error');
  assert.equal(ruleById('nothing'), undefined);
});

test('the configuration of the helpers gives no finding, and a finding of a check is at the line of its field', () => {
  assert.deepEqual(idsOf(config()), []);
  const c = withAsset(usdc('ethereum', { decimals: 18 }), 2);
  assert.equal(ofCheck(c, 'token-decimals-mismatch')[0].line, lineOf(configText(c), '"decimals": 18', 2));
});

test('confirmations-below-documented: Bitcoin below six with a large or unknown largest invoice, or at 0; six, or a small invoice, passes', () => {
  const at = (over) => ofCheck(config({}, [btc(over), ...ASSETS.slice(1)]), 'confirmations-below-documented');
  assert.match(at({ confirmations: 5, maxAmount: undefined })[0].message, /^Asset BTC on bitcoin marks an invoice paid after 5 confirmations, and the asset gives no maxAmount, so an invoice of any size can be paid with it, above the --large-payment limit of 1000 USD\. The Bitcoin developer guide asks/);
  assert.match(at({ confirmations: 1, maxAmount: 1000.01 })[0].message, /after 1 confirmation, and its largest invoice, 1000\.01 USD, is above the --large-payment limit of 1000 USD/);
  assert.deepEqual(at({ confirmations: 1, maxAmount: 1000 }), [], 'at the limit is not above it');
  assert.deepEqual(at({ confirmations: 6, maxAmount: undefined }), []);
  assert.match(at({ confirmations: 0, maxAmount: 10 })[0].message, /with 0 confirmations, a payment that has only been broadcast/);
  assert.deepEqual(ofCheck(config({}, [btc({ confirmations: 2, maxAmount: 5000 }), ...ASSETS.slice(1)]), 'confirmations-below-documented', { largePayment: '5000' }), [], '--large-payment moves the limit');
  assert.equal(at({ confirmations: 2, maxAmount: 5000 })[0].line, lineOf(configText(config({}, [btc({ confirmations: 2, maxAmount: 5000 }), ...ASSETS.slice(1)])), '"confirmations": 2'));
  assert.equal(DEFAULT_LARGE_PAYMENT, '1000');
});

test('confirmations-below-default: below the starting point of each network, and --min-confirmations moves it; at it passes', () => {
  for (const [network, floor] of [['ethereum', 12], ['polygon', 64], ['arbitrum', 12], ['base', 12], ['tron', 19]]) {
    const below = plus(evm(network, { name: 'X', confirmations: floor - 1, kind: 'native' }));
    const f = ofCheck(below, 'confirmations-below-default');
    assert.equal(f.length, 1, network);
    assert.match(f[0].message, new RegExp(`fewer than the tool's starting point of ${floor} for `), network);
    assert.match(f[0].message, BP);
    assert.deepEqual(ofCheck(plus(evm(network, { name: 'X', confirmations: floor })), 'confirmations-below-default'), [], network);
  }
  const c = plus(evm('polygon', { name: 'X', confirmations: 20 }));
  assert.deepEqual(ofCheck(c, 'confirmations-below-default', { minConfirmations: { polygon: 20 } }), []);
  assert.match(ofCheck(c, 'confirmations-below-default', { minConfirmations: { polygon: 30 } })[0].message, /fewer than the 30 set with --min-confirmations/);
  assert.match(ofCheck(plus(evm('tron', { name: 'X', confirmations: 1 })), 'confirmations-below-default')[0].message, /after 1 confirmation, fewer/);
  assert.deepEqual(ofCheck(plus(btc({ name: 'B2', confirmations: 3, maxAmount: 10 })), 'confirmations-below-default'), [], 'Bitcoin has its documented check');
  assert.deepEqual(ofCheck(plus(evm('litecoin', { name: 'X', confirmations: 0 })), 'confirmations-below-default'), [], 'a network out of the table is not judged');
});

test('solana-commitment-processed and solana-commitment-confirmed: below finalized; finalized passes', () => {
  const p = plus(sol({ commitment: 'processed' }));
  assert.match(ofCheck(p, 'solana-commitment-processed')[0].message, /^Asset SOL on solana marks an invoice paid at the processed commitment\. The Solana RPC page says a processed block can still be rolled back/);
  assert.equal(ofCheck(p, 'solana-commitment-processed')[0].line, lineOf(configText(p), '"processed"'));
  assert.match(ofCheck(plus(sol({ commitment: 'Confirmed' })), 'solana-commitment-confirmed')[0].message, /at the confirmed commitment\. A confirmed block has the votes of a supermajority/);
  assert.deepEqual(idsOf(plus(sol())), []);
});

test('paid-before-finality: Ethereum paid after confirmations with a large or unknown largest invoice; finalized, or small, passes', () => {
  const at = (over, options) => ofCheck(plus(evm('ethereum', { name: 'E2', confirmations: 64, ...over })), 'paid-before-finality', options);
  assert.match(at({ maxAmount: 1000.5 })[0].message, /^Asset E2 on ethereum marks an invoice paid after 64 confirmations, before its block is finalized, and its largest invoice, 1000\.5 USD, is above the --large-payment limit of 1000 USD\. The page of ethereum\.org on proof-of-stake says/);
  assert.match(at({ maxAmount: undefined })[0].message, /the asset gives no maxAmount/);
  assert.deepEqual(at({ maxAmount: 1000 }), []);
  assert.deepEqual(at({ maxAmount: 2500.5 }, { largePayment: '2500.5' }), []);
  assert.deepEqual(ofCheck(plus(asset({ name: 'E2', maxAmount: undefined })), 'paid-before-finality'), [], 'finalized');
  assert.deepEqual(ofCheck(plus(evm('polygon', { name: 'E2', confirmations: 64, maxAmount: 5000 })), 'paid-before-finality'), [], 'only on Ethereum');
});

test('evm-paid-before-finality: Polygon PoS, Arbitrum and Base paid after confirmations with a large invoice; finalized passes', () => {
  for (const network of ['polygon', 'arbitrum', 'base']) {
    const f = ofCheck(plus(evm(network, { name: 'X', confirmations: 64, maxAmount: 5000 })), 'evm-paid-before-finality');
    assert.equal(f.length, 1, network);
    assert.match(f[0].message, BP);
    assert.deepEqual(ofCheck(plus(evm(network, { name: 'X', confirmations: undefined, commitment: 'finalized', maxAmount: 5000 })), 'evm-paid-before-finality'), [], network);
  }
  assert.deepEqual(ofCheck(plus(evm('tron', { name: 'X', confirmations: 19, maxAmount: 5000 })), 'evm-paid-before-finality'), [], 'Tron is not an EVM network');
});

test('token-contract-missing: a token with no contract, at the line of the asset; a native asset needs none', () => {
  const c = plus(usdc('base', { contract: undefined, confirmations: 12, commitment: undefined, maxAmount: 1000 }));
  const f = ofCheck(c, 'token-contract-missing');
  assert.match(f[0].message, /^Asset USDC on base is a token with no contract address, so a token of any contract named USDC could pay an invoice\./);
  assert.equal(f[0].line, lineOf(configText(c), '\n    {', 5) + 1);
  assert.deepEqual(idsOf(plus(asset({ name: 'E2' }))), []);
});

test('token-contract-malformed: the form of each family; a well-formed address passes', () => {
  const at = (a) => ofCheck(plus(a), 'token-contract-malformed');
  assert.match(at(usdc('base', { contract: '0x8335' }))[0].message, /^The contract of asset USDC on base is "0x8335", which has 4 characters after 0x, not 40; on Base it is 0x followed by 40 hex digits, not the zero address\./);
  assert.match(at(usdc('base', { contract: addr('0') }))[0].message, /is the zero address/);
  assert.match(at(asset({ name: 'BONK', network: 'solana', kind: 'token', contract: '0OIl', decimals: 5 }))[0].message, /base58 does not use/);
  assert.match(at(asset({ name: 'USDT', network: 'tron', kind: 'token', contract: addr('1'), decimals: 6, commitment: undefined, confirmations: 19, maxAmount: 10 }))[0].message, /does not start with T; on Tron it is T followed by 33 base58 characters/);
  assert.deepEqual(at(asset({ name: 'USDT', network: 'tron', kind: 'token', contract: tron(), decimals: 6, commitment: undefined, confirmations: 19, maxAmount: 10 })), []);
  assert.deepEqual(at(asset({ name: 'TOK', network: 'litecoin', kind: 'token', contract: 'anything', decimals: 6, commitment: undefined, confirmations: 6 })), [], 'a network out of the table');
  assert.match(at(usdc('base', { contract: addr('1').padStart(43, ' ') }))[0].message, /has spaces around it/);
});

test('token-contract-not-official: a USDC contract other than the one Circle lists; the same address in another case passes', () => {
  const f = ofCheck(plus(usdc('base', { contract: addr('1'), confirmations: 12, commitment: undefined, maxAmount: 1000 })), 'token-contract-not-official');
  assert.match(f[0].message, /^The contract of asset USDC on base is 0x1{40}, but Circle's page of USDC contract addresses lists 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 for Base: payments in another token named USDC would be counted as USDC\./);
  assert.deepEqual(ofCheck(plus(usdc('base', { contract: USDC.base.toLowerCase() })), 'token-contract-not-official'), []);
  assert.equal(ofCheck(plus(usdc('solana', { name: 'usdc', contract: USDC.solana.toLowerCase().replace(/l/g, 'L') })), 'token-contract-not-official').length, 1, 'case is part of a Solana address');
  assert.deepEqual(ofCheck(plus(usdc('base', { name: 'USDC.e', contract: addr('1') })), 'token-contract-not-official'), [], 'another name is another token');
  assert.deepEqual(ofCheck(plus(usdc('base', { contract: '0x8335' })), 'token-contract-not-official'), [], 'a malformed address is reported once');
  const r = checkText(configText(plus(asset({ name: 'USDC', network: 'tron', kind: 'token', contract: tron(), decimals: 6, commitment: undefined, confirmations: 19, maxAmount: 10 }))));
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.notes, ["Circle's page of USDC contract addresses lists no address for USDC on tron, so the contract was checked for its form only"]);
});

test('token-decimals-mismatch: USDC with other than 6 decimals, both ways; 6 passes, and another token is not judged', () => {
  assert.match(ofCheck(plus(usdc('arbitrum', { decimals: 18 })), 'token-decimals-mismatch')[0].message, /^Asset USDC on arbitrum has 18 decimals, but the Circle quickstart for Solana says USDC carries 6: every amount read is too small by a factor of 1,000,000,000,000, so a full payment looks like an underpayment\./);
  assert.match(ofCheck(plus(usdc('arbitrum', { decimals: 2 })), 'token-decimals-mismatch')[0].message, /too large by a factor of 10,000, so a small payment looks like a full one/);
  assert.deepEqual(ofCheck(plus(usdc('arbitrum')), 'token-decimals-mismatch'), []);
  assert.deepEqual(ofCheck(plus(usdc('arbitrum', { name: 'DAI', contract: addr('d'), decimals: 18 })), 'token-decimals-mismatch'), []);
});

test('deposit-address-shared: a shared address with no reference or "none"; a memo, a reference key or a fresh address passes', () => {
  const f = ofCheck(plus(sol({ depositAddress: 'shared' })), 'deposit-address-shared');
  assert.match(f[0].message, /^Asset SOL on solana takes the payments of every invoice at one shared address and asks for no memo or reference key/);
  assert.match(f[0].message, BP);
  assert.equal(ofCheck(plus(sol({ depositAddress: 'shared', reference: 'none' })), 'deposit-address-shared').length, 1);
  assert.deepEqual(ofCheck(plus(sol({ depositAddress: 'shared', reference: 'memo' })), 'deposit-address-shared'), []);
  assert.deepEqual(ofCheck(plus(sol({ reference: 'none' })), 'deposit-address-shared'), []);
});

test('invoice-expiry-missing: no expirySeconds, or 0; a whole number of seconds passes', () => {
  assert.match(ofCheck(config({ invoice: invoice({ expirySeconds: undefined }) }), 'invoice-expiry-missing')[0].message, /^The invoice has no expirySeconds, so a total priced in USD stays open while the rate moves/);
  const zero = config({ invoice: invoice({ expirySeconds: 0 }) });
  assert.match(ofCheck(zero, 'invoice-expiry-missing')[0].message, /^The invoice expires after 0 seconds, so a total priced in USD cannot be paid in time/);
  assert.equal(ofCheck(zero, 'invoice-expiry-missing')[0].line, lineOf(configText(zero), '"expirySeconds"'));
  assert.deepEqual(ofCheck(config({ invoice: invoice({ expirySeconds: 1 }) }), 'invoice-expiry-missing'), []);
  assert.deepEqual(ofCheck(config({ invoice: invoice({ expirySeconds: 0, rateLockSeconds: 5 }) }), 'rate-lock-exceeds-expiry'), [], 'no expiry to compare with');
});

test('invoice-expiry-below-confirmation-time: an invoice that must be paid expires before an asset can be; at the time, or detected, passes', () => {
  // BTC after six confirmations takes 3,600 seconds; ETH and USDC at the finalized checkpoint 768; USDC on Solana 12.8.
  const f = ofCheck(paid(3599), 'invoice-expiry-below-confirmation-time');
  assert.deepEqual(f.map((x) => x.entry), ['BTC on bitcoin']);
  assert.match(f[0].message, /^The invoice expires after 3,599 seconds, but a payment in asset BTC on bitcoin takes about 3,600 seconds \(1 hour\) to reach 6 confirmations: the invoice must be paid before it expires/);
  assert.deepEqual(ofCheck(paid(3600), 'invoice-expiry-below-confirmation-time'), []);
  assert.deepEqual(ofCheck(paid(700), 'invoice-expiry-below-confirmation-time').map((x) => x.entry), ['BTC on bitcoin', 'ETH on ethereum', 'USDC on ethereum']);
  assert.match(ofCheck(paid(700), 'invoice-expiry-below-confirmation-time')[1].message, /takes about 768 seconds to reach the finalized checkpoint/);
  assert.deepEqual(ofCheck(config({ invoice: invoice({ expirySeconds: 60 }) }), 'invoice-expiry-below-confirmation-time'), [], 'detected');
  assert.match(ofCheck(config({ invoice: invoice({ expirySeconds: 60, expiryRequires: undefined }) }), 'invoice-expiry-below-confirmation-time')[0].message, /the invoice gives no expiryRequires, so it is read as one that must be paid before it expires/);
  const own = ofCheck(config({ invoice: invoice({ expirySeconds: 60, expiryRequires: 'paid' }) }, [evm('polygon', { name: 'X', confirmations: 64 })]), 'invoice-expiry-below-confirmation-time');
  assert.match(own[0].message, /takes about 128 seconds to reach 64 confirmations.*The time of a block of Polygon PoS is the tool's own figure\./);
  assert.deepEqual(ofCheck(config({ invoice: invoice({ expirySeconds: 1, expiryRequires: 'paid' }) }, [sol({ commitment: 'confirmed' })]), 'invoice-expiry-below-confirmation-time'), [], 'a slot of Solana is shorter than a second');
  assert.deepEqual(ofCheck(config({ invoice: invoice({ expirySeconds: 1, expiryRequires: 'paid' }) }, [evm('base', { name: 'X', confirmations: undefined, commitment: 'finalized' })]), 'invoice-expiry-below-confirmation-time'), [], 'no figure for the finality of Base');
});

test('rate-lock-exceeds-expiry: a rate held longer than the invoice runs; equal passes', () => {
  const f = ofCheck(config({ invoice: invoice({ rateLockSeconds: 901 }) }), 'rate-lock-exceeds-expiry');
  assert.match(f[0].message, /^The quoted rate is held for 901 seconds, longer than the 900 seconds \(15 minutes\) the invoice runs/);
  assert.match(f[0].message, BP);
  assert.deepEqual(ofCheck(config({ invoice: invoice({ rateLockSeconds: 900 }) }), 'rate-lock-exceeds-expiry'), []);
  assert.deepEqual(ofCheck(config({ invoice: invoice({ rateLockSeconds: undefined }) }), 'rate-lock-exceeds-expiry'), []);
});

test('payment-tolerance-missing: a tolerance missing or negative; 0 passes', () => {
  const both = ofCheck(config({ invoice: invoice({ underpaymentTolerance: undefined, overpaymentTolerance: undefined }) }), 'payment-tolerance-missing');
  assert.equal(both.length, 1);
  assert.match(both[0].message, /^The invoice has no underpaymentTolerance and no overpaymentTolerance, so what the checkout does/);
  const neg = config({ invoice: invoice({ overpaymentTolerance: -1 }) });
  assert.match(ofCheck(neg, 'payment-tolerance-missing')[0].message, /^The overpaymentTolerance of the invoice is negative/);
  assert.equal(ofCheck(neg, 'payment-tolerance-missing')[0].line, lineOf(configText(neg), '"overpaymentTolerance"'));
  assert.deepEqual(ofCheck(config({ invoice: invoice({ underpaymentTolerance: 0, overpaymentTolerance: 0 }) }), 'payment-tolerance-missing'), []);
});

test('webhook-not-https: a scheme other than https, in any case; https passes', () => {
  const c = config({ webhook: webhook({ url: 'http://shop.example/hooks' }) });
  assert.match(ofCheck(c, 'webhook-not-https')[0].message, /^The webhook URL uses http, not https/);
  assert.equal(ofCheck(c, 'webhook-not-https')[0].line, lineOf(configText(c), '"url"'));
  assert.equal(ofCheck(config({ webhook: webhook({ url: 'ws://shop.example/hooks' }) }), 'webhook-not-https').length, 1);
  assert.deepEqual(ofCheck(config({ webhook: webhook({ url: 'HTTPS://shop.example/hooks' }) }), 'webhook-not-https'), []);
});

test('webhook-unsigned and webhook-weak-signature: no signature, none, weak or unknown; HMAC-SHA256 and HMAC-SHA512 pass', () => {
  assert.match(ofCheck(config({ webhook: webhook({ signature: undefined }) }), 'webhook-unsigned')[0].message, /^The webhook has no signature, so anyone who learns its URL can post an event that marks an invoice paid\./);
  assert.match(ofCheck(config({ webhook: webhook({ signature: 'None', secretRef: undefined }) }), 'webhook-unsigned')[0].message, /is not signed \(signature "none"\)/);
  assert.match(ofCheck(config({ webhook: webhook({ signature: 'HMAC-SHA1' }) }), 'webhook-weak-signature')[0].message, /^The webhook is signed with "HMAC-SHA1", which is weaker than HMAC-SHA256\./);
  assert.match(ofCheck(config({ webhook: webhook({ signature: 'sha256' }) }), 'webhook-weak-signature')[0].message, /weaker than HMAC-SHA256/);
  assert.match(ofCheck(config({ webhook: webhook({ signature: 'rot13' }) }), 'webhook-weak-signature')[0].message, /an algorithm the tool does not know/);
  assert.deepEqual(ofCheck(config({ webhook: webhook({ signature: 'hmac-sha512' }) }), 'webhook-weak-signature'), []);
  assert.deepEqual(ofCheck(config({ webhook: webhook({ signature: 'none' }) }), 'webhook-weak-signature'), []);
});

test('webhook-replay-unprotected: no timestamp tolerance, or 0; one second passes', () => {
  assert.match(ofCheck(config({ webhook: webhook({ timestampTolerance: undefined }) }), 'webhook-replay-unprotected')[0].message, /^The webhook has no timestampTolerance/);
  assert.match(ofCheck(config({ webhook: webhook({ timestampTolerance: 0 }) }), 'webhook-replay-unprotected')[0].message, /has a timestampTolerance of 0/);
  assert.deepEqual(ofCheck(config({ webhook: webhook({ timestampTolerance: 1 }) }), 'webhook-replay-unprotected'), []);
});

test('webhook-idempotency-missing: no idempotency key; a key passes', () => {
  const c = config({ webhook: webhook({ idempotencyKey: undefined }) });
  assert.match(ofCheck(c, 'webhook-idempotency-missing')[0].message, /^The webhook names no idempotencyKey, so an event delivered twice can count one payment twice\./);
  assert.equal(ofCheck(c, 'webhook-idempotency-missing')[0].line, lineOf(configText(c), '"webhook"'));
  assert.deepEqual(ofCheck(config({ webhook: webhook({ idempotencyKey: 'id' }) }), 'webhook-idempotency-missing'), []);
});

test('webhook-retry-missing: no retry policy, or 0 attempts; one attempt passes', () => {
  assert.match(ofCheck(config({ webhook: webhook({ retry: undefined }) }), 'webhook-retry-missing')[0].message, /^The webhook has no retry policy/);
  const zero = config({ webhook: webhook({ retry: { maxAttempts: 0 } }) });
  assert.match(ofCheck(zero, 'webhook-retry-missing')[0].message, /^The webhook retries 0 times/);
  assert.equal(ofCheck(zero, 'webhook-retry-missing')[0].line, lineOf(configText(zero), '"maxAttempts"'));
  assert.deepEqual(ofCheck(config({ webhook: webhook({ retry: { maxAttempts: 1 } }) }), 'webhook-retry-missing'), []);
  assert.deepEqual(ofCheck(config({ webhook: webhook({ retry: {} }) }), 'webhook-retry-missing'), [], 'a missing count is a field-missing finding');
});

test('refund-to-sender and refund-address-unreviewed: by destination and review; refunds off pass', () => {
  assert.match(ofCheck(config({ refunds: refunds({ destination: 'sender' }) }), 'refund-to-sender')[0].message, /^Refunds go back to the address the payment came from\. The Bitcoin developer guide calls this very unsafe/);
  const unreviewed = ofCheck(config({ refunds: refunds({ review: false }) }), 'refund-address-unreviewed');
  assert.match(unreviewed[0].message, /^Refunds go to an address the customer gives, not the sender, and review is off/);
  assert.match(unreviewed[0].message, BP);
  assert.match(ofCheck(config({ refunds: refunds({ destination: 'operator', review: undefined }) }), 'refund-address-unreviewed')[0].message, /an address an operator enters, not the sender, and the refunds have no review/);
  assert.deepEqual(ofCheck(config({ refunds: refunds({ destination: 'sender', enabled: false }) }), 'refund-to-sender'), []);
  assert.deepEqual(ofCheck(config({ refunds: refunds({ review: undefined, enabled: false }) }), 'refund-address-unreviewed'), []);
});

test('network-not-in-table: a network the table does not hold, as a note; an alias of the table passes', () => {
  const c = plus(evm('litecoin', { name: 'LTC', confirmations: 6 }));
  const f = ofCheck(c, 'network-not-in-table');
  assert.match(f[0].message, /^The network "litecoin" of asset LTC on litecoin is not in the tool's table \(bitcoin, ethereum, polygon, arbitrum, base, solana, tron\)/);
  assert.equal(f[0].line, lineOf(configText(c), '"litecoin"'));
  assert.deepEqual(ofCheck(plus(evm('ARBITRUM-ONE', { name: 'X' })), 'network-not-in-table'), []);
  assert.match(ofCheck(plus(evm('n'.repeat(80), { name: 'X' })), 'network-not-in-table')[0].message, /"n{57}\.\.\."/);
});

test('notes: an asset whose way of being paid could not be read', () => {
  const r = checkText(configText(plus(asset({ name: 'X', commitment: 'safe' }))));
  assert.deepEqual(r.notes, ['what marks an invoice paid could not be read for X on ethereum, so it was not checked for confirmations, finality or the time to be paid']);
  const two = checkText(configText(config({}, [asset({ commitment: 'safe' }), asset({ name: 'Y', commitment: 'latest' })])));
  assert.match(two.notes[0], /^what marks invoices paid could not be read for ETH on ethereum, Y on ethereum, so they were not checked/);
});

test('helpers of the checks: durations, spans, the time to be paid, the thresholds and the result', () => {
  assert.equal(duration(3600), '3,600 seconds (1 hour)');
  assert.equal(duration(900), '900 seconds (15 minutes)');
  assert.equal(duration(60), '60 seconds (1 minute)');
  assert.equal(duration(1), '1 second');
  assert.equal(duration(7260), '7,260 seconds');
  assert.equal(span(12800), '12.8 seconds');
  assert.equal(span(400), '0.4 seconds');
  assert.equal(span(768000), '768 seconds');
  const c = readConfig(readJson(configText(config({}, [btc(), evm('litecoin', { name: 'L' }), asset(), sol({ commitment: 'processed' })])))).config;
  assert.deepEqual(c.assets.map(timeToPaid), [3600000, null, 768000, 400]);
  assert.equal(thresholdOf({ id: 'polygon', minConfirmations: 64 }), 64);
  assert.equal(thresholdOf({ id: 'polygon', minConfirmations: 64 }, { polygon: 128 }), 128);
  assert.ok(atOrAbove('error', 'warning'));
  assert.ok(!atOrAbove('info', 'warning'));
  assert.deepEqual(decide({ error: 0, warning: 1, info: 0 }, 'error'), { pass: true, failOn: 'error', text: 'PASS - no finding at or above error (1 warning)' });
  assert.deepEqual(decide({ error: 0, warning: 0, info: 0 }, 'info'), { pass: true, failOn: 'info', text: 'PASS - no finding at or above info' });
  assert.equal(decide({ error: 2, warning: 0, info: 0 }, 'error').text, 'FAIL - 2 findings at or above error (2 error)');
  assert.equal(analyzeConfig({ currency: null, assets: [], invoice: null, webhook: null, refunds: null }).findings.length, 0);
  assert.match(BEST, /^a best practice of this tool/);
});
